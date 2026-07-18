import { cleanDescription, cleanTechnologyLabels, locationMatches, meaningfulQueryTerms, stableOpportunityId, type Opportunity, type SearchIntent } from "@openforge/domain";
import { safeFetchJson } from "../http";
import { AdaptiveRateController } from "../rate-controller";
import type { SourceAdapter } from "../types";

type DeveloperEvent = {
  name?: string;
  date?: [number, number] | number[];
  hyperlink?: string;
  location?: string;
  city?: string;
  country?: string;
  misc?: string;
  status?: string;
  tags?: Array<string | { key?: string; value?: string; label?: string; name?: string }>;
  cfp?: Record<string, unknown>;
};

function modeFromLocation(event: DeveloperEvent): "REMOTE" | "PHYSICAL" | "HYBRID" | "UNKNOWN" {
  const text = `${event.location ?? ""} ${event.misc ?? ""}`.toLowerCase();
  if (/hybrid/.test(text)) return "HYBRID";
  if (/online|remote|virtual/.test(text)) return "REMOTE";
  if (event.city || event.country || event.location) return "PHYSICAL";
  return "UNKNOWN";
}

function eventType(name: string, misc?: string) {
  const text = `${name} ${misc ?? ""}`.toLowerCase();
  if (/hackathon|hack day|hack week/.test(text)) return "Hackathon";
  if (/workshop|masterclass|training/.test(text)) return "Workshop";
  if (/meetup|community/.test(text)) return "Meetup";
  if (/summit/.test(text)) return "Summit";
  return "Conference";
}

function dateIso(value?: number) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function normalizeTags(tags?: DeveloperEvent["tags"]) {
  return [...new Set((tags ?? []).map((tag) => {
    if (typeof tag === "string") return tag;
    return tag.value ?? tag.label ?? tag.name ?? tag.key;
  }).filter((tag): tag is string => Boolean(tag)).map((tag) => tag.trim()).filter(Boolean))];
}

export class DevelopersEventsAdapter implements SourceAdapter {
  id = "developers-events";
  name = "Developers Events";
  supportedEntityTypes = ["EVENT"];
  defaultConcurrency = Number(process.env.DISCOVERY_EVENT_CONCURRENCY ?? 2);
  private rate = new AdaptiveRateController(this.defaultConcurrency, 80);

  async search(intent: SearchIntent, signal?: AbortSignal): Promise<Opportunity[]> {
    const limit = Math.min(intent.limit ?? (intent.hardMode ? 90 : 28), intent.hardMode ? 120 : intent.fastMode ? 16 : 60);
    const now = Date.now();
    const terms = meaningfulQueryTerms(intent);
    const data = await this.rate.run(() => safeFetchJson<DeveloperEvent[]>("https://developers.events/all-events.json", { signal, approvedHosts: ["developers.events"] }));
    return data
      .filter((event) => event.name && event.hyperlink && Array.isArray(event.date) && event.date.length > 0)
      .filter((event) => {
        const start = event.date?.[0];
        const end = event.date?.[1] ?? start;
        if (!start || !end) return false;
        if (intent.datePreset !== "historical" && end < now - 3 * 60 * 60 * 1000) return false;
        const mode = modeFromLocation(event);
        if (intent.remote && mode !== "REMOTE" && mode !== "HYBRID") return false;
        if (intent.modes?.length && !intent.modes.includes(mode)) return false;
        const location = `${event.location ?? ""} ${event.city ?? ""} ${event.country ?? ""}`;
        const remoteAllowed = intent.remote || intent.modes?.some((candidate) => candidate === "REMOTE" || candidate === "HYBRID");
        if (intent.location && !locationMatches(location, intent.location) && !(remoteAllowed && (mode === "REMOTE" || mode === "HYBRID"))) return false;
        if (!terms.length) return true;
        const haystack = `${event.name} ${event.misc ?? ""} ${event.location ?? ""} ${event.city ?? ""} ${event.country ?? ""} ${normalizeTags(event.tags).join(" ")}`.toLowerCase();
        return terms.some((term) => haystack.includes(term));
      })
      .sort((a, b) => (a.date?.[0] ?? 0) - (b.date?.[0] ?? 0))
      .slice(0, limit)
      .map((event): Opportunity => {
        const title = event.name!;
        const description = cleanDescription(event.misc, title);
        const start = dateIso(event.date?.[0])!;
        const end = dateIso(event.date?.[1] ?? event.date?.[0]);
        const mode = modeFromLocation(event);
        const type = eventType(title, description);
        const location = event.location || [event.city, event.country].filter(Boolean).join(", ") || (mode === "REMOTE" ? "Online" : undefined);
        const tagLabels = normalizeTags(event.tags);
        const tags = [...new Set([type, ...tagLabels].filter(Boolean))];
        const daysAway = Math.max(0, ((event.date?.[0] ?? now) - now) / 86_400_000);
        const freshnessScore = daysAway <= 45 ? 95 : daysAway <= 120 ? 82 : 68;
        return {
          id: stableOpportunityId("developers-events", event.hyperlink!),
          title,
          description,
          shortSummary: `${type} ${mode === "REMOTE" ? "online" : location ? `in ${location}` : ""}`.trim(),
          entityType: "EVENT",
          source: "Developers Events",
          canonicalUrl: event.hyperlink!,
          registrationUrl: event.hyperlink!,
          technologies: cleanTechnologyLabels(tagLabels),
          languages: [],
          topics: tags,
          skillsRequired: [],
          difficulty: "UNKNOWN",
          beginnerFriendly: true,
          goodFirstIssue: false,
          helpWanted: false,
          activityScore: 78,
          maintainerResponsiveness: 70,
          lastActivity: start,
          location,
          mode,
          eventDate: start,
          contributionTypes: [type],
          hardware: false,
          qualityScore: location ? 84 : 76,
          freshnessScore,
          matchScore: 0,
          scrapedAt: new Date().toISOString(),
          updatedAt: start,
          metadata: { end, city: event.city, country: event.country, status: event.status, cfp: event.cfp, sourceDataset: "developers.events/all-events.json" },
        };
      });
  }

  async healthCheck(signal?: AbortSignal) {
    const started = Date.now();
    try {
      await this.rate.run(() => safeFetchJson("https://developers.events/all-events.json", { signal, approvedHosts: ["developers.events"] }));
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}
