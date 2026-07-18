import { prisma, type Event, type ContributionOpportunity, type Project, type Repository, type Organization } from "@openforge/database";
import {
  calculateMatchScore,
  cleanDescription,
  cleanTechnologyLabels,
  detectHardware,
  isActiveContributionLike,
  isCurrentEvent,
  summarizeDisplayText,
  type Opportunity,
  type SearchIntent,
} from "@openforge/domain";

export type LibraryKind = "pulse" | "forge";

type EventWithOrganization = Event & { organization: Organization | null };
type ProjectWithRelations = Project & { repository: Repository | null; organization: Organization | null };

const GENRE_RULES: Array<{ label: string; terms: string[] }> = [
  { label: "AI/ML", terms: ["ai", "artificial intelligence", "machine learning", "ml", "llm", "openai", "gemini", "tensorflow", "pytorch", "langchain"] },
  { label: "React", terms: ["react", "reactjs", "react.js"] },
  { label: "Next.js", terms: ["next.js", "nextjs"] },
  { label: "JavaScript", terms: ["javascript", "node.js", "node", "express"] },
  { label: "TypeScript", terms: ["typescript", "ts"] },
  { label: "Python", terms: ["python", "django", "flask", "fastapi"] },
  { label: "Rust", terms: ["rust"] },
  { label: "Go", terms: ["go", "golang"] },
  { label: "Java", terms: ["java", "spring"] },
  { label: "Mobile", terms: ["mobile", "android", "ios", "swift", "kotlin", "react native", "expo", "flutter"] },
  { label: "Cloud", terms: ["cloud", "aws", "azure", "gcp", "serverless"] },
  { label: "DevOps", terms: ["devops", "docker", "kubernetes", "ci/cd", "terraform"] },
  { label: "Cybersecurity", terms: ["security", "cybersecurity", "infosec", "auth"] },
  { label: "Data Science", terms: ["data", "analytics", "science", "pandas", "spark"] },
  { label: "Blockchain", terms: ["blockchain", "web3", "ethereum", "solidity"] },
  { label: "Open Source", terms: ["open source", "open-source", "oss", "good first issue", "help wanted"] },
  { label: "Web Development", terms: ["web", "frontend", "backend", "fullstack", "html", "css"] },
  { label: "Design", terms: ["design", "ui", "ux", "figma"] },
  { label: "Gaming", terms: ["game", "gaming", "unity", "unreal"] },
  { label: "Hardware", terms: ["hardware", "robotics", "esp32", "arduino", "firmware", "kicad", "pcb"] },
];

function compactTerms(values: Array<string | string[] | null | undefined>) {
  return values.flatMap((value) => Array.isArray(value) ? value : [value ?? ""]).join(" ").toLowerCase();
}

export function normalizeGenres(values: Array<string | string[] | null | undefined>) {
  const haystack = compactTerms(values);
  const genres = GENRE_RULES
    .filter((rule) => rule.terms.some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack)))
    .map((rule) => rule.label);
  return [...new Set(genres)].slice(0, 5);
}

function termsFromSearch(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .filter((term) => term.length > 1);
}

function searchVariants(value: string) {
  const terms = termsFromSearch(value);
  return [...new Set([
    ...terms,
    ...terms.map((term) => term.charAt(0).toUpperCase() + term.slice(1)),
    value.trim(),
  ].filter(Boolean))];
}

function optionCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const raw of values.map((value) => value.trim()).filter(Boolean)) {
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 24)
    .map(([value, count]) => ({ value, count }));
}

function parseLimit(params: URLSearchParams, fallback = 18) {
  const raw = Number(params.get("limit") ?? fallback);
  return Number.isFinite(raw) ? Math.min(36, Math.max(1, Math.floor(raw))) : fallback;
}

