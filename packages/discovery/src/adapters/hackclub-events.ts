import { locationMatches, meaningfulQueryTerms, stableOpportunityId, type Opportunity, type SearchIntent } from "@openforge/domain";
import { safeFetchJson } from "../http";
import { AdaptiveRateController } from "../rate-controller";
import type { SourceAdapter } from "../types";

type HackEvent = {
  id: string;
  name: string;
  website: string;
  start: string;
  end: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  virtual?: boolean;
  hybrid?: boolean;
  logo?: string;
  banner?: string;
};

export class HackClubEventsAdapter implements SourceAdapter {
  id = "hackclub";
  name = "Hack Club Hackathons";
  supportedEntityTypes = ["EVENT"];
  defaultConcurrency = Number(process.env.DISCOVERY_EVENT_CONCURRENCY ?? 2);
  private rate = new AdaptiveRateController(this.defaultConcurrency, 80);

  async search(intent: SearchIntent, signal?: AbortSignal): Promise<Opportunity[]> {
    const events = await this.rate.run(() => safeFetchJson<HackEvent[]>("https://hackathons.hackclub.com/api/events/upcoming", { signal, approvedHosts: ["hackathons.hackclub.com"] }));
    const terms = meaningfulQueryTerms(intent);
    return events
      .filter((event) => {
        const haystack = `${event.name} ${event.city ?? ""} ${event.state ?? ""} ${event.country ?? ""}`.toLowerCase();
        const queryOk = !terms.length || terms.some((term) => haystack.includes(term));
        const remoteAllowed = intent.remote || intent.modes?.some((mode) => mode === "REMOTE" || mode === "HYBRID");
        const locationOk = !intent.location || locationMatches(haystack, intent.location) || (remoteAllowed && (event.virtual || event.hybrid));
        return queryOk && locationOk;
      })
      .slice(0, intent.limit ?? 30)
      .map((event) => {
        const location = [event.city, event.state, event.country].filter(Boolean).join(", ");
        const mode = event.hybrid ? "HYBRID" : event.virtual ? "REMOTE" : "PHYSICAL";
        const dateLabel = new Date(event.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return {
          id: stableOpportunityId("hackclub", event.website || `https://hackathons.hackclub.com/events/${event.id}`),
          title: event.name,
          shortSummary: `${mode === "REMOTE" ? "Online" : location || "Hackathon"} - ${dateLabel}`,
          entityType: "EVENT",
          source: "Hack Club Hackathons",
          canonicalUrl: event.website || "https://hackathons.hackclub.com/",
          registrationUrl: event.website,
          technologies: [],
          languages: [],
          topics: ["Hackathon", "Open Source", "Collaboration"],
          skillsRequired: [],
          difficulty: "UNKNOWN",
          beginnerFriendly: true,
          goodFirstIssue: false,
          helpWanted: false,
          activityScore: 80,
          maintainerResponsiveness: 70,
          lastActivity: event.start,
          location,
          mode,
          eventDate: event.start,
          contributionTypes: ["Hackathon"],
          hardware: false,
          qualityScore: 82,
          freshnessScore: 90,
          matchScore: 0,
          scrapedAt: new Date().toISOString(),
          updatedAt: event.start,
          metadata: { end: event.end, city: event.city, state: event.state, country: event.country, virtual: event.virtual, hybrid: event.hybrid, credit: "Hack Club Hackathons", creditUrl: "https://hackathons.hackclub.com" },
        } satisfies Opportunity;
      });
  }

  async healthCheck(signal?: AbortSignal) {
    const started = Date.now();
    try {
      await this.rate.run(() => safeFetchJson("https://hackathons.hackclub.com/api/events/upcoming", { signal, approvedHosts: ["hackathons.hackclub.com"] }));
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}
