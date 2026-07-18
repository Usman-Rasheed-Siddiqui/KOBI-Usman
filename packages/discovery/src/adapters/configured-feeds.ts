import {
  calculateOpportunityScores,
  cleanDescription,
  detectHardware,
  inferContributionTypes,
  summarizeDisplayText,
  stableOpportunityId,
  type Opportunity,
  type SearchIntent,
} from "@openforge/domain";
import { assertSafePublicUrl } from "@openforge/security";
import { safeFetch } from "../http";
import { parseSyndicationFeed } from "../parsers/feed";
import { isAllowedByRobots } from "../robots";
import type { SourceAdapter } from "../types";

const EVENT_SIGNAL = /hackathon|workshop|conference|meetup|sprint|hack night|competition|event|summit/i;

export class ConfiguredFeedAdapter implements SourceAdapter {
  id = "configured-feeds";
  name = "Approved Community Feeds";
  supportedEntityTypes = ["EVENT", "PROJECT", "HARDWARE_PROJECT"];
  defaultConcurrency = Number(process.env.DISCOVERY_FEED_CONCURRENCY ?? 3);
  private sources = (process.env.APPROVED_FEED_SOURCES ?? "").split(",").map((value) => value.trim()).filter(Boolean);

  async search(intent: SearchIntent, signal?: AbortSignal): Promise<Opportunity[]> {
    if (!this.sources.length) return [];
    const hosts = new Set<string>();
    for (const source of this.sources) hosts.add((await assertSafePublicUrl(source)).hostname);

    const settled = await Promise.allSettled(this.sources.map(async (source) => {
      if (!(await isAllowedByRobots(source, [...hosts], signal))) return [];
      const response = await safeFetch(source, {
        signal,
        approvedHosts: [...hosts],
        maxBytes: 3_000_000,
        headers: { accept: "application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9" },
      });
      const xml = await response.text();
      if (xml.length > 3_000_000) throw new Error("Feed exceeds parser size limit");
      return parseSyndicationFeed(xml, source);
    }));

    const terms = intent.query.toLowerCase().split(/\s+/).filter(Boolean);
    const now = new Date().toISOString();
    return settled
      .flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .filter((item) => !terms.length || terms.some((term) => `${item.title} ${item.description ?? ""} ${item.categories.join(" ")}`.toLowerCase().includes(term)))
      .slice(0, intent.limit ?? (intent.hardMode ? 60 : 30))
      .map((item): Opportunity => {
        const description = cleanDescription(item.description, item.title);
        const combined = `${item.title} ${description ?? ""} ${item.categories.join(" ")}`;
        const event = EVENT_SIGNAL.test(combined);
        const hardware = detectHardware(combined);
        const scores = calculateOpportunityScores({ lastActivity: item.publishedAt, issueBodyLength: description?.length });
        return {
          id: stableOpportunityId("feed", item.url),
          title: item.title,
          description,
          shortSummary: summarizeDisplayText(description),
          entityType: event ? "EVENT" : hardware ? "HARDWARE_PROJECT" : "PROJECT",
          source: "Approved community feed",
          canonicalUrl: item.url,
          registrationUrl: event ? item.url : undefined,
          repositoryUrl: !event ? item.url : undefined,
          technologies: [],
          languages: [],
          topics: item.categories,
          skillsRequired: [],
          difficulty: "UNKNOWN",
          beginnerFriendly: event,
          goodFirstIssue: false,
          helpWanted: false,
          activityScore: scores.activityScore,
          maintainerResponsiveness: scores.maintainerResponsiveness,
          lastActivity: item.publishedAt,
          eventDate: event ? item.publishedAt : undefined,
          contributionTypes: event ? ["Event"] : inferContributionTypes(combined),
          hardware,
          qualityScore: scores.qualityScore,
          freshnessScore: scores.freshnessScore,
          matchScore: 0,
          scrapedAt: now,
          updatedAt: item.publishedAt ?? now,
          metadata: { feedCategories: item.categories },
        };
      });
  }

  async healthCheck() {
    return {
      ok: true,
      latencyMs: 0,
      message: this.sources.length ? `${this.sources.length} approved feed(s)` : "No optional feeds configured",
    };
  }
}
