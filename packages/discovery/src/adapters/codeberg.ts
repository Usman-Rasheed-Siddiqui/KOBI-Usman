import { calculateOpportunityScores, detectHardware, inferContributionTypes, stableOpportunityId, type Opportunity, type SearchIntent } from "@openforge/domain";
import { safeFetchJson } from "../http";
import { AdaptiveRateController } from "../rate-controller";
import type { SourceAdapter } from "../types";

type GiteaRepo = { id: number; full_name: string; html_url: string; description: string; language?: string; topics?: string[]; stars_count?: number; open_issues_count?: number; updated_at: string; owner?: { login?: string }; archived?: boolean };
type RepoSearch = { data: GiteaRepo[] };

export class CodebergAdapter implements SourceAdapter {
  id = "codeberg"; name = "Codeberg"; supportedEntityTypes = ["PROJECT", "HARDWARE_PROJECT"];
  defaultConcurrency = Number(process.env.DISCOVERY_CODEBERG_CONCURRENCY ?? 2);
  private rate = new AdaptiveRateController(this.defaultConcurrency, 80);
  async search(intent: SearchIntent, signal?: AbortSignal): Promise<Opportunity[]> {
    const q = intent.query.trim() || intent.technologies?.join(" ") || "open source";
    const limit = Math.min(intent.limit ?? (intent.hardMode ? 50 : 20), intent.hardMode ? 60 : 30);
    const response = await this.rate.run(() => safeFetchJson<RepoSearch>(`https://codeberg.org/api/v1/repos/search?q=${encodeURIComponent(q)}&limit=${limit}`, { signal, approvedHosts: ["codeberg.org"] }));
    return (response.data ?? []).map((repo) => {
      const topics = repo.topics ?? [];
      const hardware = detectHardware(repo.full_name, repo.description, topics, repo.language ?? "");
      const scores = calculateOpportunityScores({ lastActivity: repo.updated_at, stars: repo.stars_count, openIssues: repo.open_issues_count, archived: repo.archived });
      return { id: stableOpportunityId("codeberg", repo.html_url), title: repo.full_name, description: repo.description || undefined, shortSummary: repo.description || "Open-source project hosted on Codeberg", entityType: hardware ? "HARDWARE_PROJECT" : "PROJECT", source: "Codeberg", canonicalUrl: repo.html_url, repositoryUrl: repo.html_url, organization: repo.owner?.login, technologies: topics, languages: repo.language ? [repo.language] : [], topics, skillsRequired: [repo.language, ...topics].filter((x): x is string => Boolean(x)), difficulty: "UNKNOWN", beginnerFriendly: false, goodFirstIssue: false, helpWanted: false, activityScore: scores.activityScore, maintainerResponsiveness: scores.maintainerResponsiveness, lastActivity: repo.updated_at, stars: repo.stars_count, openIssues: repo.open_issues_count, contributionTypes: hardware ? inferContributionTypes(`${repo.description} ${topics.join(" ")}`) : ["General"], hardware, qualityScore: scores.qualityScore, freshnessScore: scores.freshnessScore, matchScore: 0, scrapedAt: new Date().toISOString(), updatedAt: repo.updated_at, metadata: { repositoryId: repo.id } } satisfies Opportunity;
    });
  }
  async healthCheck(signal?: AbortSignal) {
    const started = Date.now();
    try { await this.rate.run(() => safeFetchJson("https://codeberg.org/api/v1/version", { signal, approvedHosts: ["codeberg.org"] })); return { ok: true, latencyMs: Date.now() - started }; }
    catch (error) { return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Unknown error" }; }
  }
}
