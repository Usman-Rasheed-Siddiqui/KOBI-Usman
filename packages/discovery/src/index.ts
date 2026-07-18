import { applySearchFilters, rankOpportunities, SearchIntentSchema, validateOpportunityForIntent, type Opportunity, type SearchIntent, type UserMatchProfile } from "@openforge/domain";
import { GitHubAdapter } from "./adapters/github";
import { GitLabAdapter } from "./adapters/gitlab";
import { CodebergAdapter } from "./adapters/codeberg";
import { HackClubEventsAdapter } from "./adapters/hackclub-events";
import { DevelopersEventsAdapter } from "./adapters/developers-events";
import { ConfiguredHtmlEventAdapter } from "./adapters/configured-events";
import { ConfiguredFeedAdapter } from "./adapters/configured-feeds";
import type { SearchStreamEvent, SourceAdapter } from "./types";

export * from "./types";
export * from "./http";
export * from "./robots";
export * from "./parsers/html";
export * from "./parsers/feed";

export const sourceAdapters: SourceAdapter[] = [
  new GitHubAdapter(),
  new GitLabAdapter(),
  new CodebergAdapter(),
  new HackClubEventsAdapter(),
  new DevelopersEventsAdapter(),
  new ConfiguredFeedAdapter(),
  new ConfiguredHtmlEventAdapter()
];

function dedupe(items: Opportunity[]): Opportunity[] {
  const byUrl = new Map<string, Opportunity>();
  for (const item of items) {
    const key = item.canonicalUrl.replace(/\/$/, "").toLowerCase();
    const existing = byUrl.get(key);
    if (!existing || item.qualityScore > existing.qualityScore) byUrl.set(key, item);
  }
  return [...byUrl.values()];
}

function diversify(items: Opportunity[], limit: number): Opportunity[] {
  const maxPerRepository = limit <= 20 ? 2 : 4;
  const counts = new Map<string, number>();
  const primary: Opportunity[] = [];
  const overflow: Opportunity[] = [];
  for (const item of items) {
    const key = item.entityType === "EVENT" ? item.canonicalUrl : item.repositoryUrl ?? item.organization ?? item.canonicalUrl;
    const count = counts.get(key) ?? 0;
    if (item.entityType === "EVENT" || count < maxPerRepository) {
      primary.push(item);
      counts.set(key, count + 1);
    } else {
      overflow.push(item);
    }
  }
  return [...primary, ...overflow].slice(0, limit);
}

function requestedTypes(intent: SearchIntent) {
  if (intent.contentType === "pulse") return ["EVENT"];
  if (intent.contentType === "forge") return intent.includeProjects === false ? ["CONTRIBUTION"] : ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT"];
  return intent.entityTypes ?? ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT", "EVENT"];
}

function selectAdapters(intent: SearchIntent) {
  const sourceFilter = intent.sources?.map((s) => s.toLowerCase());
  const types = requestedTypes(intent);
  let adapters = sourceAdapters.filter((adapter) => adapter.supportedEntityTypes.some((type) => types.includes(type)));
  if (sourceFilter?.length) adapters = adapters.filter((a) => sourceFilter.includes(a.id) || sourceFilter.includes(a.name.toLowerCase()));
  if (intent.fastMode && !intent.hardMode && !sourceFilter?.length) {
    const preferred = intent.contentType === "pulse" ? new Set(["developers-events", "hackclub"]) : new Set(["github"]);
    adapters = adapters.filter((adapter) => preferred.has(adapter.id));
  }
  return adapters;
}

export async function searchAll(rawIntent: SearchIntent, profile?: UserMatchProfile, signal?: AbortSignal): Promise<Opportunity[]> {
  const intent = SearchIntentSchema.parse(rawIntent);
  const adapters = selectAdapters(intent);
  const settled = await Promise.allSettled(adapters.map((adapter) => adapter.search(intent, signal)));
  const combined = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((item) => validateOpportunityForIntent(item, intent));
  const limit = intent.limit ?? 40;
  return diversify(rankOpportunities(applySearchFilters(dedupe(combined), intent), profile, intent), limit);
}

export async function* searchStream(rawIntent: SearchIntent, profile?: UserMatchProfile, signal?: AbortSignal): AsyncGenerator<SearchStreamEvent> {
  const intent = SearchIntentSchema.parse(rawIntent);
  const sessionId = crypto.randomUUID();
  yield { type: "session_started", sessionId, query: intent.query };
  const adapters = selectAdapters(intent);
  const aggregated: Opportunity[] = [];
  const queue: SearchStreamEvent[] = [];
  let active = adapters.length;
  let wake: (() => void) | undefined;
  const push = (event: SearchStreamEvent) => { queue.push(event); wake?.(); wake = undefined; };
  for (const adapter of adapters) {
    push({ type: "source_started", source: adapter.name });
    void (async () => {
      const started = Date.now();
      try {
        const items = (await adapter.search(intent, signal)).filter((item) => validateOpportunityForIntent(item, intent));
        aggregated.push(...items);
        push({ type: "source_result", source: adapter.name, count: items.length, items: items.slice(0, 12) });
        push({ type: "source_complete", source: adapter.name, count: items.length, latencyMs: Date.now() - started });
      } catch (error) {
        push({ type: "source_failed", source: adapter.name, message: error instanceof Error ? error.message : "Unknown source error" });
      } finally {
        active -= 1;
        wake?.(); wake = undefined;
      }
    })();
  }
  while (active > 0 || queue.length > 0) {
    if (!queue.length) await new Promise<void>((resolve) => { wake = resolve; });
    while (queue.length) yield queue.shift()!;
  }
  const deduped = dedupe(aggregated).filter((item) => validateOpportunityForIntent(item, intent));
  yield { type: "dedupe_complete", before: aggregated.length, after: deduped.length };
  const ranked = diversify(rankOpportunities(applySearchFilters(deduped, intent), profile, intent), intent.limit ?? 40);
  yield { type: "ranking_update", count: ranked.length, items: ranked };
  yield { type: "session_complete", sessionId, count: ranked.length };
}
