import {
  calculateOpportunityScores, cleanDescription, cleanTechnologyLabels, detectHardware, inferContributionTypes, inferDifficulty, meaningfulQueryTerms,
  stableOpportunityId, summarizeDisplayText, type Opportunity, type SearchIntent
} from "@openforge/domain";
import { AdaptiveRateController } from "../rate-controller";
import { safeFetchJson } from "../http";
import type { SourceAdapter } from "../types";

type GithubIssue = {
  id: number; number: number; title: string; body: string | null; html_url: string; repository_url: string;
  labels: Array<{ name?: string } | string>; updated_at: string; created_at: string; comments: number;
  assignees?: Array<{ login?: string }>;
};
type GithubSearch<T> = { total_count: number; items: T[] };
type GithubRepo = {
  id: number; name: string; full_name: string; html_url: string; description: string | null; language: string | null;
  topics?: string[]; stargazers_count: number; open_issues_count: number; updated_at: string; pushed_at: string;
  archived: boolean; license: { spdx_id?: string } | null; owner: { login: string };
};

const LANGUAGE_QUALIFIERS = new Map([
  ["typescript", "TypeScript"], ["javascript", "JavaScript"], ["python", "Python"], ["rust", "Rust"],
  ["go", "Go"], ["golang", "Go"], ["java", "Java"], ["kotlin", "Kotlin"], ["swift", "Swift"],
  ["php", "PHP"], ["ruby", "Ruby"], ["csharp", "C#"], ["c#", "C#"], ["cpp", "C++"], ["c++", "C++"]
]);

const KNOWN_TECH_TERMS = new Set([
  "react", "next", "nextjs", "vue", "svelte", "angular", "typescript", "javascript", "python", "rust", "go",
  "golang", "java", "kotlin", "swift", "php", "ruby", "django", "flask", "fastapi", "node", "nodejs", "express",
  "ai", "ml", "llm", "gemini", "openai", "tensorflow", "pytorch", "prisma", "postgres", "supabase", "neon",
  "expo", "react-native", "tailwind", "graphql", "docker", "kubernetes"
]);

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
  if (term === "nodejs") return /\b(node\.js|nodejs)\b/i.test(normalized);
  return normalized.includes(term.toLowerCase());
}

function requestedStrongTerms(intent: SearchIntent, terms: string[]) {
  const explicit = (intent.technologies ?? []).map(normalizeTerm).filter(Boolean);
  const known = terms.filter((term) => KNOWN_TECH_TERMS.has(term));
  return [...new Set([...explicit, ...known])];
}

function extractTechnologyEvidence(input: { terms: string[]; title: string; labels: string[]; repoPath: string; repo?: GithubRepo }) {
  const repo = input.repo;
  const topics = repo?.topics ?? [];
  const strongText = [
    input.title,
    input.repoPath,
    repo?.name,
    repo?.full_name,
    repo?.language,
    repo?.description,
    ...topics,
    ...input.labels,
  ].filter(Boolean).join(" ");
  const matched = input.terms.filter((term) => containsTerm(strongText, term));
  const language = repo?.language ? [repo.language] : [];
  const technicalTopics = topics.filter((topic) => KNOWN_TECH_TERMS.has(normalizeTerm(topic)));
  return {
    technologies: cleanTechnologyLabels(unique([...matched, ...technicalTopics])),
    languages: language,
    strongText,
  };
}

export class GitHubAdapter implements SourceAdapter {
  id = "github";
  name = "GitHub";
  supportedEntityTypes = ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT"];
  defaultConcurrency = Number(process.env.DISCOVERY_GITHUB_CONCURRENCY ?? 1);
  private rate = new AdaptiveRateController(this.defaultConcurrency, 120);

  private headers() {
    return {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
    };
  }

