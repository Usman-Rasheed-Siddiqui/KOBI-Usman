import { prisma } from "@openforge/database";
import {
  applySearchFilters,
  calculateMatchScore,
  cleanDescription,
  cleanTechnologyLabels,
  detectHardware,
  meaningfulQueryTerms,
  rankOpportunities,
  stableOpportunityId,
  summarizeDisplayText,
  type Opportunity,
  type SearchIntent,
  type UserMatchProfile,
} from "@openforge/domain";

const nowIso = () => new Date().toISOString();

/**
 * Fast first-stage search over entities already normalized by background workers.
 * Live source discovery runs after this and merges into the same ranking pipeline.
 */
export async function searchIndexed(
  intent: SearchIntent,
  profile?: UserMatchProfile,
): Promise<Opportunity[]> {
  const term = intent.query.trim();
  if (!term) return [];
  const terms = meaningfulQueryTerms(intent);

  try {
    const wants = new Set(intent.entityTypes ?? ["CONTRIBUTION", "PROJECT", "HARDWARE_PROJECT", "EVENT"]);
    const includeRawTerm = Boolean(term && terms.length === 0 && !intent.location);
    const contributionOr = [
      ...(includeRawTerm ? [
        { title: { contains: term, mode: "insensitive" as const } },
        { description: { contains: term, mode: "insensitive" as const } },
        { shortSummary: { contains: term, mode: "insensitive" as const } },
      ] : []),
      ...terms.flatMap((value) => [
        { title: { contains: value, mode: "insensitive" as const } },
        { description: { contains: value, mode: "insensitive" as const } },
        { shortSummary: { contains: value, mode: "insensitive" as const } },
      ]),
      ...(terms.length ? [{ technologies: { hasSome: terms } }, { languages: { hasSome: terms } }, { topics: { hasSome: terms } }, { skillsRequired: { hasSome: terms } }] : []),
      ...(intent.technologies?.length ? [{ technologies: { hasSome: intent.technologies } }] : []),
      ...(intent.skills?.length ? [{ languages: { hasSome: intent.skills } }] : []),
    ];
    const projectOr = [
      ...(includeRawTerm ? [
        { title: { contains: term, mode: "insensitive" as const } },
        { description: { contains: term, mode: "insensitive" as const } },
      ] : []),
      ...terms.flatMap((value) => [
        { title: { contains: value, mode: "insensitive" as const } },
        { description: { contains: value, mode: "insensitive" as const } },
      ]),
      ...(terms.length ? [{ technologies: { hasSome: terms } }, { languages: { hasSome: terms } }, { topics: { hasSome: terms } }] : []),
    ];
    const eventOr = [
      ...(includeRawTerm ? [
        { title: { contains: term, mode: "insensitive" as const } },
        { description: { contains: term, mode: "insensitive" as const } },
        { location: { contains: term, mode: "insensitive" as const } },
      ] : []),
      ...terms.flatMap((value) => [
        { title: { contains: value, mode: "insensitive" as const } },
        { description: { contains: value, mode: "insensitive" as const } },
        { location: { contains: value, mode: "insensitive" as const } },
      ]),
      ...(terms.length ? [{ technologies: { hasSome: terms } }, { topics: { hasSome: terms } }] : []),
    ];
    const [contributions, projects, events] = await Promise.all([
      wants.has("CONTRIBUTION")
        ? prisma.contributionOpportunity.findMany({
            where: {
              ...(contributionOr.length ? { OR: contributionOr } : {}),
              ...(intent.hardware !== undefined ? { hardware: intent.hardware } : {}),
              ...(intent.beginnerFriendly ? { beginnerFriendly: true } : {}),
              ...(intent.goodFirstIssue ? { goodFirstIssue: true } : {}),
              ...(intent.helpWanted ? { helpWanted: true } : {}),
            },
            take: 40,
            orderBy: [{ qualityScore: "desc" }, { lastActivity: "desc" }],
          })
        : Promise.resolve([]),
      wants.has("PROJECT") || wants.has("HARDWARE_PROJECT")
        ? prisma.project.findMany({
            where: {
              ...(projectOr.length ? { OR: projectOr } : {}),
              ...(intent.hardware !== undefined ? { hardware: intent.hardware } : {}),
              archived: false,
            },
            include: { repository: true, organization: true },
            take: intent.location && !terms.length ? 100 : 30,
            orderBy: [{ qualityScore: "desc" }, { lastActivity: "desc" }],
          })
        : Promise.resolve([]),
      wants.has("EVENT")
        ? prisma.event.findMany({
            where: {
              ...(eventOr.length ? { OR: eventOr } : {}),
              ...(intent.datePreset !== "historical" ? { startsAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) } } : {}),
            },
            include: { organization: true },
            take: 30,
            orderBy: [{ startsAt: "asc" }, { qualityScore: "desc" }],
          })
        : Promise.resolve([]),
    ]);

    const normalized: Opportunity[] = [];

    for (const item of contributions) {
      const description = cleanDescription(item.description, item.title);
      normalized.push({
        id: item.id,
        title: item.title,
        description,
        shortSummary: summarizeDisplayText(item.shortSummary ?? description),
        entityType: "CONTRIBUTION",
        source: item.source,
        canonicalUrl: item.canonicalUrl,
        contributionUrl: item.contributionUrl,
        technologies: cleanTechnologyLabels(item.technologies),
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
        metadata: (item.metadata as Record<string, unknown> | null) ?? undefined,
      });
    }

    for (const item of projects) {
      const description = cleanDescription(item.description, item.title);
      const hardware = item.hardware || detectHardware(item.title, description, item.technologies, item.topics);
      normalized.push({
        id: item.id,
        title: item.title,
        description,
        shortSummary: summarizeDisplayText(description),
        entityType: hardware ? "HARDWARE_PROJECT" : "PROJECT",
        source: "KOBI Index",
        canonicalUrl: item.canonicalUrl,
        repositoryUrl: item.repository?.repositoryUrl,
        organization: item.organization?.name,
        technologies: cleanTechnologyLabels(item.technologies),
        languages: item.languages,
        topics: item.topics,
        skillsRequired: [...new Set([...cleanTechnologyLabels(item.technologies), ...item.languages])],
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
        contributionTypes: hardware ? ["Hardware", "General"] : ["General"],
        hardware,
        qualityScore: item.qualityScore,
        freshnessScore: item.freshnessScore,
        matchScore: 0,
        scrapedAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        metadata: (item.metadata as Record<string, unknown> | null) ?? undefined,
      });
    }

    for (const item of events) {
      const mode = item.mode;
      const description = cleanDescription(item.description, item.title);
      normalized.push({
        id: item.id,
        title: item.title,
        description,
        shortSummary: summarizeDisplayText(description),
        entityType: "EVENT",
        source: item.source,
        canonicalUrl: item.canonicalUrl,
        registrationUrl: item.registrationUrl ?? item.canonicalUrl,
        organization: item.organization?.name,
        technologies: cleanTechnologyLabels(item.technologies),
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
        mode,
        eventDate: item.startsAt?.toISOString(),
        deadline: item.deadline?.toISOString(),
        contributionTypes: [item.eventType || "Event"],
        hardware: detectHardware(item.title, description, item.technologies, item.topics),
        qualityScore: item.qualityScore,
        freshnessScore: item.freshnessScore,
        matchScore: 0,
        scrapedAt: item.scrapedAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        metadata: (item.metadata as Record<string, unknown> | null) ?? undefined,
      });
    }

    const filtered = applySearchFilters(normalized, intent);
    return rankOpportunities(filtered, profile, intent).slice(0, intent.limit ?? 40).map((item) => ({
      ...item,
      id: item.id || stableOpportunityId("index", item.canonicalUrl),
      matchScore: calculateMatchScore(item, profile, intent),
      updatedAt: item.updatedAt || nowIso(),
      scrapedAt: item.scrapedAt || nowIso(),
    }));
  } catch {
    // A missing/unmigrated database must not break public live discovery.
    return [];
  }
}
