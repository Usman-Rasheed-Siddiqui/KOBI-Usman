import { GoogleGenAI } from "@google/genai";
import { searchAll } from "@openforge/discovery";
import { rankOpportunities, type Opportunity, type SearchIntent, type UserMatchProfile } from "@openforge/domain";

export type ForgeToolEvent = { tool: string; status: "started" | "completed" | "failed"; detail?: string; data?: unknown };
export type ForgeAgentTools = {
  searchIndexed?: (intent: SearchIntent, profile?: UserMatchProfile) => Promise<Opportunity[]>;
  persist?: (items: Opportunity[]) => Promise<void>;
};
export type CompactResult = {
  id: string;
  title: string;
  entityType: string;
  url: string;
  source: string;
  technologies?: string[];
  topics?: string[];
};
export type ForgeAgentContext = {
  conversationId?: string;
  lastIntent?: SearchIntent;
  lastResults?: CompactResult[];
  resultPool?: Opportunity[];
  shownResultIds?: string[];
  shownResultKeys?: string[];
  resultCursor?: number;
  selectedId?: string;
  lastRoute?: AgentRoute;
};
export type ForgeAgentResult = {
  text: string;
  opportunities: Opportunity[];
  events: ForgeToolEvent[];
  suggestedActions: string[];
  context: ForgeAgentContext;
  responseKind: "conversation" | "explanation" | "search" | "results" | "detail" | "plan";
};
export type ForgeHistoryMessage = { role: "user" | "assistant"; text: string };

export type OpportunityPlan = {
  title: string;
  summary: string;
  sections: Array<{ title: string; items: string[] }>;
  nextStep: string;
};

type AgentRoute = "conversation" | "explanation" | "search" | "show_more" | "detail" | "broaden" | "hard_search" | "refine" | "similar" | "plan";

const SYSTEM = "You are KOBI Agent, KOBI's grounded collaboration scout. Use only the supplied KOBI result data for factual recommendations. Do not invent repositories, events, URLs, dates, labels, or availability. Be concise, friendly, and practical. Write plain readable text, not raw Markdown.";

const PLAN_SYSTEM = "You are KOBI Plan Mode. Create practical opportunity-specific plans using only the supplied result data and user profile. Clearly separate known facts from reasonable preparation advice. Never invent repository files, schedules, acceptance odds, event eligibility, or unavailable details.";

const TECH_TERMS = [
  "react", "typescript", "javascript", "python", "ai", "machine learning", "llm", "node", "node.js", "next.js", "nextjs",
  "vue", "svelte", "rust", "go", "java", "android", "ios", "swift", "kotlin", "django", "flask", "fastapi",
  "postgres", "prisma", "robotics", "esp32", "arduino", "kicad", "firmware", "accessibility",
];

const LOCATION_TERMS = [
  "karachi", "lahore", "islamabad", "rawalpindi", "peshawar", "faisalabad", "sindh", "punjab", "pakistan",
  "dubai", "uae", "united arab emirates", "europe", "asia", "middle east", "mena", "united states", "usa",
];

function aiClient() {
  const key = process.env.GEMINI_API_KEY;
  return key ? new GoogleGenAI({ apiKey: key }) : undefined;
}

function nextMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59));
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

function extractLocation(text: string) {
  const direct = text.match(/\b(?:in|near|around)\s+([a-z][a-z\s.-]{2,40}?)(?:\s+(?:next|this|only|happening|updated|for|with|that|and)|[.?]|$)/i);
  if (direct?.[1]) return direct[1].trim().replace(/\s+/g, " ");
  const lower = text.toLowerCase();
  return LOCATION_TERMS.find((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower));
}

function extractTechnologies(text: string) {
  const lower = text.toLowerCase();
  return TECH_TERMS.filter((term) => lower.includes(term)).map((term) => term === "nextjs" ? "next.js" : term);
}

