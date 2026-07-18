import { searchStream } from "@openforge/discovery";
import { rankOpportunities, type EntityType, type Opportunity, type SearchIntent } from "@openforge/domain";
import { checkRateLimit, getClientIp } from "@openforge/security";
import { searchIndexed } from "@/lib/indexed-search";
import { persistOpportunities } from "@/lib/persist-opportunities";
import { getCurrentUserMatchProfile } from "@/lib/personalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dedupe(items: Opportunity[]): Opportunity[] {
  const map = new Map<string, Opportunity>();
  for (const item of items) {
    const key = item.canonicalUrl.replace(/\/$/, "").toLowerCase();
    const previous = map.get(key);
    if (!previous || item.qualityScore > previous.qualityScore) map.set(key, item);
  }
  return [...map.values()];
}

function safelyPersist(items: Opportunity[], query: string) {
  return persistOpportunities(items, { workflow: "discover", query }).then(
    () => ({ ok: true as const, count: items.length }),
    (error) => ({ ok: false as const, count: items.length, message: error instanceof Error ? error.message : "Persistence failed" }),
  );
}

const TECHNOLOGY_TERMS = new Map([
  ["react", "React"], ["typescript", "TypeScript"], ["javascript", "JavaScript"], ["python", "Python"],
  ["ai", "AI"], ["machine learning", "Machine Learning"], ["llm", "LLM"], ["next.js", "Next.js"],
  ["nextjs", "Next.js"], ["vue", "Vue"], ["svelte", "Svelte"], ["rust", "Rust"], ["go", "Go"],
  ["node", "Node.js"], ["node.js", "Node.js"], ["django", "Django"], ["fastapi", "FastAPI"],
]);

const LOCATION_TERMS = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Peshawar", "Faisalabad",
  "Sindh", "Punjab", "Pakistan", "Europe", "Dubai", "UAE", "United Arab Emirates",
  "United States", "USA", "North America", "Asia", "Middle East", "MENA"
];

function nextMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString(), datePreset: "custom" as const };
}

