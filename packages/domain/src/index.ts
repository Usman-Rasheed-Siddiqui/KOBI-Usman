import { z } from "zod";

export const EntityTypeSchema = z.enum([
  "PROJECT",
  "CONTRIBUTION",
  "EVENT",
  "HARDWARE_PROJECT",
  "COLLABORATION_REQUEST",
  "ORGANIZATION"
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const DifficultySchema = z.enum(["STARTING", "BEGINNER", "INTERMEDIATE", "ADVANCED", "UNKNOWN"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export type Opportunity = {
  id: string;
  title: string;
  description?: string;
  shortSummary?: string;
  entityType: EntityType;
  source: string;
  canonicalUrl: string;
  repositoryUrl?: string;
  contributionUrl?: string;
  organization?: string;
  technologies: string[];
  languages: string[];
  topics: string[];
  skillsRequired: string[];
  difficulty: Difficulty;
  estimatedComplexity?: string;
  beginnerFriendly: boolean;
  goodFirstIssue: boolean;
  helpWanted: boolean;
  activityScore: number;
  maintainerResponsiveness: number;
  lastActivity?: string;
  stars?: number;
  contributors?: number;
  openIssues?: number;
  license?: string;
  location?: string;
  mode?: "REMOTE" | "PHYSICAL" | "HYBRID" | "UNKNOWN";
  eventDate?: string;
  deadline?: string;
  registrationUrl?: string;
  contributionTypes: string[];
  hardware: boolean;
  qualityScore: number;
  freshnessScore: number;
  matchScore: number;
  scrapedAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type SearchIntent = {
  query: string;
  contentType?: "all" | "pulse" | "forge";
  fastMode?: boolean;
  hardMode?: boolean;
  skills?: string[];
  technologies?: string[];
  difficulty?: Difficulty[];
  entityTypes?: EntityType[];
  beginnerFriendly?: boolean;
  goodFirstIssue?: boolean;
  helpWanted?: boolean;
  hardware?: boolean;
  remote?: boolean;
  hiddenGems?: boolean;
  likelySmallScope?: boolean;
  updatedWithinDays?: number;
  datePreset?: "upcoming" | "week" | "month" | "historical" | "custom";
  eventTypes?: string[];
  modes?: Array<"REMOTE" | "PHYSICAL" | "HYBRID" | "UNKNOWN">;
  issueStatus?: "open" | "closed" | "all";
  includeProjects?: boolean;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  sources?: string[];
  limit?: number;
};

export const SearchIntentSchema: z.ZodType<SearchIntent> = z.object({
  query: z.string().trim().max(400).default(""),
  contentType: z.enum(["all", "pulse", "forge"]).optional(),
  fastMode: z.boolean().optional(),
  hardMode: z.boolean().optional(),
  skills: z.array(z.string().trim().max(80)).optional(),
  technologies: z.array(z.string().trim().max(80)).optional(),
  difficulty: z.array(DifficultySchema).optional(),
  entityTypes: z.array(EntityTypeSchema).optional(),
  beginnerFriendly: z.boolean().optional(),
  goodFirstIssue: z.boolean().optional(),
  helpWanted: z.boolean().optional(),
  hardware: z.boolean().optional(),
  remote: z.boolean().optional(),
  hiddenGems: z.boolean().optional(),
  likelySmallScope: z.boolean().optional(),
  updatedWithinDays: z.number().int().positive().max(3650).optional(),
  datePreset: z.enum(["upcoming", "week", "month", "historical", "custom"]).optional(),
  eventTypes: z.array(z.string().trim().max(80)).optional(),
  modes: z.array(z.enum(["REMOTE", "PHYSICAL", "HYBRID", "UNKNOWN"])).optional(),
  issueStatus: z.enum(["open", "closed", "all"]).optional(),
  includeProjects: z.boolean().optional(),
  location: z.string().trim().max(120).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sources: z.array(z.string().trim().max(50)).optional(),
  limit: z.number().int().min(1).max(100).optional()
});

const HARDWARE_SIGNALS = [
  "kicad", "pcb", "gerber", "schematic", "schematics", "step", "stl", "cad",
  "verilog", "vhdl", "arduino", "esp32", "firmware", "robotics", "robot", "electronics",
  "iot", "3d printing", "3d-print", "mechanical", "fpga", "risc-v", "embedded", "hardware"
];

const SMALL_SCOPE_SIGNALS = [
  "documentation", "docs", "readme", "typo", "translation", "accessibility label", "test",
  "small", "minor", "good first issue", "beginner", "copy", "text"
];

const GENERIC_QUERY_TERMS = new Set([
  "a", "an", "and", "are", "can", "find", "for", "from", "i", "in", "me", "my", "near", "of",
  "ones", "only", "open", "opensource", "open-source", "please", "show", "that", "the", "to",
  "updated", "recent", "recently", "active", "current", "available", "still", "upcoming", "happening",
  "event", "events", "conference", "conferences", "hackathon", "hackathons", "meetup", "meetups",
  "workshop", "workshops", "developer", "developers", "tech", "technology",
  "contribution", "contributions", "contribute", "issue", "issues", "project", "projects", "looking",
  "beginner", "beginner-friendly", "friendly", "first", "good", "good-first", "good-first-issue", "help", "help-wanted", "wanted", "next", "this", "week", "month",
  "online", "remote", "hybrid", "person", "in-person"
]);

const NON_TECH_BADGE_TERMS = new Set([
  "beginner", "beginner-friendly", "community", "contribute", "contribution", "contributions-welcome",
  "first-contributions", "first-timers-only", "friendly", "good-first", "good-first-contribution",
  "good-first-issue", "good-first-pr", "hacktoberfest", "help-wanted", "japanese", "japanese-language",
  "language-learning", "learn-japanese", "open-source", "up-for-grabs", "english"
]);

const LOCATION_ALIASES: Record<string, string[]> = {
  karachi: ["karachi", "karachi pakistan", "karachi sindh"],
  lahore: ["lahore", "lahore pakistan", "lahore punjab"],
  islamabad: ["islamabad", "islamabad pakistan"],
  rawalpindi: ["rawalpindi", "rawalpindi pakistan", "pindi"],
  peshawar: ["peshawar", "peshawar pakistan", "peshawar khyber pakhtunkhwa", "peshawar kpk"],
  faisalabad: ["faisalabad", "faisalabad pakistan"],
  europe: [
    "albania", "andorra", "armenia", "austria", "azerbaijan", "belarus", "belgium", "bosnia", "bulgaria",
    "croatia", "cyprus", "czech", "denmark", "estonia", "finland", "france", "georgia", "germany", "greece",
    "hungary", "iceland", "ireland", "italy", "kosovo", "latvia", "liechtenstein", "lithuania", "luxembourg",
    "malta", "moldova", "monaco", "montenegro", "netherlands", "norway", "poland", "portugal", "romania",
    "serbia", "slovakia", "slovenia", "spain", "sweden", "switzerland", "turkey", "ukraine", "united kingdom",
    "uk", "england", "scotland", "wales"
  ],
  sindh: ["sindh", "karachi"],
  punjab: ["punjab", "lahore", "rawalpindi", "faisalabad"],
  pakistan: ["pakistan", "pk", "karachi", "lahore", "islamabad", "rawalpindi", "pindi", "peshawar", "faisalabad", "sindh", "punjab"],
  dubai: ["dubai", "united arab emirates", "uae"],
  "united states": ["united states", "usa", "us", "america"],
  usa: ["united states", "usa", "us", "america"],
  "north america": ["united states", "usa", "canada", "mexico"],
  asia: ["pakistan", "india", "china", "japan", "singapore", "malaysia", "indonesia", "thailand", "vietnam", "philippines", "bangladesh", "sri lanka", "nepal", "uae", "united arab emirates"],
  "middle east": ["uae", "united arab emirates", "saudi arabia", "qatar", "bahrain", "kuwait", "oman", "jordan", "lebanon", "egypt"],
  mena: ["uae", "united arab emirates", "saudi arabia", "qatar", "bahrain", "kuwait", "oman", "jordan", "lebanon", "egypt", "morocco", "tunisia", "algeria"]
};

const CITY_LOCATION_TERMS = new Set(["karachi", "lahore", "islamabad", "rawalpindi", "pindi", "peshawar", "faisalabad", "dubai"]);
const COUNTRY_LOCATION_TERMS = new Set(["pakistan", "pk", "united arab emirates", "uae", "united states", "usa", "us", "america"]);
const REGION_LOCATION_TERMS = new Set(["europe", "asia", "middle east", "mena", "north america", "sindh", "punjab"]);

function canonicalTerm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.-]+/g, "").trim();
}

export function meaningfulQueryTerms(intent: SearchIntent): string[] {
  const locationTerms = new Set(
    (intent.location ?? "")
      .toLowerCase()
      .split(/[^a-z0-9+#.-]+/)
      .map(canonicalTerm)
      .filter(Boolean)
  );
  const raw = [
    ...intent.query.toLowerCase().split(/[^a-z0-9+#.-]+/),
    ...(intent.technologies ?? []),
    ...(intent.skills ?? []),
    ...(intent.eventTypes ?? []),
  ];
  return [...new Set(raw.map(canonicalTerm).filter((term) => term.length > 1 && !GENERIC_QUERY_TERMS.has(term) && !locationTerms.has(term)))];
}

export function cleanTechnologyLabels(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean).filter((value) => !NON_TECH_BADGE_TERMS.has(canonicalTerm(value))))];
}

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  quot: "\"",
  rsquo: "'",
  lsquo: "'",
  rdquo: "\"",
  ldquo: "\"",
};

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return HTML_ENTITY_MAP[lower] ?? match;
  });
}