function ordinalIndex(text: string) {
  const lower = text.toLowerCase();
  if (/\bfirst\b|#1\b/.test(lower)) return 0;
  if (/\bsecond\b|#2\b/.test(lower)) return 1;
  if (/\bthird\b|#3\b/.test(lower)) return 2;
  if (/\bfourth\b|#4\b/.test(lower)) return 3;
  if (/\bfifth\b|#5\b/.test(lower)) return 4;
  const match = lower.match(/\b(\d+)(?:st|nd|rd|th)?\b/);
  return match ? Math.max(0, Number(match[1]) - 1) : undefined;
}

function isDetailRequest(text: string) {
  return /\b(tell me more|more about|details?|explain (?:the|this|that)|how do i start|how to start|contributing to it|that one|second one|first one|third one)\b/i.test(text);
}

function isSimilarRequest(text: string) {
  return /\b(similar|more like|three similar|find me.*similar)\b/i.test(text);
}

function isShowMoreRequest(text: string) {
  return /\b(show me more|show more|more results|give me others|show others|next results|next batch|any others)\b/i.test(text);
}

function isBroadenRequest(text: string) {
  return /\b(broaden|widen|expand|less strict|more coverage|broader)\b/i.test(text);
}

function isHardSearchRequest(text: string) {
  return /\b(hard search|deep search|search harder|deeper search|search deeper|rigorous|exhaustive|more sources)\b/i.test(text);
}

function isPlanRequest(text: string) {
  return /\b(plan|checklist|roadmap|step by step|step-by-step|prepare for this|how should i approach)\b/i.test(text);
}

function isRefinementRequest(text: string) {
  return /\b(only|just|filter|recent|recently|updated|beginner|good first|help wanted|online|remote|virtual|in-person|in person|this week|this month|next month|karachi|lahore|islamabad|pakistan|dubai)\b/i.test(text);
}

function hasEventIntent(text: string) {
  return /\b(event|events|conference|conferences|hackathon|hackathons|meetup|meetups|workshop|workshops|summit|webinar|bootcamp|developer gathering)\b/i.test(text);
}

function hasContributionIntent(text: string) {
  return /\b(contribution|contributions|contribute|issue|issues|good first|good-first|help wanted|repo|repository|repositories|pull request|project|projects|opensource|open-source|looking for contributors)\b/i.test(text);
}

function isFriendlyConversation(text: string) {
  const lower = text.trim().toLowerCase();
  if (/^(hi|hello|hey|yo|salam|assalam|thanks|thank you|ok|okay|cool|great|nice)[!. ]*$/.test(lower)) return true;
  if (/^(how are you|how's it going|what can you do|what can kobi help me with|who are you)\??$/.test(lower)) return true;
  return false;
}

function isGeneralExplanation(text: string) {
  const lower = text.trim().toLowerCase();
  if (hasEventIntent(lower) || hasContributionIntent(lower)) return false;
  return /^(what is|what are|explain|how does|why does)\b/.test(lower);
}

function requiresSearch(text: string) {
  const lower = text.toLowerCase();
  const searchVerb = /\b(find|search|discover|show me|look for|recommend|give me|list|surface|get me)\b/.test(lower);
  const supportedThing = hasEventIntent(lower) || hasContributionIntent(lower) || /\b(opportunity|opportunities)\b/.test(lower);
  return searchVerb && supportedThing;
}

function classifyRoute(message: string, context?: ForgeAgentContext): AgentRoute {
  if (isFriendlyConversation(message)) return "conversation";
  if (isPlanRequest(message) && context?.lastResults?.length) return "plan";
  if (isDetailRequest(message) && context?.lastResults?.length && !isSimilarRequest(message)) return "detail";
  if (isShowMoreRequest(message) && (context?.resultPool?.length || context?.lastIntent)) return "show_more";
  if (isBroadenRequest(message) && context?.lastIntent) return "broaden";
  if (isHardSearchRequest(message) && context?.lastIntent) return "hard_search";
  if (isSimilarRequest(message) && context?.lastResults?.length) return "similar";
  if (isRefinementRequest(message) && context?.lastIntent) return "refine";
  if (requiresSearch(message)) return "search";
  if (isGeneralExplanation(message)) return "explanation";
  return "conversation";
}

function parseIntent(message: string, context?: ForgeAgentContext, route: AgentRoute = "search"): SearchIntent {
  const lower = message.toLowerCase();
  const inherited = context?.lastIntent;
  const eventLike = hasEventIntent(lower);
  const contributionLike = hasContributionIntent(lower);
  const inheritedContent = route === "search" ? undefined : inherited?.contentType;
  const contentType = eventLike && !contributionLike
    ? "pulse"
    : contributionLike && !eventLike
      ? "forge"
      : inheritedContent ?? (eventLike ? "pulse" : contributionLike ? "forge" : "all");
  const technologies = extractTechnologies(message);
  const location = extractLocation(message);
  const hardMode = route === "hard_search" || isHardSearchRequest(message) || inherited?.hardMode || undefined;
  const fastMode = hardMode ? false : /\b(fast mode|quick search|quickly)\b/.test(lower) ? true : inherited?.fastMode ?? false;
  const query = route === "search" || !inherited?.query ? message : inherited.query;
  const intent: SearchIntent = {
    ...(inherited ?? { query }),
    query,
    contentType,
    entityTypes: contentType === "pulse" ? ["EVENT"] : contentType === "forge" ? ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT"] : undefined,
    technologies: technologies.length ? technologies : inherited?.technologies,
    skills: technologies.length ? technologies : inherited?.skills,
    location: location ?? inherited?.location,
    beginnerFriendly: /\b(beginner|first contribution|first-time|starter|good first)\b/.test(lower) || inherited?.beginnerFriendly || undefined,
    goodFirstIssue: /\bgood first\b/.test(lower) || inherited?.goodFirstIssue || undefined,
    helpWanted: /\bhelp wanted|looking for contributors\b/.test(lower) || inherited?.helpWanted || undefined,
    likelySmallScope: /\b(small|quick|tonight|weekend|one hour)\b/.test(lower) || inherited?.likelySmallScope || undefined,
    hiddenGems: /\b(hidden|underrated|low competition)\b/.test(lower) || inherited?.hiddenGems || undefined,
    remote: /\b(online|remote|virtual)\b/.test(lower) || inherited?.remote || undefined,
    modes: /\bin-person|in person|physical|onsite|on-site\b/.test(lower) ? ["PHYSICAL"] : /\bonline|remote|virtual\b/.test(lower) ? ["REMOTE", "HYBRID"] : inherited?.modes,
    updatedWithinDays: /\b(this week|last 7 days)\b/.test(lower) ? 7 : /\b(recent|recently|updated|this month|last 30 days)\b/.test(lower) ? 30 : inherited?.updatedWithinDays,
    datePreset: contentType === "pulse" ? (/\bthis week\b/.test(lower) ? "week" : /\bthis month\b/.test(lower) ? "month" : inherited?.datePreset ?? "upcoming") : inherited?.datePreset,
    issueStatus: contentType === "forge" ? "open" : inherited?.issueStatus,
    includeProjects: contentType === "forge" ? inherited?.includeProjects ?? true : inherited?.includeProjects,
    hardMode,
    fastMode,
    sources: inherited?.sources,
    limit: hardMode ? 44 : route === "broaden" ? 36 : 28,
  };
  if (contentType === "pulse" && /\bnext month\b/.test(lower)) Object.assign(intent, nextMonthRange(), { datePreset: "custom" });
  if (route === "broaden") {
    intent.fastMode = false;
    intent.limit = Math.max(inherited?.limit ?? 28, 36);
  }
  if (route === "hard_search") {
    intent.fastMode = false;
    intent.hardMode = true;
    intent.limit = Math.max(inherited?.limit ?? 28, 44);
  }
  return intent;
}

function compactOpportunity(item: Opportunity): Opportunity {
  return {
    ...item,
    description: item.description ? item.description.slice(0, 600) : undefined,
    shortSummary: item.shortSummary ? item.shortSummary.slice(0, 280) : undefined,
    technologies: item.technologies.slice(0, 8),
    languages: item.languages.slice(0, 6),
    topics: item.topics.slice(0, 10),
    skillsRequired: item.skillsRequired.slice(0, 8),
    contributionTypes: item.contributionTypes.slice(0, 6),
    metadata: item.metadata ? {
      state: item.metadata.state,
      status: item.metadata.status,
      labels: item.metadata.labels,
      city: item.metadata.city,
      stateName: item.metadata.stateName,
      country: item.metadata.country,
      end: item.metadata.end,
      assignees: item.metadata.assignees,
    } : undefined,
  };
}

function compactResult(item: Opportunity): CompactResult {
  return {
    id: item.id,
    title: item.title,
    entityType: item.entityType,
    url: item.contributionUrl ?? item.registrationUrl ?? item.repositoryUrl ?? item.canonicalUrl,
    source: item.source,
    technologies: item.technologies.slice(0, 6),
    topics: item.topics.slice(0, 6),
  };
}

function normalizeTextKey(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9+#.-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUrlKey(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    const githubIssue = path.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)$/);
    if (host === "github.com" && githubIssue) return `url:${host}/${githubIssue[1]}/${githubIssue[2]}/issues/${githubIssue[3]}`;
    return `url:${host}${path}`;
  } catch {
    return `url:${value.replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase()}`;
  }
}

function safeIsoDay(value: string | undefined) {
  if (!value) return "";
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : "";
}

function resultIdentityKeys(item: Pick<Opportunity, "id" | "title" | "entityType" | "canonicalUrl" | "contributionUrl" | "registrationUrl" | "repositoryUrl" | "eventDate" | "location" | "source">) {
  const keys = [
    normalizeUrlKey(item.contributionUrl),
    normalizeUrlKey(item.registrationUrl),
    normalizeUrlKey(item.repositoryUrl),
    normalizeUrlKey(item.canonicalUrl),
  ].filter((key): key is string => Boolean(key));
  const title = normalizeTextKey(item.title);
  if (item.entityType === "EVENT") {
    const day = safeIsoDay(item.eventDate);
    const location = normalizeTextKey(item.location);
    if (title && (day || location)) keys.push(`event:${title}:${day}:${location}`);
  } else if (title && item.repositoryUrl) {
    keys.push(`contribution:${normalizeUrlKey(item.repositoryUrl)}:${title}`);
  } else if (title && item.source) {
    keys.push(`${item.entityType.toLowerCase()}:${normalizeTextKey(item.source)}:${title}`);
  }
  if (item.id) keys.push(`id:${item.id}`);
  return [...new Set(keys)];
}

function compactResultIdentityKeys(item: CompactResult) {
  const urlKey = normalizeUrlKey(item.url);
  const title = normalizeTextKey(item.title);
  return [...new Set([urlKey, title ? `${item.entityType.toLowerCase()}:${normalizeTextKey(item.source)}:${title}` : undefined, `id:${item.id}`].filter((key): key is string => Boolean(key)))];
}

function isAlreadyShown(item: Opportunity, ids: Set<string>, keys: Set<string>) {
  if (ids.has(item.id)) return true;
  return resultIdentityKeys(item).some((key) => keys.has(key));
}

function compactContext(intent: SearchIntent, pool: Opportunity[], displayed: Opportunity[], previous?: ForgeAgentContext, route: AgentRoute = "search"): ForgeAgentContext {
  const existingShown = previous?.lastResults ?? [];
  const shownMap = new Map(existingShown.map((item) => [compactResultIdentityKeys(item)[0] ?? `id:${item.id}`, item]));
  for (const item of displayed) shownMap.set(resultIdentityKeys(item)[0] ?? `id:${item.id}`, compactResult(item));
  const shownIds = [...new Set([...(previous?.shownResultIds ?? existingShown.map((item) => item.id)), ...displayed.map((item) => item.id)])];
  const previousKeys = previous?.shownResultKeys ?? existingShown.flatMap(compactResultIdentityKeys);
  const shownKeys = [...new Set([...previousKeys, ...displayed.flatMap(resultIdentityKeys)])];
  return {
    conversationId: previous?.conversationId,
    lastIntent: intent,
    resultPool: dedupe(pool).slice(0, 36).map(compactOpportunity),
    lastResults: [...shownMap.values()].slice(-30),
    shownResultIds: shownIds.slice(-60),
    shownResultKeys: shownKeys.slice(-120),
    resultCursor: shownIds.length,
    selectedId: displayed[0]?.id ?? previous?.selectedId,
    lastRoute: route,
  };
}

function mergeContextPools(previous: Opportunity[] | undefined, next: Opportunity[], profile: UserMatchProfile | undefined, intent: SearchIntent) {
  return rankOpportunities(dedupe([...(previous ?? []), ...next]), profile, intent);
}

function dedupe(items: Opportunity[]) {
  const map = new Map<string, Opportunity>();
  for (const item of items) {
    const keys = resultIdentityKeys(item);
    const existingKey = keys.find((key) => map.has(key));
    const previous = existingKey ? map.get(existingKey) : undefined;
    const chosen = !previous || item.qualityScore > previous.qualityScore || item.freshnessScore > previous.freshnessScore ? item : previous;
    for (const key of [...keys, ...(previous ? resultIdentityKeys(previous) : [])]) map.set(key, chosen);
  }
  return [...new Map([...map.values()].map((item) => [resultIdentityKeys(item)[0] ?? item.id, item])).values()];
}

function isFreshIndexed(item: Opportunity, intent: SearchIntent) {
  const freshnessDays = intent.contentType === "pulse" ? 3 : 7;
  const date = item.scrapedAt || item.updatedAt || item.lastActivity;
  const time = date ? new Date(date).getTime() : 0;
  return Number.isFinite(time) && Date.now() - time <= freshnessDays * 86_400_000;
}

async function searchWithTools(intent: SearchIntent, profile: UserMatchProfile | undefined, events: ForgeToolEvent[], tools: ForgeAgentTools, options: { forceFresh?: boolean } = {}) {
  const indexTool = intent.contentType === "pulse" ? "query_kobi_pulse_index" : intent.contentType === "forge" ? "query_kobi_forge_index" : "query_kobi_discover_index";
  const freshTool = intent.contentType === "pulse" ? "request_fresh_pulse_discovery" : intent.contentType === "forge" ? "request_fresh_forge_discovery" : "request_fresh_discover_discovery";
  const normalIntent = intent.hardMode ? { ...intent, hardMode: false } : intent;
  let indexed: Opportunity[] = [];
  if (tools.searchIndexed) {
    events.push({ tool: indexTool, status: "started", detail: "Checking saved KOBI discoveries first" });
    try {
      indexed = rankOpportunities(await tools.searchIndexed(intent, profile), profile, intent);
      events.push({ tool: indexTool, status: "completed", detail: `${indexed.length} reusable saved results` });
    } catch (error) {
      events.push({ tool: indexTool, status: "failed", detail: error instanceof Error ? error.message : "Indexed search failed" });
    }
  }

  const threshold = intent.contentType === "pulse" ? 6 : 8;
  const freshIndexed = indexed.filter((item) => isFreshIndexed(item, intent));
  if (!options.forceFresh && intent.fastMode && !intent.hardMode && freshIndexed.length >= threshold) {
    events.push({ tool: freshTool, status: "completed", detail: "Fast Mode used sufficient fresh saved coverage before starting live discovery" });
    return rankOpportunities(freshIndexed, profile, intent).slice(0, intent.limit ?? 16);
  }

  events.push({ tool: freshTool, status: "started", detail: normalIntent.fastMode ? "Searching the fastest high-value live sources" : "Searching normal live source coverage" });
  const fresh = await searchAll(normalIntent, profile);
  events.push({ tool: freshTool, status: "completed", detail: `${fresh.length} fresh validated results` });
  let merged = rankOpportunities(dedupe([...indexed, ...fresh]), profile, intent).slice(0, intent.limit ?? 28);

  if (intent.hardMode && merged.length < threshold) {
    const hardTool = intent.contentType === "pulse" ? "hard_search_kobi_pulse" : intent.contentType === "forge" ? "hard_search_kobi_forge" : "hard_search_kobi_discover";
    events.push({ tool: hardTool, status: "started", detail: "Searching deeper source coverage while keeping the result type strict" });
    const hardFresh = await searchAll({ ...intent, fastMode: false, hardMode: true, limit: Math.max(intent.limit ?? 44, 60) }, profile);
    events.push({ tool: hardTool, status: "completed", detail: `${hardFresh.length} hard-search candidates validated` });
    merged = rankOpportunities(dedupe([...merged, ...hardFresh]), profile, intent).slice(0, Math.max(intent.limit ?? 44, 44));
  }

  if (tools.persist && merged.length) {
    events.push({ tool: "save_discoveries_to_kobi_index", status: "started", detail: "Saving validated results for reuse" });
    try {
      await tools.persist(merged);
      events.push({ tool: "save_discoveries_to_kobi_index", status: "completed", detail: `${merged.length} saved or updated records` });
    } catch (error) {
      events.push({ tool: "save_discoveries_to_kobi_index", status: "failed", detail: error instanceof Error ? error.message : "Persistence failed" });
    }
  }
  return merged;
}

function selectedFromContext(message: string, context?: ForgeAgentContext) {
  const index = ordinalIndex(message);
  const shown = context?.lastResults ?? [];
  const selectedRef = index !== undefined ? shown[index] : context?.selectedId ? shown.find((item) => item.id === context.selectedId) : shown[0];
  if (!selectedRef) return undefined;
  return context?.resultPool?.find((item) => item.id === selectedRef.id) ?? {
    id: selectedRef.id,
    title: selectedRef.title,
    entityType: selectedRef.entityType === "EVENT" ? "EVENT" : "CONTRIBUTION",
    source: selectedRef.source,
    canonicalUrl: selectedRef.url,
    contributionUrl: selectedRef.entityType === "EVENT" ? undefined : selectedRef.url,
    registrationUrl: selectedRef.entityType === "EVENT" ? selectedRef.url : undefined,
    technologies: selectedRef.technologies ?? [],
    languages: [],
    topics: selectedRef.topics ?? [],
    skillsRequired: selectedRef.technologies ?? [],
    difficulty: "UNKNOWN",
    beginnerFriendly: false,
    goodFirstIssue: false,
    helpWanted: false,
    activityScore: 50,
    maintainerResponsiveness: 50,
    contributionTypes: selectedRef.entityType === "EVENT" ? ["Event"] : ["General"],
    hardware: false,
    qualityScore: 50,
    freshnessScore: 50,
    matchScore: 0,
    scrapedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies Opportunity;
}

function nextResultsFromContext(context?: ForgeAgentContext, batchSize = 3) {
  const pool = context?.resultPool ?? [];
  const shownIds = new Set(context?.shownResultIds ?? context?.lastResults?.map((item) => item.id) ?? []);
  const shownKeys = new Set(context?.shownResultKeys ?? context?.lastResults?.flatMap(compactResultIdentityKeys) ?? []);
  return pool.filter((item) => !isAlreadyShown(item, shownIds, shownKeys)).slice(0, batchSize);
}

async function synthesize(prompt: string, fallback: string, systemInstruction = SYSTEM): Promise<string> {
  const ai = aiClient();
  if (!ai) return fallback;
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-3-flash-preview",
      contents: prompt,
      config: { systemInstruction, temperature: 0.4 },
    });
    return cleanAgentText(response.text?.trim() || fallback);
  } catch {
    return fallback;
  }
}

function cleanAgentText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .trim();
}

function directFallback(message: string) {
  const lower = message.toLowerCase();
  if (/how are you/.test(lower)) return "I am good and ready to help. If you want discovery, ask for events, open-source issues, or projects with any constraints you care about.";
  if (/what can you do|what can kobi help/.test(lower)) {
    return "KOBI can help you search for developer events, hackathons, conferences, open-source issues, and projects seeking contributors. I can also explain a result, show more without repeating items, broaden a search, run Hard Search, or build a practical plan for a selected opportunity.";
  }
  if (/thanks|thank you/.test(lower)) return "Anytime. When you are ready, give me a technology, place, timeframe, or contribution goal and I will keep it focused.";
  return "I am here. Ask me naturally, or tell me what kind of opportunity you want KOBI to find.";
}

function summarizeResults(items: Opportunity[], intent: SearchIntent, poolCount = items.length) {
  if (!items.length) {
    return intent.contentType === "pulse"
      ? "I could not find current events that match those filters. I kept the event pipeline strict, so contribution issues and unrelated pages were excluded."
      : "I could not find active contribution opportunities that match those filters. I kept the contribution pipeline strict, so events and closed issues were excluded.";
  }
  const kind = intent.contentType === "pulse" ? "current events" : intent.contentType === "forge" ? "active opportunities" : "strong matches";
  const first = items[0]!;
  const reason = intent.contentType === "pulse"
    ? `${first.eventDate ? `It starts ${new Date(first.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "It has current event details"}${first.location ? ` and is listed for ${first.location}` : ""}.`
    : `${first.goodFirstIssue ? "It is marked good-first-issue. " : ""}${first.lastActivity ? `It was updated ${new Date(first.lastActivity).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.` : "It is listed as an active source opportunity."}`;
  return `I found ${poolCount} ${kind}. I am showing the strongest ${items.length} first so the list stays usable. Start with ${first.title} from ${first.source}. ${reason}`;
}

function suggestedFor(intent: SearchIntent, pool: Opportunity[], displayed: Opportunity[], context?: ForgeAgentContext) {
  const shownIds = new Set([...(context?.shownResultIds ?? []), ...displayed.map((item) => item.id)]);
  const shownKeys = new Set([...(context?.shownResultKeys ?? []), ...displayed.flatMap(resultIdentityKeys)]);
  const hasMore = pool.some((item) => !isAlreadyShown(item, shownIds, shownKeys));
  const base = intent.contentType === "pulse"
    ? ["Broaden the results", "Use Hard Search", "Tell me more about the first one"]
    : ["Only recently updated ones", "Beginner only", "Use Hard Search", "Tell me more about the first one"];
  return hasMore ? ["Show more", ...base].slice(0, 4) : base.slice(0, 3);
}

function renderPlan(plan: OpportunityPlan) {
  const sections = plan.sections
    .map((section) => `${section.title}\n${section.items.map((item, index) => `${index + 1}. ${item}`).join("\n")}`)
    .join("\n\n");
  return `${plan.summary}\n\n${sections}\n\nBest next step\n${plan.nextStep}`;
}

function fallbackPlan(opportunity: Opportunity): OpportunityPlan {
  if (opportunity.entityType === "EVENT") {
    return {
      title: `Plan for ${opportunity.title}`,
      summary: `${opportunity.title} is an event from ${opportunity.source}. Use the official page as the source of truth for registration, timing, location, and eligibility.`,
      sections: [
        { title: "Why It May Matter", items: ["It matches the event search context KOBI was asked to explore.", "The strongest known facts are the source, date, mode, location, and topics already shown on the card."] },
        { title: "Preparation", items: ["Open the event page and confirm the schedule, timezone, cost, and registration deadline.", "Pick one or two learning or networking goals before attending.", "Save the registration link and add the event date to your calendar."] },
      ],
      nextStep: "Open the real event page and confirm registration details before making plans.",
    };
  }
  return {
    title: `Plan for ${opportunity.title}`,
    summary: `${opportunity.title} is an active contribution opportunity from ${opportunity.source}. KOBI can advise on approach, but the original issue or repository remains the source of truth.`,
    sections: [
      { title: "Understand The Request", items: ["Open the original source and confirm the issue is still open and unassigned.", "Read the issue body, linked discussion, labels, and repository contribution guidance.", "Separate what is explicitly requested from what you are assuming."] },
      { title: "Approach", items: ["Set up the project from its documented README or contributing guide.", "Reproduce or understand the requested behavior before changing code.", "Make the smallest useful change and keep the pull request focused."] },
      { title: "Before Submitting", items: ["Run the documented tests, linting, build, or validation checks.", "Write a concise PR description explaining the change and how you tested it.", "Stay responsive to maintainer feedback."] },
    ],
    nextStep: "Open the real source, confirm availability, and read the repository's contribution guide.",
  };
}

export async function runForgeAgent(message: string, profile?: UserMatchProfile, history: ForgeHistoryMessage[] = [], context?: ForgeAgentContext, tools: ForgeAgentTools = {}): Promise<ForgeAgentResult> {
  const route = classifyRoute(message, context);
  const events: ForgeToolEvent[] = [];
  const selected = selectedFromContext(message, context);

  if (route === "conversation" || route === "explanation") {
    const fallback = route === "conversation" ? directFallback(message) : `Here is the short version: ${message.replace(/[?.!]+$/, "")} is a general concept I can explain without searching. If you want live KOBI results, ask me to find specific events or contribution opportunities.`;
    const text = route === "conversation"
      ? fallback
      : await synthesize(`Answer this general developer question directly without using KOBI tools. Keep it under 110 words and do not include live links or claims that require verification. Question: ${message}`, fallback);
    return {
      text,
      opportunities: [],
      events,
      suggestedActions: ["Find AI events", "Find React contributions", "What can KOBI help me with?"],
      context: { ...(context ?? {}), lastRoute: route },
      responseKind: route,
    };
  }

  if (route === "detail" && selected) {
    const item = selected as Opportunity;
    const fallback = item.entityType === "EVENT"
      ? `Here is the key context for ${item.title}. It came from ${item.source}, so use the original event page for registration, schedule, and final eligibility details.`
      : `Here is how to approach ${item.title}. Open the original source, confirm it is still open, read the repository guidance, understand the requested change, then make the smallest useful contribution.`;
    const text = await synthesize(`Explain this selected KOBI result in 2 short paragraphs. Use only these facts and say when details must be confirmed at the source. Result: ${JSON.stringify(item)}`, fallback);
    return {
      text,
      opportunities: [],
      events: [{ tool: "use_compact_result_context", status: "completed", detail: `Resolved reference to ${item.title}` }],
      suggestedActions: item.entityType === "EVENT" ? ["Plan this event", "Find similar events", "Show more"] : ["Plan this issue", "Find similar opportunities", "Show more"],
      context: { ...(context ?? {}), selectedId: item.id, lastRoute: route },
      responseKind: "detail",
    };
  }

  if (route === "plan" && selected) {
    const plan = await buildOpportunityPlan(selected as Opportunity, profile, context);
    return {
      text: renderPlan(plan),
      opportunities: [],
      events: [{ tool: "kobi_plan_mode", status: "completed", detail: `Built a plan for ${selected.title}` }],
      suggestedActions: selected.entityType === "EVENT" ? ["Open registration", "Find similar events", "Show more"] : ["Open source", "Find similar opportunities", "Show more"],
      context: { ...(context ?? {}), selectedId: selected.id, lastRoute: route },
      responseKind: "plan",
    };
  }

  if (route === "show_more") {
    const intent = context?.lastIntent ?? parseIntent(message, context, "show_more");
    const next = nextResultsFromContext(context, 3);
    if (next.length) {
      return {
        text: `Here are the next ${next.length} results from the same ranked search. I am not repeating the ones already shown.`,
        opportunities: next,
        events: [{ tool: "page_existing_ranked_results", status: "completed", detail: "Used stored search context instead of restarting discovery" }],
        suggestedActions: suggestedFor(intent, context?.resultPool ?? [], next, context),
        context: compactContext(intent, context?.resultPool ?? next, next, context, route),
        responseKind: "results",
      };
    }
    return {
      text: "You have seen the strongest saved results from this search. I can broaden the search or use Hard Search if you want me to look deeper while keeping your filters.",
      opportunities: [],
      events: [{ tool: "page_existing_ranked_results", status: "completed", detail: "No unseen results remain in the current result pool" }],
      suggestedActions: ["Broaden the results", "Use Hard Search", "Refine filters"],
      context: { ...(context ?? {}), lastRoute: route },
      responseKind: "results",
    };
  }

  let intent = parseIntent(message, context, route);
  if (selected && route === "similar") {
    intent = {
      ...(context?.lastIntent ?? intent),
      query: [...((selected as Opportunity).technologies ?? []), ...((selected as Opportunity).topics ?? []), selected.title].slice(0, 6).join(" "),
      contentType: selected.entityType === "EVENT" ? "pulse" : "forge",
      entityTypes: selected.entityType === "EVENT" ? ["EVENT"] : ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT"],
      fastMode: false,
      limit: 28,
    };
  }

  const tool = intent.contentType === "pulse" ? "search_kobi_pulse" : intent.contentType === "forge" ? "search_kobi_forge" : "search_kobi_discover";
  const forceFresh = route === "broaden" || route === "hard_search" || route === "similar";
  events.push({ tool, status: "started", detail: intent.hardMode ? "Hard Search is available for this request" : intent.fastMode ? "Fast Mode is checking the strongest saved and live sources" : "Checking saved discoveries, then live discovery if needed", data: { intent, route } });
  let pool: Opportunity[] = [];
  try {
    const found = await searchWithTools(intent, profile, events, tools, { forceFresh });
    pool = mergeContextPools(route === "broaden" || route === "hard_search" || route === "similar" ? context?.resultPool : undefined, found, profile, intent);
    events.push({ tool, status: "completed", detail: `${pool.length} ranked ${intent.contentType === "pulse" ? "events" : intent.contentType === "forge" ? "opportunities" : "results"}` });
  } catch (error) {
    events.push({ tool, status: "failed", detail: error instanceof Error ? error.message : "Discovery failed" });
  }

  const alreadyShownIds = route === "search" ? new Set<string>() : new Set(context?.shownResultIds ?? []);
  const alreadyShownKeys = route === "search" ? new Set<string>() : new Set(context?.shownResultKeys ?? context?.lastResults?.flatMap(compactResultIdentityKeys) ?? []);
  const displayed = pool.filter((item) => !isAlreadyShown(item, alreadyShownIds, alreadyShownKeys)).slice(0, 3);
  const fallback = summarizeResults(displayed, intent, pool.length);
  const text = displayed.length
    ? await synthesize(`Write a concise KOBI response in 2 short paragraphs. Do not use markdown syntax, markdown tables, backticks, or bold markers. Mention whether these came from saved KOBI discoveries, fresh discovery, or both when clear from the tool events. Intent: ${JSON.stringify(intent)} Results shown: ${JSON.stringify(displayed.map((item) => ({ title: item.title, source: item.source, url: item.contributionUrl ?? item.registrationUrl ?? item.repositoryUrl ?? item.canonicalUrl, type: item.entityType, date: item.eventDate, updated: item.lastActivity, location: item.location, labels: item.topics, technologies: item.technologies })))}`, fallback)
    : fallback;

  return {
    text,
    opportunities: displayed,
    events,
    suggestedActions: suggestedFor(intent, pool, displayed, route === "search" ? undefined : context),
    context: compactContext(intent, pool, displayed, route === "search" || route === "refine" ? { conversationId: context?.conversationId } : context, route),
    responseKind: displayed.length ? "results" : "search",
  };
}

export async function explainContribution(opportunity: Opportunity): Promise<string> {
  const known = { title: opportunity.title, description: opportunity.description, url: opportunity.contributionUrl ?? opportunity.registrationUrl ?? opportunity.canonicalUrl, source: opportunity.source, difficulty: opportunity.difficulty, types: opportunity.contributionTypes, technologies: opportunity.technologies, eventDate: opportunity.eventDate, location: opportunity.location, metadata: opportunity.metadata };
  const fallback = opportunity.entityType === "EVENT"
    ? `What it is: ${opportunity.shortSummary ?? opportunity.title}\n\nKnown: this event was returned by ${opportunity.source}. Confirm registration, timing, and attendance details on the official event page.`
    : `What it is: ${opportunity.shortSummary ?? opportunity.title}\n\nKnown: this link was returned by ${opportunity.source}.\n\nStart here: open the source, confirm it is still open, read the README and contribution guide, make a focused change, run the documented checks, and submit the smallest coherent contribution.`;
  return synthesize(`Explain this KOBI result to a new contributor or attendee. Separate known facts from inference. Never invent file names, dates, or acceptance likelihood. Data: ${JSON.stringify(known)}`, fallback);
}

export async function buildOpportunityPlan(opportunity: Opportunity, profile?: UserMatchProfile, context?: ForgeAgentContext): Promise<OpportunityPlan> {
  const fallback = fallbackPlan(opportunity);
  const ai = aiClient();
  if (!ai) return fallback;
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-3-flash-preview",
      contents: `Create a compact practical KOBI Plan Mode response as JSON only. Result: ${JSON.stringify(compactOpportunity(opportunity))}. User profile: ${JSON.stringify(profile ?? {})}. Current search context: ${JSON.stringify(context?.lastIntent ?? {})}.`,
      config: {
        systemInstruction: PLAN_SYSTEM,
        temperature: 0.35,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  items: { type: "array", items: { type: "string" } },
                },
                required: ["title", "items"],
              },
            },
            nextStep: { type: "string" },
          },
          required: ["title", "summary", "sections", "nextStep"],
        },
      },
    });
    const parsed = JSON.parse(response.text || "{}") as OpportunityPlan;
    if (!parsed.title || !parsed.summary || !Array.isArray(parsed.sections) || !parsed.nextStep) return fallback;
    return {
      title: cleanAgentText(parsed.title),
      summary: cleanAgentText(parsed.summary),
      sections: parsed.sections.slice(0, 6).map((section) => ({
        title: cleanAgentText(section.title),
        items: section.items.slice(0, 6).map(cleanAgentText).filter(Boolean),
      })).filter((section) => section.title && section.items.length),
      nextStep: cleanAgentText(parsed.nextStep),
    };
  } catch {
    return fallback;
  }
}

export async function buildContributionPlan(opportunity: Opportunity, profile?: UserMatchProfile, context?: ForgeAgentContext): Promise<string[]> {
  const plan = await buildOpportunityPlan(opportunity, profile, context);
  return plan.sections.flatMap((section) => section.items).concat(plan.nextStep).slice(0, 9);
}

export function compareOpportunities(items: Opportunity[]) {
  return items.slice(0, 4).map((item) => ({ title: item.title, source: item.source, matchScore: item.matchScore, difficulty: item.difficulty, activity: item.activityScore, freshness: item.freshnessScore, quality: item.qualityScore, beginnerFriendly: item.beginnerFriendly, likelySmallScope: item.contributionTypes.some((value) => /documentation|testing|translation|accessibility/i.test(value)), url: item.contributionUrl ?? item.registrationUrl ?? item.canonicalUrl }));
}

export async function analyzeSkillGap(target: string, profile: UserMatchProfile) {
  const current = [...new Set(profile.skills.map((value) => value.toLowerCase()))];
  const targetTerms = target.toLowerCase().split(/[^a-z0-9+#.-]+/).filter((value) => value.length > 2);
  const missing = targetTerms.filter((term) => !current.includes(term)).slice(0, 8);
  return { target, current: profile.skills, likelyGaps: missing, ladder: ["Find a small bridge project using a skill you already know", "Complete 1-3 constrained contributions", "Move to a medium ecosystem project and learn its workflow", `Attempt a well-scoped first contribution in ${target}`] };
}