function enrichIntentFromQuery(intent: SearchIntent, query: string, explicit: URLSearchParams) {
  const text = query.toLowerCase();
  if (intent.contentType === "all") {
    const eventLike = /\b(event|events|conference|conferences|hackathon|hackathons|meetup|meetups|workshop|workshops|summit|webinar|bootcamp)\b/.test(text);
    const contributionLike = /\b(contribution|contributions|contribute|issue|issues|good first|good-first|help wanted|repo|repository|repositories|pull request|project|projects|opensource|open-source)\b/.test(text);
    if (eventLike && !contributionLike) {
      intent.contentType = "pulse";
      intent.entityTypes = ["EVENT"];
      intent.datePreset ??= "upcoming";
    } else if (contributionLike && !eventLike) {
      intent.contentType = "forge";
      intent.entityTypes = ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT"];
      intent.issueStatus ??= "open";
      intent.includeProjects ??= true;
    }
  }

  const technologies = [...TECHNOLOGY_TERMS.entries()]
    .filter(([term]) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(query))
    .map(([, label]) => label);
  if (technologies.length) intent.technologies = [...new Set([...(intent.technologies ?? []), ...technologies])];

  if (!intent.location && !explicit.get("location")) {
    const location = LOCATION_TERMS.find((candidate) => new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(query));
    if (location) intent.location = location;
  }

  if (!explicit.get("eventMode")) {
    if (/\b(online|virtual|remote)\b/.test(text)) {
      intent.remote = true;
      intent.modes = ["REMOTE", "HYBRID"];
    } else if (/\b(in person|in-person|onsite|on-site)\b/.test(text)) {
      intent.modes = ["PHYSICAL"];
    } else if (/\bhybrid\b/.test(text)) {
      intent.modes = ["HYBRID"];
    }
  }

  if (!explicit.get("datePreset") && !explicit.get("dateFrom") && !explicit.get("dateTo")) {
    if (/\bnext month\b/.test(text)) Object.assign(intent, nextMonthRange());
    else if (/\bthis week\b|\bweek\b/.test(text) && intent.contentType === "pulse") intent.datePreset = "week";
    else if (/\bthis month\b|\bmonth\b/.test(text) && intent.contentType === "pulse") intent.datePreset = "month";
  }

  if (!explicit.get("updatedWithinDays") && /\b(recent|recently|updated recently|last 30 days)\b/.test(text)) intent.updatedWithinDays = 30;
  if (!intent.beginnerFriendly && /\b(beginner|starter|first timer|first-time)\b/.test(text)) intent.beginnerFriendly = true;
  if (!intent.goodFirstIssue && /\bgood first issue\b/.test(text)) intent.goodFirstIssue = true;
  if (!intent.helpWanted && /\bhelp wanted\b|\blooking for contributors\b/.test(text)) intent.helpWanted = true;
  if (!intent.eventTypes?.length && intent.contentType === "pulse") {
    if (/\bhackathon|hackathons\b/.test(text)) intent.eventTypes = ["Hackathon"];
    else if (/\bconference|conferences\b/.test(text)) intent.eventTypes = ["Conference"];
    else if (/\bworkshop|workshops\b/.test(text)) intent.eventTypes = ["Workshop"];
    else if (/\bmeetup|meetups\b/.test(text)) intent.eventTypes = ["Meetup"];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rate = checkRateLimit(`search:${getClientIp(request.headers)}`, 24, 60_000);
  if (!rate.allowed) {
    return Response.json({ error: "Too many searches. Try again shortly." }, { status: 429 });
  }

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 400);
  if (!q) return Response.json({ error: "Search query is required." }, { status: 400 });

  const mode = url.searchParams.get("mode") ?? "all";
  const hardMode = url.searchParams.get("hard") === "true";
  const fastMode = url.searchParams.get("fast") === "true" && !hardMode;
  const entityTypes: EntityType[] | undefined =
    mode === "events" || mode === "pulse"
      ? ["EVENT"]
      : mode === "contributions" || mode === "forge"
        ? ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT"]
        : mode === "projects"
          ? ["PROJECT", "HARDWARE_PROJECT"]
          : undefined;

  const intent: SearchIntent = {
    query: q,
    contentType: mode === "events" || mode === "pulse" ? "pulse" : mode === "contributions" || mode === "forge" ? "forge" : "all",
    fastMode,
    hardMode,
    entityTypes,
    beginnerFriendly: url.searchParams.get("beginner") === "true" || undefined,
    hardware: mode === "hardware" ? true : url.searchParams.get("hardware") === "true" || undefined,
    hiddenGems: url.searchParams.get("hiddenGems") === "true" || undefined,
    likelySmallScope: url.searchParams.get("smallScope") === "true" || undefined,
    goodFirstIssue: url.searchParams.get("goodFirstIssue") === "true" || undefined,
    helpWanted: url.searchParams.get("helpWanted") === "true" || undefined,
    remote: url.searchParams.get("remote") === "true" || undefined,
    modes: (url.searchParams.get("eventMode") ?? "").split(",").filter((value): value is "REMOTE" | "PHYSICAL" | "HYBRID" | "UNKNOWN" => ["REMOTE", "PHYSICAL", "HYBRID", "UNKNOWN"].includes(value)),
    difficulty: (url.searchParams.get("difficulty") ?? "").split(",").filter((value): value is "STARTING" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "UNKNOWN" => ["STARTING", "BEGINNER", "INTERMEDIATE", "ADVANCED", "UNKNOWN"].includes(value)),
    updatedWithinDays: Number(url.searchParams.get("updatedWithinDays")) > 0 ? Number(url.searchParams.get("updatedWithinDays")) : undefined,
    datePreset: (url.searchParams.get("datePreset") || (mode === "events" || mode === "pulse" ? "upcoming" : undefined)) as SearchIntent["datePreset"],
    issueStatus: (url.searchParams.get("issueStatus") || "open") as SearchIntent["issueStatus"],
    includeProjects: url.searchParams.get("includeProjects") !== "false",
    sources: url.searchParams.get("source") ? [url.searchParams.get("source")!] : undefined,
    location: url.searchParams.get("location")?.trim() || undefined,
    dateFrom: url.searchParams.get("dateFrom") || undefined,
    dateTo: url.searchParams.get("dateTo") || undefined,
    eventTypes: url.searchParams.get("eventType") ? [url.searchParams.get("eventType")!] : undefined,
    limit: hardMode ? 60 : fastMode ? 16 : 40,
  };
  enrichIntentFromQuery(intent, q, url.searchParams);

  const profile = await getCurrentUserMatchProfile();
  const encoder = new TextEncoder();
  const write = (controller: ReadableStreamDefaultController, event: unknown) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      let indexed: Opportunity[] = [];
      let mergedResults: Opportunity[] = [];
      let finalCount = 0;
      try {
        const started = Date.now();
        write(controller, { type: "source_started", source: "KOBI Index" });
        indexed = await searchIndexed(intent, profile);
        if (indexed.length) {
          write(controller, {
            type: "source_result",
            source: "KOBI Index",
            count: indexed.length,
            items: indexed.slice(0, 20),
          });
        }
        write(controller, {
          type: "source_complete",
          source: "KOBI Index",
          count: indexed.length,
          latencyMs: Date.now() - started,
        });

        if (fastMode && indexed.length >= 8) {
          finalCount = indexed.length;
          write(controller, { type: "ranking_update", count: indexed.length, items: indexed.slice(0, intent.limit ?? 16) });
          write(controller, { type: "session_complete", sessionId: crypto.randomUUID(), count: indexed.length, fastMode: true, cacheHit: true });
          return;
        }

        const runDiscovery = async (phaseIntent: SearchIntent, phase: "normal" | "hard") => {
          for await (const event of searchStream(phaseIntent, profile, request.signal)) {
            if (event.type === "ranking_update") {
              const merged = rankOpportunities(dedupe([...indexed, ...mergedResults, ...event.items]), profile, intent).slice(0, intent.limit ?? 40);
              mergedResults = merged;
              finalCount = merged.length;
              const persistResult = await safelyPersist(merged, q);
              write(controller, !persistResult.ok
                ? { type: "source_failed", source: "KOBI Index", message: "Results were found, but some records could not be saved for reuse." }
                : { type: "persistence_complete", source: "KOBI Index", count: merged.length });
              write(controller, { ...event, phase, count: merged.length, items: merged });
              continue;
            }
            if (event.type === "session_started" || event.type === "session_complete") continue;
            write(controller, { ...event, phase });
          }
        };

        await runDiscovery({ ...intent, hardMode: false }, "normal");

        const hardThreshold = intent.contentType === "pulse" ? 6 : 8;
        if (hardMode && finalCount < hardThreshold) {
          write(controller, { type: "source_started", source: "Hard Search" });
          await runDiscovery({ ...intent, fastMode: false, hardMode: true, limit: Math.max(intent.limit ?? 60, 60) }, "hard");
          write(controller, { type: "source_complete", source: "Hard Search", count: finalCount, latencyMs: 0 });
        }

        write(controller, { type: "session_complete", sessionId: crypto.randomUUID(), count: finalCount || indexed.length, fastMode, hardMode });
      } catch (error) {
        write(controller, {
          type: "source_failed",
          source: "KOBI",
          message: error instanceof Error ? error.message : "Search failed",
        });
        write(controller, { type: "session_complete", sessionId: crypto.randomUUID(), count: indexed.length });
      } finally {
        controller.close();
      }
    },
    cancel() {
      // The request signal propagates cancellation into source adapters.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