export function cleanDisplayText(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const withImageAlts = value.replace(/<img\b[^>]*\balt\s*=\s*(["'])(.*?)\1[^>]*>/gis, " $2 ");
  const withoutNoise = withImageAlts
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/<\/?(?:br|p|div|li|ul|ol|section|article|header|footer|h[1-6]|blockquote|tr|td|th|table)\b[^>]*>/gi, " ")
    .replace(/<\/?[a-z][a-z0-9:-]*(?:\s[^<>]*)?>/gi, " ");
  const decoded = decodeHtmlEntities(withoutNoise);
  const normalized = decoded
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[ \t]*\n+[ \t]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || undefined;
}

export function cleanDescription(value: string | null | undefined, title?: string): string | undefined {
  const text = cleanDisplayText(value);
  if (!text) return undefined;
  const textKey = canonicalTerm(text);
  const titleKey = canonicalTerm(title ?? "");
  if (titleKey && (textKey === titleKey || textKey === `cfp${titleKey}` || textKey === `callforpapers${titleKey}`)) return undefined;
  const titleLength = title?.length ?? 0;
  if (/^cfp\b/i.test(text) && titleKey && textKey.endsWith(titleKey) && text.length <= titleLength + 12) return undefined;
  return text;
}

export function summarizeDisplayText(value: string | null | undefined, maxLength = 220): string | undefined {
  const text = cleanDisplayText(value);
  if (!text) return undefined;
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : text;
}

function normalizeLocation(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.-]+/g, " ").replace(/\s+/g, " ").trim();
}

