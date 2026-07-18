import { cleanDescription, cleanTechnologyLabels, summarizeDisplayText, type Opportunity } from "@openforge/domain";
import { Prisma, prisma } from "./index";

export type DiscoveryWorkflow = "discover" | "agent" | "worker" | "scraper" | "system";

export type PersistOpportunityOptions = {
  workflow?: DiscoveryWorkflow;
  query?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function json(value: Record<string, unknown>) {
  return value as Prisma.InputJsonValue;
}

function dateOrNull(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateOrUndefined(value: string | undefined) {
  return dateOrNull(value) ?? undefined;
}

function slugFrom(item: Opportunity) {
  return `${item.canonicalUrl.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 110) || "project"}-${item.id.slice(-8)}`;
}

function mergeMetadata(item: Opportunity, previous: unknown, options: PersistOpportunityOptions) {
  const now = new Date().toISOString();
  const workflow = options.workflow ?? "discover";
  const previousObject = isRecord(previous) ? previous : {};
  const itemObject = isRecord(item.metadata) ? item.metadata : {};
  const previousContexts = Array.isArray(previousObject.discoveryContexts)
    ? previousObject.discoveryContexts.filter(isRecord)
    : [];
  const previousWorkflows = Array.isArray(previousObject.discoveryWorkflows)
    ? previousObject.discoveryWorkflows.filter((value): value is string => typeof value === "string")
    : typeof previousObject.discoveredVia === "string"
      ? [previousObject.discoveredVia]
      : [];
  const nextContext = {
    workflow,
    query: options.query?.trim() || undefined,
    seenAt: now,
  };

  return json({
    ...previousObject,
    ...itemObject,
    discoveredVia: workflow,
    discoveryWorkflows: [...new Set([...previousWorkflows, workflow])],
    discoveryContexts: [nextContext, ...previousContexts].slice(0, 10),
    sourceItemId: item.id,
    lastSeenAt: now,
    lastScrapedAt: item.scrapedAt,
  });
}

export async function persistOpportunities(items: Opportunity[], options: PersistOpportunityOptions = {}) {
  for (const item of items) {
    const technologies = cleanTechnologyLabels(item.technologies);
    const description = cleanDescription(item.description, item.title);
    const shortSummary = summarizeDisplayText(item.shortSummary ?? description);

    if (item.entityType === "EVENT") {
      const existing = await prisma.event.findUnique({
        where: { canonicalUrl: item.canonicalUrl },
        select: { metadata: true },
      });
      const metadata = mergeMetadata(item, existing?.metadata, options);
      const startsAt = dateOrNull(item.eventDate);
      const deadline = dateOrNull(item.deadline);
      const endsAt = typeof item.metadata?.end === "string" ? dateOrNull(item.metadata.end) : null;

      await prisma.event.upsert({
        where: { canonicalUrl: item.canonicalUrl },
        update: {
          title: item.title,
          description,
          registrationUrl: item.registrationUrl,
          source: item.source,
          sourceExternalId: item.id,
          eventType: item.contributionTypes[0] ?? "Event",
          technologies,
          topics: item.topics,
          location: item.location,
          city: typeof item.metadata?.city === "string" ? item.metadata.city : undefined,
          country: typeof item.metadata?.country === "string" ? item.metadata.country : undefined,
          mode: item.mode ?? "UNKNOWN",
          startsAt,
          endsAt,
          deadline,
          registrationOpen: deadline ? deadline.getTime() >= Date.now() : undefined,
          qualityScore: item.qualityScore,
          freshnessScore: item.freshnessScore,
          metadata,
          scrapedAt: dateOrUndefined(item.scrapedAt) ?? new Date(),
        },
        create: {
          title: item.title,
          description,
          canonicalUrl: item.canonicalUrl,
          registrationUrl: item.registrationUrl,
          source: item.source,
          sourceExternalId: item.id,
          eventType: item.contributionTypes[0] ?? "Event",
          technologies,
          topics: item.topics,
          location: item.location,
          city: typeof item.metadata?.city === "string" ? item.metadata.city : undefined,
          country: typeof item.metadata?.country === "string" ? item.metadata.country : undefined,
          mode: item.mode ?? "UNKNOWN",
          startsAt,
          endsAt,
          deadline,
          registrationOpen: deadline ? deadline.getTime() >= Date.now() : undefined,
          qualityScore: item.qualityScore,
          freshnessScore: item.freshnessScore,
          metadata,
          scrapedAt: dateOrUndefined(item.scrapedAt) ?? new Date(),
        },
      });
      continue;
    }

    if ((item.entityType === "PROJECT" || item.entityType === "HARDWARE_PROJECT") && item.repositoryUrl) {
      const existing = await prisma.project.findUnique({
        where: { canonicalUrl: item.canonicalUrl },
        select: { metadata: true },
      });
      const metadata = mergeMetadata(item, existing?.metadata, options);
      const project = await prisma.project.upsert({
        where: { canonicalUrl: item.canonicalUrl },
        update: {
          title: item.title,
          description,
          entityType: item.entityType,
          hardware: item.hardware,
          technologies,
          languages: item.languages,
          topics: item.topics,
          license: item.license,
          stars: item.stars,
          contributors: item.contributors,
          openIssues: item.openIssues,
          activityScore: item.activityScore,
          qualityScore: item.qualityScore,
          freshnessScore: item.freshnessScore,
          communityScore: item.maintainerResponsiveness,
          beginnerScore: item.beginnerFriendly ? 80 : 35,
          lastActivity: dateOrNull(item.lastActivity),
          sourceId: item.source.toLowerCase(),
          sourceExternalId: item.id,
          metadata,
        },
        create: {
          title: item.title,
          slug: slugFrom(item),
          description,
          canonicalUrl: item.canonicalUrl,
          entityType: item.entityType,
          hardware: item.hardware,
          technologies,
          languages: item.languages,
          topics: item.topics,
          license: item.license,
          stars: item.stars,
          contributors: item.contributors,
          openIssues: item.openIssues,
          activityScore: item.activityScore,
          qualityScore: item.qualityScore,
          freshnessScore: item.freshnessScore,
          communityScore: item.maintainerResponsiveness,
          beginnerScore: item.beginnerFriendly ? 80 : 35,
          lastActivity: dateOrNull(item.lastActivity),
          sourceId: item.source.toLowerCase(),
          sourceExternalId: item.id,
          metadata,
        },
      });

      try {
        const repoUrl = new URL(item.repositoryUrl);
        const [owner = item.organization ?? "unknown", name = project.slug] = repoUrl.pathname.split("/").filter(Boolean);
        await prisma.repository.upsert({
          where: { projectId: project.id },
          update: { repositoryUrl: item.repositoryUrl, provider: item.source.toLowerCase(), owner, name },
          create: { projectId: project.id, repositoryUrl: item.repositoryUrl, provider: item.source.toLowerCase(), owner, name },
        });
      } catch {
        // Keep the canonical project record even if a source returns a malformed repository URL.
      }
      continue;
    }

    if (item.entityType === "CONTRIBUTION" && item.contributionUrl) {
      const existing = await prisma.contributionOpportunity.findUnique({
        where: { canonicalUrl: item.canonicalUrl },
        select: { metadata: true },
      });
      const metadata = mergeMetadata(item, existing?.metadata, options);
      await prisma.contributionOpportunity.upsert({
        where: { canonicalUrl: item.canonicalUrl },
        update: {
          title: item.title,
          description,
          shortSummary,
          contributionUrl: item.contributionUrl,
          source: item.source,
          sourceExternalId: item.id,
          technologies,
          languages: item.languages,
          topics: item.topics,
          skillsRequired: item.skillsRequired,
          difficulty: item.difficulty,
          estimatedComplexity: item.estimatedComplexity,
          beginnerFriendly: item.beginnerFriendly,
          goodFirstIssue: item.goodFirstIssue,
          helpWanted: item.helpWanted,
          activityScore: item.activityScore,
          maintainerResponsiveness: item.maintainerResponsiveness,
          freshnessScore: item.freshnessScore,
          qualityScore: item.qualityScore,
          contributionTypes: item.contributionTypes,
          hardware: item.hardware,
          lastActivity: dateOrNull(item.lastActivity),
          issueNumber: typeof item.metadata?.issueNumber === "number" ? item.metadata.issueNumber : undefined,
          labels: Array.isArray(item.metadata?.labels) ? item.metadata.labels.filter((label): label is string => typeof label === "string") : item.topics,
          metadata,
          scrapedAt: dateOrUndefined(item.scrapedAt) ?? new Date(),
        },
        create: {
          title: item.title,
          description,
          shortSummary,
          canonicalUrl: item.canonicalUrl,
          contributionUrl: item.contributionUrl,
          source: item.source,
          sourceExternalId: item.id,
          technologies,
          languages: item.languages,
          topics: item.topics,
          skillsRequired: item.skillsRequired,
          difficulty: item.difficulty,
          estimatedComplexity: item.estimatedComplexity,
          beginnerFriendly: item.beginnerFriendly,
          goodFirstIssue: item.goodFirstIssue,
          helpWanted: item.helpWanted,
          activityScore: item.activityScore,
          maintainerResponsiveness: item.maintainerResponsiveness,
          freshnessScore: item.freshnessScore,
          qualityScore: item.qualityScore,
          contributionTypes: item.contributionTypes,
          hardware: item.hardware,
          lastActivity: dateOrNull(item.lastActivity),
          issueNumber: typeof item.metadata?.issueNumber === "number" ? item.metadata.issueNumber : undefined,
          labels: Array.isArray(item.metadata?.labels) ? item.metadata.labels.filter((label): label is string => typeof label === "string") : item.topics,
          metadata,
          scrapedAt: dateOrUndefined(item.scrapedAt) ?? new Date(),
        },
      });
    }
  }
}
