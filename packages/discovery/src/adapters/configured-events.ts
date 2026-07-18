import { stableOpportunityId, summarizeDisplayText, type Opportunity, type SearchIntent } from "@openforge/domain";
import { assertSafePublicUrl } from "@openforge/security";
import { safeFetch } from "../http";
import { isAllowedByRobots } from "../robots";
import { extractJsonLdEvents } from "../parsers/html";
import { renderPublicPage } from "../browser-render";
import type { SourceAdapter } from "../types";

export class ConfiguredHtmlEventAdapter implements SourceAdapter {
  id = "configured-events"; name = "Approved Event Sources"; supportedEntityTypes = ["EVENT"];
  defaultConcurrency = Number(process.env.DISCOVERY_EVENT_CONCURRENCY ?? 2);
  private sources = (process.env.APPROVED_EVENT_SOURCES ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  async search(intent: SearchIntent, signal?: AbortSignal): Promise<Opportunity[]> {
    if (!this.sources.length) return [];
    const hosts = new Set<string>();
    for (const source of this.sources) hosts.add((await assertSafePublicUrl(source)).hostname);
    const results = await Promise.allSettled(this.sources.map(async (source) => {
      if (!(await isAllowedByRobots(source, [...hosts], signal))) throw new Error("Source disallows this path in robots.txt");
      const response = await safeFetch(source, { signal, approvedHosts: [...hosts], maxBytes: 4_000_000 });
      const html = await response.text();
      if (html.length > 4_000_000) throw new Error("Event page exceeds parser size limit");
      let events = extractJsonLdEvents(html, source);
      if (!events.length && process.env.DISCOVERY_BROWSER_FALLBACK === "true") {
        const rendered = await renderPublicPage(source, [...hosts], signal);
        events = extractJsonLdEvents(rendered, source);
      }
      return events;
    }));
    const events = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    const terms = intent.query.toLowerCase().split(/\s+/).filter(Boolean);
    return events.filter((event) => !terms.length || terms.some((term) => `${event.title} ${event.description ?? ""} ${event.location ?? ""}`.toLowerCase().includes(term))).slice(0, intent.limit ?? (intent.hardMode ? 60 : 30)).map((event) => ({ id: stableOpportunityId("event-web", event.url), title: event.title, description: event.description, shortSummary: summarizeDisplayText(event.description), entityType: "EVENT", source: "Public event source", canonicalUrl: event.url, registrationUrl: event.registrationUrl ?? event.url, technologies: [], languages: [], topics: ["Event"], skillsRequired: [], difficulty: "UNKNOWN", beginnerFriendly: true, goodFirstIssue: false, helpWanted: false, activityScore: 70, maintainerResponsiveness: 60, lastActivity: event.startsAt, location: event.location, mode: event.mode, eventDate: event.startsAt, contributionTypes: ["Event"], hardware: false, qualityScore: 70, freshnessScore: 80, matchScore: 0, scrapedAt: new Date().toISOString(), updatedAt: event.startsAt ?? new Date().toISOString() } satisfies Opportunity));
  }
  async healthCheck() { return { ok: true, latencyMs: 0, message: this.sources.length ? `${this.sources.length} approved source(s)` : "No optional event sources configured" }; }
}