function canonicalLocationKey(value: string) {
  const normalized = normalizeLocation(value);
  const direct = Object.entries(LOCATION_ALIASES).find(([key, aliases]) => key === normalized || aliases.map(normalizeLocation).includes(normalized));
  return direct?.[0] ?? normalized;
}

function locationRequestSpecificity(requested: string): "city" | "country" | "region" | "unknown" {
  const key = canonicalLocationKey(requested);
  if (CITY_LOCATION_TERMS.has(key)) return "city";
  if (COUNTRY_LOCATION_TERMS.has(key)) return "country";
  if (REGION_LOCATION_TERMS.has(key)) return "region";
  return "unknown";
}

export function locationMatchScore(location: string | undefined, requested: string | undefined): number {
  if (!requested?.trim()) return 0;
  const haystack = normalizeLocation(location ?? "");
  const needle = normalizeLocation(requested);
  if (!haystack || !needle) return 0;

  if (haystack === needle) return 100;
  if (haystack.includes(needle)) return locationRequestSpecificity(requested) === "city" ? 100 : 92;

  const key = canonicalLocationKey(requested);
  const aliases = LOCATION_ALIASES[key] ?? LOCATION_ALIASES[needle] ?? [];
  for (const alias of aliases) {
    const normalizedAlias = normalizeLocation(alias);
    if (!normalizedAlias) continue;
    if (haystack === normalizedAlias) return 95;
    if (haystack.includes(normalizedAlias)) {
      const specificity = locationRequestSpecificity(requested);
      if (specificity === "city") return 90;
      if (specificity === "country") return COUNTRY_LOCATION_TERMS.has(normalizedAlias) ? 95 : 82;
      return 74;
    }
  }
  return 0;
}