  async search(intent: SearchIntent, signal?: AbortSignal): Promise<Opportunity[]> {
    const hard = Boolean(intent.hardMode);
    const limit = Math.min(intent.limit ?? (hard ? 70 : intent.fastMode ? 16 : 28), hard ? 80 : intent.fastMode ? 18 : 50);
    const terms = meaningfulQueryTerms(intent);
    const q = terms.length ? terms.join(" ") : intent.technologies?.join(" ") || intent.skills?.join(" ") || "open source";
    const languageQualifiers = terms
      .map((term) => LANGUAGE_QUALIFIERS.get(term))
      .filter((term): term is string => Boolean(term))
      .map((term) => `language:${term}`);
    const issueQualifiers = ["is:issue", "is:open"];
    if (intent.goodFirstIssue || intent.beginnerFriendly) issueQualifiers.push('label:"good first issue"');
    if (intent.helpWanted) issueQualifiers.push('label:"help wanted"');
    if (intent.updatedWithinDays) {
      const date = new Date(Date.now() - intent.updatedWithinDays * 86_400_000).toISOString().slice(0, 10);
      issueQualifiers.push(`updated:>=${date}`);
    }
    const issueQuery = encodeURIComponent(`${q} ${issueQualifiers.join(" ")} ${languageQualifiers.join(" ")}`);
    const repoQuery = encodeURIComponent(`${q} archived:false ${languageQualifiers.join(" ")}`);

    const [issuesResult, reposResult] = await Promise.allSettled([
      this.rate.run(() => safeFetchJson<GithubSearch<GithubIssue>>(`https://api.github.com/search/issues?q=${issueQuery}&sort=updated&order=desc&per_page=${Math.min(limit, hard ? 50 : 30)}`, { headers: this.headers(), signal, approvedHosts: ["api.github.com"] })),
      (intent.fastMode && !hard) || intent.includeProjects === false
        ? Promise.resolve({ total_count: 0, items: [] } as GithubSearch<GithubRepo>)
        : this.rate.run(() => safeFetchJson<GithubSearch<GithubRepo>>(`https://api.github.com/search/repositories?q=${repoQuery}&sort=updated&order=desc&per_page=${Math.min(hard ? 24 : 10, limit)}`, { headers: this.headers(), signal, approvedHosts: ["api.github.com"] }))
    ]);

    if (issuesResult.status === "rejected" && reposResult.status === "rejected") {
      throw issuesResult.reason instanceof Error ? issuesResult.reason : reposResult.reason;
    }

    const issues: GithubSearch<GithubIssue> = issuesResult.status === "fulfilled"
      ? issuesResult.value
      : { total_count: 0, items: [] };
    const repos: GithubSearch<GithubRepo> = reposResult.status === "fulfilled"
      ? reposResult.value
      : { total_count: 0, items: [] };
    const repoPaths = [...new Set(issues.items.map((issue) => issue.repository_url.replace("https://api.github.com/repos/", "")))].slice(0, Math.min(limit, hard ? 40 : 20));
    const repoDetails = new Map<string, GithubRepo>();
    await Promise.allSettled(repoPaths.map(async (repoPath) => {
      const repo = await this.rate.run(() => safeFetchJson<GithubRepo>(`https://api.github.com/repos/${repoPath}`, { headers: this.headers(), signal, approvedHosts: ["api.github.com"] }));
      repoDetails.set(repoPath, repo);
    }));
    const requiredStrongTerms = requestedStrongTerms(intent, terms);

    const issueItems: Opportunity[] = issues.items.map((issue) => {
      const labels = issue.labels.map((label) => typeof label === "string" ? label : label.name ?? "").filter(Boolean);
      const repoPath = issue.repository_url.replace("https://api.github.com/repos/", "");
      const repoUrl = `https://github.com/${repoPath}`;
      const repo = repoDetails.get(repoPath);
      const evidence = extractTechnologyEvidence({ terms, title: issue.title, labels, repoPath, repo });
      const description = cleanDescription(issue.body, issue.title);
      const hardware = detectHardware(issue.title, description, labels);
      const difficulty = inferDifficulty({ labels, title: issue.title, description });
      const scores = calculateOpportunityScores({ lastActivity: issue.updated_at, labels, issueBodyLength: issue.body?.length ?? 0 });
      const goodFirstIssue = labels.some((l) => /good first issue/i.test(l));
      const helpWanted = labels.some((l) => /help wanted/i.test(l));
      return {
        id: stableOpportunityId("github", issue.html_url), title: issue.title, description,
        shortSummary: summarizeDisplayText(description) || `Open GitHub issue #${issue.number} in ${repoPath}`,
        entityType: "CONTRIBUTION" as const, source: "GitHub", canonicalUrl: issue.html_url, repositoryUrl: repoUrl, contributionUrl: issue.html_url,
        organization: repoPath.split("/")[0], technologies: evidence.technologies, languages: evidence.languages, topics: unique([...labels, ...(repo?.topics ?? [])]), skillsRequired: unique([...evidence.technologies, ...evidence.languages]), difficulty,
        beginnerFriendly: goodFirstIssue || difficulty === "BEGINNER", goodFirstIssue, helpWanted,
        activityScore: scores.activityScore, maintainerResponsiveness: scores.maintainerResponsiveness, lastActivity: issue.updated_at,
        contributionTypes: inferContributionTypes(`${issue.title} ${issue.body ?? ""} ${labels.join(" ")}`), hardware,
        qualityScore: scores.qualityScore, freshnessScore: scores.freshnessScore, matchScore: 0,
        scrapedAt: new Date().toISOString(), updatedAt: issue.updated_at,
        stars: repo?.stargazers_count,
        openIssues: repo?.open_issues_count,
        license: repo?.license?.spdx_id,
        metadata: { state: "open", issueNumber: issue.number, comments: issue.comments, repository: repoPath, labels, assignees: issue.assignees?.map((assignee) => assignee.login).filter(Boolean) ?? [], technologyEvidence: evidence.strongText.slice(0, 500) }
      };
    }).filter((item) => !requiredStrongTerms.length || requiredStrongTerms.some((term) => containsTerm([...item.technologies, ...item.languages, ...item.topics, item.title, item.repositoryUrl].filter(Boolean).join(" "), term)));

    const projectItems: Opportunity[] = repos.items.map((repo) => {
      const topics = repo.topics ?? [];
      const description = cleanDescription(repo.description, repo.full_name);
      const hardware = detectHardware(repo.name, description, topics, repo.language ?? "");
      const scores = calculateOpportunityScores({ lastActivity: repo.pushed_at || repo.updated_at, stars: repo.stargazers_count, openIssues: repo.open_issues_count, archived: repo.archived });
      return {
        id: stableOpportunityId("github", repo.html_url), title: repo.full_name, description,
        shortSummary: summarizeDisplayText(description) ?? `Open-source repository maintained by ${repo.owner.login}`,
        entityType: hardware ? "HARDWARE_PROJECT" as const : "PROJECT" as const, source: "GitHub", canonicalUrl: repo.html_url, repositoryUrl: repo.html_url,
        organization: repo.owner.login, technologies: topics, languages: repo.language ? [repo.language] : [], topics, skillsRequired: [repo.language, ...topics].filter((x): x is string => Boolean(x)), difficulty: "UNKNOWN",
        beginnerFriendly: false, goodFirstIssue: false, helpWanted: false, activityScore: scores.activityScore,
        maintainerResponsiveness: scores.maintainerResponsiveness, lastActivity: repo.pushed_at || repo.updated_at,
        stars: repo.stargazers_count, openIssues: repo.open_issues_count, license: repo.license?.spdx_id,
        contributionTypes: hardware ? inferContributionTypes(`${repo.description ?? ""} ${topics.join(" ")}`) : ["General"], hardware,
        qualityScore: scores.qualityScore, freshnessScore: scores.freshnessScore, matchScore: 0,
        scrapedAt: new Date().toISOString(), updatedAt: repo.updated_at, metadata: { fullName: repo.full_name, archived: repo.archived }
      };
    });
    return [...issueItems, ...projectItems].slice(0, limit);
  }

  async healthCheck(signal?: AbortSignal) {
    const started = Date.now();
    try {
      await this.rate.run(() => safeFetchJson("https://api.github.com/rate_limit", { headers: this.headers(), signal, approvedHosts: ["api.github.com"] }));
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}
