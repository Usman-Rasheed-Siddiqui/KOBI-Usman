import { prisma } from "@openforge/database";
import type { UserMatchProfile } from "@openforge/domain";
import { headers } from "next/headers";
import { auth } from "./auth";

type GithubRepo = { language?: string | null; topics?: string[]; fork?: boolean };

async function syncGithubFitSignals(userId: string) {
  const [account, profile] = await Promise.all([
    prisma.account.findFirst({ where: { userId, providerId: "github" }, select: { accessToken: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { contributionDna: true } }),
  ]);
  if (!account?.accessToken) return;

  const dna = profile?.contributionDna && typeof profile.contributionDna === "object" && !Array.isArray(profile.contributionDna)
    ? profile.contributionDna as Record<string, unknown>
    : {};
  const github = dna.github && typeof dna.github === "object" && !Array.isArray(dna.github) ? dna.github as Record<string, unknown> : {};
  const syncedAt = typeof github.syncedAt === "string" ? Date.parse(github.syncedAt) : 0;
  if (Number.isFinite(syncedAt) && Date.now() - syncedAt < 6 * 60 * 60_000) return;

  const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=20&affiliation=owner,collaborator,organization_member", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${account.accessToken}`,
      "user-agent": "KOBIFit/1.0",
      "x-github-api-version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!response.ok) return;
  const repos = await response.json() as GithubRepo[];
  const languages = [...new Set(repos.filter((repo) => !repo.fork).map((repo) => repo.language).filter((value): value is string => Boolean(value)))].slice(0, 10);
  const topics = [...new Set(repos.filter((repo) => !repo.fork).flatMap((repo) => repo.topics ?? []))].slice(0, 12);
  const skills = [...languages, ...topics].slice(0, 18);

  await prisma.profile.upsert({
    where: { userId },
    create: { userId, interests: topics, goals: [], contributionDna: { github: { syncedAt: new Date().toISOString(), languages, topics } } },
    update: { contributionDna: { ...dna, github: { ...github, syncedAt: new Date().toISOString(), languages, topics } } },
  });

  for (const name of skills) {
    const skill = await prisma.skill.upsert({ where: { name }, create: { name }, update: {} });
    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: skill.id } },
      create: { userId, skillId: skill.id, evidenceType: "VERIFIED", strength: 65 },
      update: { evidenceType: "VERIFIED", strength: 65 },
    });
  }
}

/**
 * Resolve the signed-in user's opt-in matching profile.
 * Failure is deliberately non-fatal so public discovery never depends on the database.
 */
export async function getCurrentUserMatchProfile(): Promise<UserMatchProfile | undefined> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return undefined;
    await syncGithubFitSignals(session.user.id).catch(() => undefined);
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        profile: { select: { interests: true, experienceLevel: true, personalizationEnabled: true } },
        skills: { select: { skill: { select: { name: true } } } },
      },
    });
    if (!user?.profile?.personalizationEnabled) return undefined;
    return {
      skills: user.skills.map((item: { skill: { name: string } }) => item.skill.name),
      interests: user.profile.interests,
      level: user.profile.experienceLevel,
    };
  } catch {
    return undefined;
  }
}