export function locationMatches(location: string | undefined, requested: string | undefined): boolean {
  if (!requested?.trim()) return true;
  return locationMatchScore(location, requested) >= 70;
}

export function detectHardware(...values: Array<string | string[] | undefined>): boolean {
  const haystack = values.flatMap((v) => Array.isArray(v) ? v : [v ?? ""]).join(" ").toLowerCase();
  return HARDWARE_SIGNALS.some((signal) => haystack.includes(signal));
}

export function inferDifficulty(input: {
  labels?: string[];
  title?: string;
  description?: string;
  fileCount?: number;
}): Difficulty {
  const text = [...(input.labels ?? []), input.title ?? "", input.description ?? ""].join(" ").toLowerCase();
  if (/good first issue|first[- ]timers?|beginner|easy|starter/.test(text)) return "BEGINNER";
  if (/advanced|expert|complex|architecture|rfc/.test(text)) return "ADVANCED";
  if (/intermediate|moderate/.test(text)) return "INTERMEDIATE";
  if ((input.fileCount ?? 0) > 0 && (input.fileCount ?? 0) <= 2) return "BEGINNER";
  return "UNKNOWN";
}

export function inferContributionTypes(input: string): string[] {
  const text = input.toLowerCase();
  const mapping: Array<[RegExp, string]> = [
    [/documentation|docs|readme/, "Documentation"],
    [/bug|fix|regression/, "Bug"],
    [/feature|enhancement/, "Feature"],
    [/design|ux|ui\b/, "Design"],
    [/test|testing/, "Testing"],
    [/translation|i18n|localization/, "Translation"],
    [/research|paper|dataset/, "Research"],
    [/pcb|kicad|gerber/, "PCB"],
    [/firmware|embedded|esp32|arduino/, "Firmware"],
    [/cad|step|stl|mechanical/, "CAD"],
    [/accessibility|a11y/, "Accessibility"]
  ];
  const found = mapping.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  return found.length ? [...new Set(found)] : ["General"];
}

export function isLikelySmallScope(opportunity: Pick<Opportunity, "title" | "description" | "contributionTypes">): boolean {
  const text = `${opportunity.title} ${opportunity.description ?? ""} ${opportunity.contributionTypes.join(" ")}`.toLowerCase();
  return SMALL_SCOPE_SIGNALS.some((signal) => text.includes(signal));
}

function recencyScore(date?: string): number {
  if (!date) return 45;
  const ageMs = Date.now() - new Date(date).getTime();
  const days = Math.max(0, ageMs / 86_400_000);
  if (days <= 2) return 100;
  if (days <= 7) return 92;
  if (days <= 30) return 80;
  if (days <= 90) return 65;
  if (days <= 365) return 45;
  return 20;
}

