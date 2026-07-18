import { calculateOpportunityScores, cleanDescription, cleanTechnologyLabels, detectHardware, inferContributionTypes, inferDifficulty, meaningfulQueryTerms, stableOpportunityId, summarizeDisplayText, type Opportunity, type SearchIntent } from "@openforge/domain";
import { safeFetchJson } from "../http";
import { AdaptiveRateController } from "../rate-controller";
import type { SourceAdapter } from "../types";

type GitLabProject = { id: number; name_with_namespace: string; web_url: string; description: string | null; topics?: string[]; star_count: number; open_issues_count?: number; last_activity_at: string; namespace?: { full_path?: string } };
type GitLabIssue = { id: number; iid: number; project_id: number; title: string; description: string | null; web_url: string; labels: string[]; updated_at: string; created_at: string; references?: { full?: string } };

const KNOWN_TECH_TERMS = new Set(["react", "next", "nextjs", "vue", "svelte", "angular", "typescript", "javascript", "python", "rust", "go", "golang", "java", "kotlin", "swift", "ai", "ml", "llm", "docker", "kubernetes"]);

function normalizeTerm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.-]+/g, "").trim();
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function containsTerm(haystack: string, term: string) {
  const normalized = haystack.toLowerCase();
  if (term === "ai") return /\b(ai|artificial intelligence|machine learning|ml|llm)\b/i.test(normalized);
  if (term === "nextjs") return /\b(next\.js|nextjs)\b/i.test(normalized);
  return normalized.includes(term.toLowerCase());
}

function requestedStrongTerms(intent: SearchIntent, terms: string[]) {
  const explicit = (intent.technologies ?? []).map(normalizeTerm).filter(Boolean);
  const known = terms.filter((term) => KNOWN_TECH_TERMS.has(term));
  return [...new Set([...explicit, ...known])];
}

export class GitLabAdapter implements SourceAdapter {
  id = "gitlab"; name = "GitLab"; supportedEntityTypes = ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT"];
  defaultConcurrency = Number(process.env.DISCOVERY_GITLAB_CONCURRENCY ?? 2);
  private rate = new AdaptiveRateController(this.defaultConcurrency, 80);
  private headers(): Record<string, string> { const token = process.env.GITLAB_TOKEN; return token ? { "private-token": token } : {}; }

