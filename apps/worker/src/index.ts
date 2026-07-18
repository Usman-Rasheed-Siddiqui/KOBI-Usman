import "@openforge/database/register-env";
import { databaseTargetSummary, prisma } from "@openforge/database";
import { persistOpportunities } from "@openforge/database/persist";
import { searchAll, sourceAdapters } from "@openforge/discovery";
import { SearchIntentSchema } from "@openforge/domain";

const workerId = `worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
const idleIntervalMs = Number(process.env.WORKER_IDLE_INTERVAL_MS ?? 1200);
const runOnce = process.env.WORKER_ONCE === "true";
let stopping = false;

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function claimJob() {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH candidate AS (
      SELECT id FROM "CrawlJob"
      WHERE (
          status = 'QUEUED'
          AND "scheduledAt" <= NOW()
          AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW())
        )
        OR (
          status IN ('CLAIMED', 'RUNNING')
          AND "leaseUntil" IS NOT NULL
          AND "leaseUntil" <= NOW()
          AND attempts < "maxAttempts"
        )
      ORDER BY priority ASC, "scheduledAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "CrawlJob" j
    SET status = 'CLAIMED',
        "claimedAt" = NOW(),
        "leaseUntil" = NOW() + INTERVAL '90 seconds',
        "workerId" = ${workerId},
        "updatedAt" = NOW()
    FROM candidate
    WHERE j.id = candidate.id
    RETURNING j.id
  `;
  if (!rows[0]?.id) return null;
  return prisma.crawlJob.findUnique({ where: { id: rows[0].id } });
}

async function processJob(job: NonNullable<Awaited<ReturnType<typeof claimJob>>>) {
  await prisma.crawlJob.update({ where: { id: job.id }, data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } } });
  try {
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    if (job.type === "SEARCH_LIVE" || job.type === "DISCOVER_SOURCE") {
      const intent = SearchIntentSchema.parse({ query: String(payload.query ?? "open source"), ...(payload.intent as object | undefined), sources: job.sourceId ? [job.sourceId] : undefined, limit: Number(payload.limit ?? 40) });
      const items = await searchAll(intent);
      await persistOpportunities(items, { workflow: "worker", query: intent.query });
      await prisma.crawlJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", completedAt: new Date(), result: { count: items.length } } });
      return;
    }
    if (job.type === "RADAR_MATCH") {
      const watchlists = await prisma.watchlist.findMany({
        where: { enabled: true, ...(typeof payload.watchlistId === "string" ? { id: payload.watchlistId } : {}) },
        take: 100,
      });
      let notifications = 0;
      for (const watchlist of watchlists) {
        const filters = watchlist.filters && typeof watchlist.filters === "object" ? watchlist.filters as Record<string, unknown> : {};
        const intent = SearchIntentSchema.parse({ query: watchlist.query, ...filters, limit: 8 });
        const items = await searchAll(intent);
        await persistOpportunities(items, { workflow: "worker", query: watchlist.query });
        for (const item of items.slice(0, 3)) {
          const url = item.contributionUrl ?? item.registrationUrl ?? item.repositoryUrl ?? item.canonicalUrl;
          const existing = await prisma.notification.findFirst({
            where: { userId: watchlist.userId, type: "RADAR_MATCH", url, createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
            select: { id: true },
          });
          if (existing) continue;
          await prisma.notification.create({
            data: {
              userId: watchlist.userId,
              type: "RADAR_MATCH",
              title: `${watchlist.name}: new match`,
              body: `${item.title} - ${item.matchScore}% match from ${item.source}`,
              url,
            },
          });
          notifications += 1;
        }
        await prisma.watchlist.update({ where: { id: watchlist.id }, data: { lastRunAt: new Date() } });
      }
      await prisma.crawlJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", completedAt: new Date(), result: { watchlists: watchlists.length, notifications } } });
      return;
    }
    if (job.type === "SOURCE_HEALTH_CHECK") {
      const adapters = job.sourceId ? sourceAdapters.filter((x) => x.id === job.sourceId) : sourceAdapters;
      const health = await Promise.all(adapters.map(async (adapter) => ({ id: adapter.id, health: await adapter.healthCheck() })));
      for (const entry of health) {
        await prisma.source.upsert({
          where: { id: entry.id },
          create: { id: entry.id, name: sourceAdapters.find((x) => x.id === entry.id)?.name ?? entry.id, baseUrl: "", adapter: entry.id, status: entry.health.ok ? "ACTIVE" : "DEGRADED", avgLatencyMs: entry.health.latencyMs, lastError: entry.health.message },
          update: { status: entry.health.ok ? "ACTIVE" : "DEGRADED", avgLatencyMs: entry.health.latencyMs, lastError: entry.health.message }
        });
      }
      await prisma.crawlJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", completedAt: new Date(), result: health } });
      return;
    }
    throw new Error(`Unsupported queued job type: ${job.type}. This job should be decomposed into a supported discovery, health, or radar job before enqueueing.`);
  } catch (error) {
    const attempts = job.attempts + 1;
    const dead = attempts >= job.maxAttempts;
    const delayMs = Math.min(30 * 60_000, 5_000 * 2 ** attempts + Math.floor(Math.random() * 1_000));
    await prisma.crawlJob.update({
      where: { id: job.id },
      data: {
        status: dead ? "DEAD_LETTER" : "QUEUED",
        failureReason: error instanceof Error ? error.message.slice(0, 2000) : "Unknown worker error",
        nextRetryAt: dead ? null : new Date(Date.now() + delayMs),
        deadLetterAt: dead ? new Date() : null,
        workerId: null, leaseUntil: null
      }
    });
  }
}

async function main() {
  const target = databaseTargetSummary();
  await prisma.$queryRaw`SELECT 1`;
  console.log(JSON.stringify({ level: "info", msg: "KOBI worker started", workerId, databaseHost: target.host, databaseName: target.database }));
  let failures = 0;
  while (!stopping) {
    try {
      const job = await claimJob();
      failures = 0;
      if (!job) {
        if (runOnce) break;
        await sleep(idleIntervalMs);
        continue;
      }
      await processJob(job);
      if (runOnce) break;
    } catch (error) {
      failures += 1;
      const retryMs = Math.min(30_000, 1000 * 2 ** Math.min(failures, 5));
      if (failures === 1 || failures % 4 === 0) {
        console.error(JSON.stringify({ level: "error", msg: "Worker loop error", workerId, error: error instanceof Error ? error.message : String(error), retryMs }));
      }
      if (runOnce) break;
      await sleep(retryMs);
    }
  }
  await prisma.$disconnect();
  console.log(JSON.stringify({ level: "info", msg: "KOBI worker stopped", workerId }));
}

void main();