export function calculateOpportunityScores(input: {
  lastActivity?: string;
  stars?: number;
  openIssues?: number;
  labels?: string[];
  hasContributingGuide?: boolean;
  archived?: boolean;
  issueBodyLength?: number;
}): { activityScore: number; freshnessScore: number; qualityScore: number; maintainerResponsiveness: number } {
  const freshness = recencyScore(input.lastActivity);
  const labels = (input.labels ?? []).map((x) => x.toLowerCase());
  const clarity = Math.min(100, 35 + Math.min(40, (input.issueBodyLength ?? 0) / 20) + (input.hasContributingGuide ? 25 : 0));
  const friendly = labels.some((l) => /good first|beginner|help wanted/.test(l)) ? 12 : 0;
  const activity = input.archived ? 5 : Math.round(Math.min(100, freshness * 0.72 + Math.min(25, Math.log10((input.stars ?? 0) + 1) * 8) + friendly));
  const responsiveness = input.archived ? 5 : Math.round(Math.min(100, 25 + freshness * 0.6 + Math.min(15, (input.openIssues ?? 0) > 0 ? 10 : 0)));
  const quality = input.archived ? 10 : Math.round(Math.min(100, clarity * 0.45 + activity * 0.35 + responsiveness * 0.2));
  return { activityScore: activity, freshnessScore: freshness, qualityScore: quality, maintainerResponsiveness: responsiveness };
}

export type UserMatchProfile = {
  skills: string[];
  interests: string[];
  level?: Difficulty;
};

function eventTimingScore(opportunity: Opportunity) {
  const start = dateValue(opportunity.eventDate);
  if (!start) return 35;
  const daysAway = (start - Date.now()) / 86_400_000;
  if (daysAway < -1) return 5;
  if (daysAway <= 7) return 100;
  if (daysAway <= 30) return 92;
  if (daysAway <= 90) return 78;
  if (daysAway <= 180) return 60;
  return 45;
}

function queryTopicScore(opportunity: Opportunity, intent?: SearchIntent) {
  const terms = intent ? meaningfulQueryTerms(intent) : [];
  if (!terms.length) return 70;
  const haystack = [opportunity.title, opportunity.description, ...opportunity.technologies, ...opportunity.languages, ...opportunity.topics, ...opportunity.skillsRequired, ...opportunity.contributionTypes].filter(Boolean).join(" ").toLowerCase();
  const matched = terms.filter((term) => haystack.includes(term)).length;
  return matched ? Math.min(100, 58 + (matched / terms.length) * 42) : 20;
}

function baseQualityScore(opportunity: Opportunity, profile?: UserMatchProfile): number {
  if (!profile) return Math.round(opportunity.qualityScore * 0.45 + opportunity.freshnessScore * 0.3 + opportunity.activityScore * 0.25);
  const userTerms = new Set([...profile.skills, ...profile.interests].map((x) => x.toLowerCase()));
  const oppTerms = [...opportunity.skillsRequired, ...opportunity.technologies, ...opportunity.languages, ...opportunity.topics].map((x) => x.toLowerCase());
  const overlap = oppTerms.length ? oppTerms.filter((t) => userTerms.has(t)).length / Math.min(Math.max(userTerms.size, 1), Math.max(oppTerms.length, 1)) : 0;
  let difficultyFit = 70;
  if (profile.level === "STARTING" || profile.level === "BEGINNER") difficultyFit = opportunity.beginnerFriendly ? 100 : opportunity.difficulty === "ADVANCED" ? 25 : 65;
  if (profile.level === "INTERMEDIATE") difficultyFit = opportunity.difficulty === "ADVANCED" ? 70 : 90;
  if (profile.level === "ADVANCED") difficultyFit = 90;
  return Math.round(Math.min(100,
    overlap * 38 +
    difficultyFit * 0.2 +
    opportunity.qualityScore * 0.17 +
    opportunity.activityScore * 0.12 +
    opportunity.freshnessScore * 0.08 +
    opportunity.maintainerResponsiveness * 0.05
  ));
}