function eventToOpportunity(item: EventWithOrganization): Opportunity {
  const metadata = (item.metadata as Record<string, unknown> | null) ?? undefined;
  const technologies = cleanTechnologyLabels(item.technologies);
  const description = cleanDescription(item.description, item.title);
  return {
    id: item.id,
    title: item.title,
    description,
    shortSummary: summarizeDisplayText(description),
    entityType: "EVENT",
    source: item.source,
    canonicalUrl: item.canonicalUrl,
    registrationUrl: item.registrationUrl ?? item.canonicalUrl,
    organization: item.organization?.name,
    technologies,
    languages: [],
    topics: item.topics,
    skillsRequired: [],
    difficulty: "UNKNOWN",
    beginnerFriendly: true,
    goodFirstIssue: false,
    helpWanted: false,
    activityScore: 70,
    maintainerResponsiveness: 60,
    lastActivity: item.updatedAt.toISOString(),
    location: item.location ?? undefined,
    mode: item.mode,
    eventDate: item.startsAt?.toISOString(),
    deadline: item.deadline?.toISOString(),
    contributionTypes: [item.eventType || "Event"],
    hardware: detectHardware(item.title, description, technologies, item.topics),
    qualityScore: item.qualityScore,
    freshnessScore: item.freshnessScore,
    matchScore: 0,
    scrapedAt: item.scrapedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    metadata,
  };
}

function contributionToOpportunity(item: ContributionOpportunity): Opportunity {
  const metadata = (item.metadata as Record<string, unknown> | null) ?? undefined;
  const technologies = cleanTechnologyLabels(item.technologies);
  const description = cleanDescription(item.description, item.title);
  return {
    id: item.id,
    title: item.title,
    description,
    shortSummary: summarizeDisplayText(item.shortSummary ?? description),
    entityType: "CONTRIBUTION",
    source: item.source,
    canonicalUrl: item.canonicalUrl,
    contributionUrl: item.contributionUrl,
    technologies,
    languages: item.languages,
    topics: item.topics,
    skillsRequired: item.skillsRequired,
    difficulty: item.difficulty,
    estimatedComplexity: item.estimatedComplexity ?? undefined,
    beginnerFriendly: item.beginnerFriendly,
    goodFirstIssue: item.goodFirstIssue,
    helpWanted: item.helpWanted,
    activityScore: item.activityScore,
    maintainerResponsiveness: item.maintainerResponsiveness,
    lastActivity: item.lastActivity?.toISOString(),
    contributionTypes: item.contributionTypes,
    hardware: item.hardware,
    qualityScore: item.qualityScore,
    freshnessScore: item.freshnessScore,
    matchScore: 0,
    scrapedAt: item.scrapedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    metadata,
  };
}

function projectToOpportunity(item: ProjectWithRelations): Opportunity {
  const metadata = (item.metadata as Record<string, unknown> | null) ?? undefined;
  const technologies = cleanTechnologyLabels(item.technologies);
  const description = cleanDescription(item.description, item.title);
  const hardware = item.hardware || detectHardware(item.title, description, technologies, item.topics);
  return {
    id: item.id,
    title: item.title,
    description,
    shortSummary: summarizeDisplayText(description),
    entityType: hardware ? "HARDWARE_PROJECT" : "PROJECT",
    source: "KOBI Index",
    canonicalUrl: item.canonicalUrl,
    repositoryUrl: item.repository?.repositoryUrl,
    organization: item.organization?.name,
    technologies,
    languages: item.languages,
    topics: item.topics,
    skillsRequired: [...new Set([...technologies, ...item.languages])],
    difficulty: "UNKNOWN",
    beginnerFriendly: item.beginnerScore >= 65,
    goodFirstIssue: false,
    helpWanted: false,
    activityScore: item.activityScore,
    maintainerResponsiveness: item.communityScore,
    lastActivity: item.lastActivity?.toISOString(),
    stars: item.stars ?? undefined,
    contributors: item.contributors ?? undefined,
    openIssues: item.openIssues ?? undefined,
    license: item.license ?? undefined,
    contributionTypes: hardware ? ["Hardware", "General"] : ["Project"],
    hardware,
    qualityScore: item.qualityScore,
    freshnessScore: item.freshnessScore,
    matchScore: 0,
    scrapedAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    metadata,
  };
}