  async search(intent: SearchIntent, signal?: AbortSignal): Promise<Opportunity[]> {
    const hard = Boolean(intent.hardMode);
    const limit = Math.min(intent.limit ?? (hard ? 60 : intent.fastMode ? 12 : 24), hard ? 70 : intent.fastMode ? 14 : 40);
    const terms = meaningfulQueryTerms(intent);
    const q = terms.length ? terms.join(" ") : intent.technologies?.join(" ") || "open source";
    const requiredStrongTerms = requestedStrongTerms(intent, terms);
    const [projectsResult, issuesResult] = await Promise.allSettled([
      (intent.fastMode && !hard) || intent.includeProjects === false
        ? Promise.resolve([] as GitLabProject[])
        : this.rate.run(() => safeFetchJson<GitLabProject[]>(`https://gitlab.com/api/v4/projects?search=${encodeURIComponent(q)}&simple=true&order_by=last_activity_at&sort=desc&per_page=${Math.min(limit, hard ? 40 : 20)}`, { headers: this.headers(), signal, approvedHosts: ["gitlab.com"] })),
      this.rate.run(() => safeFetchJson<GitLabIssue[]>(`https://gitlab.com/api/v4/issues?scope=all&state=opened&search=${encodeURIComponent(q)}&order_by=updated_at&sort=desc&per_page=${Math.min(limit, hard ? 40 : 20)}`, { headers: this.headers(), signal, approvedHosts: ["gitlab.com"] }))
    ]);

    if (projectsResult.status === "rejected" && issuesResult.status === "rejected") {
      throw projectsResult.reason instanceof Error ? projectsResult.reason : issuesResult.reason;
    }

    const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];
    const issues = issuesResult.status === "fulfilled" ? issuesResult.value : [];
    const p: Opportunity[] = projects.map((repo) => {
      const topics = repo.topics ?? [];
      const description = cleanDescription(repo.description, repo.name_with_namespace);
      const hardware = detectHardware(repo.name_with_namespace, description, topics);
      const scores = calculateOpportunityScores({ lastActivity: repo.last_activity_at, stars: repo.star_count, openIssues: repo.open_issues_count });
      return { id: stableOpportunityId("gitlab", repo.web_url), title: repo.name_with_namespace, description, shortSummary: summarizeDisplayText(description) ?? "GitLab open-source project", entityType: hardware ? "HARDWARE_PROJECT" as const : "PROJECT" as const, source: "GitLab", canonicalUrl: repo.web_url, repositoryUrl: repo.web_url, organization: repo.namespace?.full_path, technologies: topics, languages: [], topics, skillsRequired: topics, difficulty: "UNKNOWN", beginnerFriendly: false, goodFirstIssue: false, helpWanted: false, activityScore: scores.activityScore, maintainerResponsiveness: scores.maintainerResponsiveness, lastActivity: repo.last_activity_at, stars: repo.star_count, openIssues: repo.open_issues_count, contributionTypes: hardware ? inferContributionTypes(`${description ?? ""} ${topics.join(" ")}`) : ["General"], hardware, qualityScore: scores.qualityScore, freshnessScore: scores.freshnessScore, matchScore: 0, scrapedAt: new Date().toISOString(), updatedAt: repo.last_activity_at, metadata: { projectId: repo.id } };
    });
    const i: Opportunity[] = issues.map((issue) => {
      const labels = issue.labels ?? [];
      const goodFirst = labels.some((x) => /good first|beginner/i.test(x));
      const helpWanted = labels.some((x) => /help wanted/i.test(x));
      const description = cleanDescription(issue.description, issue.title);
      const hardware = detectHardware(issue.title, description, labels);
      const scores = calculateOpportunityScores({ lastActivity: issue.updated_at, labels, issueBodyLength: issue.description?.length ?? 0 });
      const strongText = [issue.title, issue.web_url, issue.references?.full, ...labels].filter(Boolean).join(" ");
      const matched = cleanTechnologyLabels(terms.filter((term) => containsTerm(strongText, term)));
      return { id: stableOpportunityId("gitlab", issue.web_url), title: issue.title, description, shortSummary: summarizeDisplayText(description) || `Open GitLab issue ${issue.references?.full ?? `#${issue.iid}`}`, entityType: "CONTRIBUTION" as const, source: "GitLab", canonicalUrl: issue.web_url, contributionUrl: issue.web_url, technologies: matched, languages: [], topics: labels, skillsRequired: matched, difficulty: inferDifficulty({ labels, title: issue.title, description }), beginnerFriendly: goodFirst, goodFirstIssue: goodFirst, helpWanted, activityScore: scores.activityScore, maintainerResponsiveness: scores.maintainerResponsiveness, lastActivity: issue.updated_at, contributionTypes: inferContributionTypes(`${issue.title} ${description ?? ""} ${labels.join(" ")}`), hardware, qualityScore: scores.qualityScore, freshnessScore: scores.freshnessScore, matchScore: 0, scrapedAt: new Date().toISOString(), updatedAt: issue.updated_at, metadata: { state: "open", projectId: issue.project_id, iid: issue.iid, labels } };
    }).filter((item) => !requiredStrongTerms.length || requiredStrongTerms.some((term) => containsTerm([...item.technologies, ...item.topics, item.title, item.canonicalUrl].join(" "), term)));
    return [...i, ...p].slice(0, limit);
  }

  async healthCheck(signal?: AbortSignal) {
    const started = Date.now();
    try { await this.rate.run(() => safeFetchJson("https://gitlab.com/api/v4/version", { signal, approvedHosts: ["gitlab.com"] })); return { ok: true, latencyMs: Date.now() - started }; }
    catch (error) { return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Unknown error" }; }
  }
}