export function calculateMatchScore(opportunity: Opportunity, profile?: UserMatchProfile, intent?: SearchIntent): number {
  const baseScore = baseQualityScore(opportunity, profile);
  if (opportunity.entityType !== "EVENT" || intent?.contentType !== "pulse") return baseScore;

  const locationScore = intent.location ? locationMatchScore(opportunity.location, intent.location) : 70;
  const timingScore = eventTimingScore(opportunity);
  const topicScore = queryTopicScore(opportunity, intent);
  const modeScore = intent.modes?.length && opportunity.mode ? (intent.modes.includes(opportunity.mode) ? 100 : 20) : intent.remote ? (opportunity.mode === "REMOTE" || opportunity.mode === "HYBRID" ? 100 : 35) : 70;

  return Math.round(Math.min(100,
    (intent.location ? locationScore * 0.38 : 0) +
    timingScore * (intent.location ? 0.24 : 0.36) +
    topicScore * (intent.location ? 0.18 : 0.25) +
    modeScore * 0.08 +
    baseScore * (intent.location ? 0.12 : 0.31)
  ));
}

export function applySearchFilters(items: Opportunity[], intent: SearchIntent): Opportunity[] {
  const queryTerms = meaningfulQueryTerms(intent);
  return items.filter((item) => {
    if (intent.entityTypes?.length && !intent.entityTypes.includes(item.entityType)) return false;
    if (intent.contentType === "pulse" && item.entityType !== "EVENT") return false;
    if (intent.contentType === "forge" && item.entityType === "EVENT") return false;
    if (intent.beginnerFriendly && !item.beginnerFriendly) return false;
    if (intent.goodFirstIssue && !item.goodFirstIssue) return false;
    if (intent.helpWanted && !item.helpWanted) return false;
    if (intent.hardware !== undefined && item.hardware !== intent.hardware) return false;
    if (intent.remote && item.mode !== "REMOTE" && item.mode !== "HYBRID") return false;
    if (intent.modes?.length && (!item.mode || !intent.modes.includes(item.mode))) return false;
    if (intent.eventTypes?.length && item.entityType === "EVENT") {
      const eventLabels = [...item.contributionTypes, ...item.topics].map((value) => value.toLowerCase());
      if (!intent.eventTypes.some((type) => eventLabels.some((label) => label.includes(type.toLowerCase())))) return false;
    }
    if (intent.difficulty?.length && !intent.difficulty.includes(item.difficulty)) return false;
    if (intent.sources?.length && !intent.sources.map((s) => s.toLowerCase()).includes(item.source.toLowerCase())) return false;
    if (intent.likelySmallScope && !isLikelySmallScope(item)) return false;
    if (intent.hiddenGems && ((item.stars ?? 0) > 2500 || item.qualityScore < 58 || item.activityScore < 50)) return false;
    if (item.entityType === "EVENT" && !isCurrentEvent(item, intent)) return false;
    if (item.entityType !== "EVENT" && !isActiveContributionLike(item, intent)) return false;
    if (intent.updatedWithinDays && item.lastActivity) {
      const cutoff = Date.now() - intent.updatedWithinDays * 86_400_000;
      if (new Date(item.lastActivity).getTime() < cutoff) return false;
    }
    if (intent.location) {
      const remoteAllowed = intent.remote || intent.modes?.some((mode) => mode === "REMOTE" || mode === "HYBRID");
      if (!locationMatches(item.location, intent.location) && !(remoteAllowed && (item.mode === "REMOTE" || item.mode === "HYBRID"))) return false;
    }
    if (intent.dateFrom || intent.dateTo || intent.datePreset === "week" || intent.datePreset === "month") {
      if (!isWithinRequestedDateRange(item, intent)) return false;
    }
    if (queryTerms.length) {
      const haystack = [item.title, item.description, item.organization, ...item.technologies, ...item.languages, ...item.topics, ...item.skillsRequired].filter(Boolean).join(" ").toLowerCase();
      if (!queryTerms.some((term) => haystack.includes(term))) return false;
    }
    return true;
  });
}