function fallbackSearch<T extends { title: string; description: string | null; technologies: string[]; topics: string[] }>(items: T[], q: string) {
  const terms = termsFromSearch(q);
  if (!terms.length) return items;
  return items.filter((item) => {
    const haystack = compactTerms([item.title, item.description, item.technologies, item.topics]);
    return terms.some((term) => haystack.includes(term));
  });
}

function hasGenre(item: Opportunity, genre: string | null) {
  if (!genre) return true;
  return normalizeGenres([item.title, item.description, item.technologies, item.languages, item.topics, item.contributionTypes]).includes(genre);
}

export async function searchPulseLibrary(params: URLSearchParams) {
  const limit = parseLimit(params);
  const cursor = params.get("cursor") || undefined;
  const q = (params.get("q") ?? "").trim();
  const genre = params.get("genre");
  const timeframe = params.get("timeframe") ?? "upcoming";
  const mode = params.get("mode");
  const eventType = params.get("eventType");
  const location = (params.get("location") ?? "").trim();
  const now = new Date();
  const soon = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const week = new Date(now.getTime() + 7 * 86_400_000);
  const month = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const andFilters = [];
  if (location) {
    andFilters.push({ OR: [{ location: { contains: location, mode: "insensitive" as const } }, { city: { contains: location, mode: "insensitive" as const } }, { country: { contains: location, mode: "insensitive" as const } }] });
  }
  if (q) {
    const variants = searchVariants(q);
    andFilters.push({ OR: [
      { title: { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } },
      { location: { contains: q, mode: "insensitive" as const } },
      { technologies: { hasSome: variants } },
      { topics: { hasSome: variants } },
    ] });
  }

  const where = {
    ...(timeframe === "historical"
      ? { startsAt: { lt: soon } }
      : timeframe === "all"
        ? {}
        : { startsAt: { gte: soon, ...(timeframe === "week" ? { lte: week } : timeframe === "month" ? { lte: month } : {}) } }),
    ...(mode && mode !== "ALL" ? { mode: mode as "REMOTE" | "PHYSICAL" | "HYBRID" | "UNKNOWN" } : {}),
    ...(eventType ? { eventType: { contains: eventType, mode: "insensitive" as const } } : {}),
    ...(andFilters.length ? { AND: andFilters } : {}),
  };

  const rows = await prisma.event.findMany({
    where,
    include: { organization: true },
    orderBy: timeframe === "historical" ? [{ startsAt: "desc" }, { qualityScore: "desc" }] : [{ startsAt: "asc" }, { qualityScore: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit * 3 + 1,
  });

  const intent: SearchIntent = { query: q, contentType: "pulse", entityTypes: ["EVENT"], datePreset: timeframe === "historical" ? "historical" : "upcoming" };
  const filtered = fallbackSearch(rows, q)
    .map(eventToOpportunity)
    .filter((item) => hasGenre(item, genre))
    .filter((item) => isCurrentEvent(item, intent) || timeframe === "historical" || timeframe === "all")
    .slice(0, limit + 1);

  const items = filtered.slice(0, limit).map((item) => ({ ...item, matchScore: calculateMatchScore(item) }));
  const facetRows = await prisma.event.findMany({ where, include: { organization: true }, orderBy: [{ updatedAt: "desc" }], take: 500 });
  const facetItems = fallbackSearch(facetRows, q).map(eventToOpportunity);

  return {
    items,
    nextCursor: filtered.length > limit ? filtered[limit]?.id : null,
    facets: {
      genres: optionCounts(facetItems.flatMap((item) => normalizeGenres([item.title, item.description, item.technologies, item.topics, item.contributionTypes]))),
      eventTypes: optionCounts(facetItems.flatMap((item) => item.contributionTypes)),
      countries: optionCounts(facetRows.map((item) => item.country ?? item.location ?? "").filter(Boolean)),
      modes: optionCounts(facetItems.map((item) => item.mode ?? "UNKNOWN")),
    },
  };
}

export async function searchForgeLibrary(params: URLSearchParams) {
  const limit = parseLimit(params);
  const cursor = params.get("cursor") || undefined;
  const q = (params.get("q") ?? "").trim();
  const genre = params.get("genre");
  const language = params.get("language");
  const difficulty = params.get("difficulty");
  const freshnessDays = Number(params.get("freshnessDays") ?? 180);
  const label = params.get("label");
  const includeProjects = params.get("includeProjects") !== "false";
  const cutoff = Number.isFinite(freshnessDays) && freshnessDays > 0
    ? new Date(Date.now() - freshnessDays * 86_400_000)
    : undefined;

  const variants = searchVariants(q);
  const commonOr = q ? [
    { title: { contains: q, mode: "insensitive" as const } },
    { description: { contains: q, mode: "insensitive" as const } },
    { technologies: { hasSome: variants } },
    { languages: { hasSome: variants } },
    { topics: { hasSome: variants } },
  ] : undefined;
  const contributions = await prisma.contributionOpportunity.findMany({
    where: {
      ...(commonOr ? { OR: [...commonOr, { shortSummary: { contains: q, mode: "insensitive" as const } }] } : {}),
      ...(language ? { languages: { has: language } } : {}),
      ...(difficulty ? { difficulty: difficulty as "STARTING" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "UNKNOWN" } : {}),
      ...(label === "good-first-issue" ? { goodFirstIssue: true } : label === "help-wanted" ? { helpWanted: true } : {}),
      ...(cutoff ? { lastActivity: { gte: cutoff } } : {}),
    },
    orderBy: [{ qualityScore: "desc" }, { lastActivity: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit * 3 + 1,
  });

  const projects = includeProjects && !cursor ? await prisma.project.findMany({
    where: {
      ...(commonOr ? { OR: commonOr } : {}),
      ...(language ? { languages: { has: language } } : {}),
      ...(cutoff ? { lastActivity: { gte: cutoff } } : {}),
      archived: false,
    },
    include: { repository: true, organization: true },
    orderBy: [{ qualityScore: "desc" }, { lastActivity: "desc" }],
    take: Math.max(4, Math.floor(limit / 3)),
  }) : [];

  const intent: SearchIntent = { query: q, contentType: "forge", entityTypes: ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT"], issueStatus: "open", updatedWithinDays: freshnessDays || undefined };
  const contributionItems = fallbackSearch(contributions, q)
    .map(contributionToOpportunity)
    .filter((item) => isActiveContributionLike(item, intent))
    .filter((item) => hasGenre(item, genre));
  const projectItems = fallbackSearch(projects, q)
    .map(projectToOpportunity)
    .filter((item) => hasGenre(item, genre));
  const merged = [...contributionItems, ...projectItems]
    .sort((a, b) => calculateMatchScore(b) - calculateMatchScore(a) || b.freshnessScore - a.freshnessScore)
    .slice(0, limit + 1);

  const items = merged.slice(0, limit).map((item) => ({ ...item, matchScore: calculateMatchScore(item) }));
  const facetContributions = await prisma.contributionOpportunity.findMany({ orderBy: [{ lastActivity: "desc" }], take: 500 });
  const facetProjects = includeProjects ? await prisma.project.findMany({ where: { archived: false }, include: { repository: true, organization: true }, orderBy: [{ lastActivity: "desc" }], take: 200 }) : [];
  const facetItems = [...facetContributions.map(contributionToOpportunity), ...facetProjects.map(projectToOpportunity)].filter((item) => isActiveContributionLike(item, intent));

  return {
    items,
    nextCursor: merged.length > limit ? contributionItems[Math.min(contributionItems.length - 1, limit)]?.id ?? null : null,
    facets: {
      genres: optionCounts(facetItems.flatMap((item) => normalizeGenres([item.title, item.description, item.technologies, item.languages, item.topics, item.contributionTypes]))),
      languages: optionCounts(facetItems.flatMap((item) => item.languages)),
      difficulties: optionCounts(facetItems.map((item) => item.difficulty).filter((item) => item !== "UNKNOWN")),
      labels: optionCounts(facetItems.flatMap((item) => [item.goodFirstIssue ? "good-first-issue" : "", item.helpWanted ? "help-wanted" : "", ...item.topics]).filter(Boolean)),
    },
  };
}