export function rankOpportunities(items: Opportunity[], profile?: UserMatchProfile, intent?: SearchIntent): Opportunity[] {
  return items
    .map((item) => ({ ...item, matchScore: calculateMatchScore(item, profile, intent) }))
    .sort((a, b) => b.matchScore - a.matchScore || b.freshnessScore - a.freshnessScore || b.qualityScore - a.qualityScore);
}

function dateValue(value?: string): number | undefined {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function metadataString(item: Opportunity, key: string): string | undefined {
  const value = item.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function metadataArray(item: Opportunity, key: string): unknown[] {
  const value = item.metadata?.[key];
  return Array.isArray(value) ? value : [];
}

export function isCurrentEvent(item: Opportunity, intent: SearchIntent = { query: "" }): boolean {
  if (item.entityType !== "EVENT") return false;
  if (intent.datePreset === "historical") return true;
  const start = dateValue(item.eventDate);
  if (!start) return false;
  const end = dateValue(metadataString(item, "end")) ?? dateValue(item.deadline) ?? start;
  const now = Date.now();
  return end >= now - 3 * 60 * 60 * 1000;
}

export function isActiveContributionLike(item: Opportunity, intent: SearchIntent = { query: "" }): boolean {
  if (item.entityType === "EVENT") return false;
  const requested = intent.issueStatus ?? "open";
  if (requested === "all") return true;
  const state = (metadataString(item, "state") ?? metadataString(item, "status") ?? "open").toLowerCase();
  if (requested === "open" && ["closed", "completed", "merged", "done", "resolved"].includes(state)) return false;
  if (requested === "closed" && !["closed", "completed", "merged", "done", "resolved"].includes(state)) return false;
  const assignees = metadataArray(item, "assignees").filter(Boolean);
  if (requested === "open" && item.entityType === "CONTRIBUTION" && assignees.length > 0 && !item.helpWanted && !item.goodFirstIssue) return false;
  return true;
}

export function isWithinRequestedDateRange(item: Opportunity, intent: SearchIntent): boolean {
  const date = item.entityType === "EVENT" ? dateValue(item.eventDate) : dateValue(item.lastActivity);
  if (!date) return false;
  const now = new Date();
  const from = intent.dateFrom ? dateValue(intent.dateFrom) : intent.datePreset === "upcoming" ? now.getTime() : undefined;
  let to = intent.dateTo ? dateValue(intent.dateTo) : undefined;
  if (!to && intent.datePreset === "week") to = now.getTime() + 7 * 86_400_000;
  if (!to && intent.datePreset === "month") {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    to = endOfMonth.getTime();
  }
  if (from && date < from - 3 * 60 * 60 * 1000) return false;
  if (to && date > to + 86_400_000) return false;
  return true;
}

export function validateOpportunityForIntent(item: Opportunity, intent: SearchIntent): boolean {
  if (intent.contentType === "pulse" || intent.entityTypes?.every((type) => type === "EVENT")) {
    if (item.entityType !== "EVENT") return false;
    if (!item.canonicalUrl || !item.eventDate) return false;
    return isCurrentEvent(item, intent) && applySearchFilters([item], { ...intent, entityTypes: ["EVENT"] }).length === 1;
  }
  if (intent.contentType === "forge" || intent.entityTypes?.some((type) => type === "CONTRIBUTION" || type === "PROJECT" || type === "HARDWARE_PROJECT")) {
    if (item.entityType === "EVENT") return false;
    if (item.entityType === "CONTRIBUTION" && !item.contributionUrl) return false;
    if ((item.entityType === "PROJECT" || item.entityType === "HARDWARE_PROJECT") && !item.repositoryUrl) return false;
    return isActiveContributionLike(item, intent) && applySearchFilters([item], { ...intent, entityTypes: intent.entityTypes ?? ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT"] }).length === 1;
  }
  return applySearchFilters([item], intent).length === 1;
}

export function stableOpportunityId(source: string, canonicalUrl: string): string {
  let hash = 2166136261;
  const text = `${source}:${canonicalUrl}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.toLowerCase()}_${(hash >>> 0).toString(36)}`;
}
