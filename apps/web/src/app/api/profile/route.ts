import { auth } from "@/lib/auth";
import { prisma, type Difficulty, type Prisma } from "@openforge/database";
import { headers } from "next/headers";
import { z } from "zod";

const schema = z.object({
  headline: z.string().max(160).optional(),
  bio: z.string().max(1200).optional(),
  location: z.string().max(120).optional(),
  timezone: z.string().max(80).optional(),
  availability: z.string().max(80).optional(),
  experienceLevel: z.enum(["STARTING", "BEGINNER", "INTERMEDIATE", "ADVANCED", "UNKNOWN"]),
  interests: z.array(z.string().max(80)).max(30),
  goals: z.array(z.string().max(120)).max(20),
  githubUsername: z.string().max(80).optional(),
  openToCollaboration: z.boolean().default(true),
  skills: z.array(z.object({
    name: z.string().max(80),
    level: z.enum(["STARTING", "BEGINNER", "INTERMEDIATE", "ADVANCED", "UNKNOWN"]),
  })).max(50),
});

type GithubUser = {
  login: string;
  avatar_url?: string;
  html_url: string;
  bio?: string | null;
  location?: string | null;
  blog?: string | null;
  company?: string | null;
  public_repos?: number;
  followers?: number;
};

type GithubRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description?: string | null;
  language?: string | null;
  topics?: string[];
  stargazers_count: number;
  fork: boolean;
  pushed_at: string;
};

async function session() {
  return auth.api.getSession({ headers: await headers() });
}

function githubHeaders(token: string) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "KOBIProfile/1.0",
    "x-github-api-version": "2022-11-28",
  };
}

async function fetchGithub<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders(token), cache: "no-store" });
  if (!response.ok) throw new Error(`GitHub profile sync failed (${response.status})`);
  return response.json() as Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function frameworkTopics(repos: GithubRepo[]) {
  const known = new Set(["react", "nextjs", "next.js", "typescript", "javascript", "python", "django", "fastapi", "node", "nodejs", "rust", "go", "ai", "ml", "llm", "docker", "kubernetes", "expo", "react-native", "prisma", "postgres"]);
  return [...new Set(repos.flatMap((repo) => repo.topics ?? []).filter((topic) => known.has(topic.toLowerCase())))]
    .map((topic) => topic === "nextjs" ? "Next.js" : topic === "nodejs" ? "Node.js" : topic);
}

async function upsertSkill(userId: string, name: string, strength: number) {
  const skill = await prisma.skill.upsert({ where: { name }, create: { name }, update: {} });
  await prisma.userSkill.upsert({
    where: { userId_skillId: { userId, skillId: skill.id } },
    create: { userId, skillId: skill.id, level: "UNKNOWN", evidenceType: "VERIFIED", strength },
    update: { evidenceType: "VERIFIED", strength },
  });
}

async function syncGithubProfile(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "github" },
    select: { accessToken: true },
  });
  if (!account?.accessToken) return undefined;

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { contributionDna: true, location: true } });
  const previous = isRecord(profile?.contributionDna) ? profile.contributionDna : {};
  const githubPrevious = isRecord(previous.github) ? previous.github : {};
  const syncedAt = typeof githubPrevious.syncedAt === "string" ? Date.parse(githubPrevious.syncedAt) : 0;
  if (Number.isFinite(syncedAt) && Date.now() - syncedAt < 6 * 60 * 60_000) return githubPrevious;

  const [githubUser, repos] = await Promise.all([
    fetchGithub<GithubUser>("/user", account.accessToken),
    fetchGithub<GithubRepo[]>("/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator,organization_member", account.accessToken),
  ]);

  const sourceRepos = repos.filter((repo) => !repo.fork).slice(0, 20);
  const languageCounts = new Map<string, number>();
  for (const repo of sourceRepos) {
    if (repo.language) languageCounts.set(repo.language, (languageCounts.get(repo.language) ?? 0) + 1);
  }
  const topLanguages = [...languageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const frameworks = frameworkTopics(sourceRepos).slice(0, 10);
  const topRepos = sourceRepos.slice(0, 6).map((repo) => ({
    name: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    language: repo.language,
    topics: repo.topics ?? [],
    stars: repo.stargazers_count,
    pushedAt: repo.pushed_at,
  }));

  const github = {
    username: githubUser.login,
    url: githubUser.html_url,
    avatarUrl: githubUser.avatar_url,
    bio: githubUser.bio,
    location: githubUser.location,
    blog: githubUser.blog,
    company: githubUser.company,
    publicRepos: githubUser.public_repos ?? sourceRepos.length,
    followers: githubUser.followers ?? 0,
    languages: topLanguages.map(([name, count]) => ({ name, count })),
    frameworks,
    projects: topRepos,
    syncedAt: new Date().toISOString(),
  };

  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      interests: frameworks,
      goals: [],
      githubUsername: githubUser.login,
      location: githubUser.location ?? undefined,
      contributionDna: { ...previous, github } as Prisma.InputJsonValue,
    },
    update: {
      githubUsername: githubUser.login,
      location: profile?.location || githubUser.location || undefined,
      contributionDna: { ...previous, github } as Prisma.InputJsonValue,
    },
  });

  for (const [name, count] of topLanguages) await upsertSkill(userId, name, Math.min(95, 55 + count * 8));
  for (const topic of frameworks) await upsertSkill(userId, topic, 65);

  return github;
}

async function saveProfile(userId: string, body: z.infer<typeof schema>) {
  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      headline: body.headline,
      bio: body.bio,
      location: body.location,
      timezone: body.timezone,
      availability: body.availability,
      experienceLevel: body.experienceLevel,
      interests: body.interests,
      goals: body.goals,
      githubUsername: body.githubUsername,
      openToCollaboration: body.openToCollaboration,
    },
    update: {
      headline: body.headline,
      bio: body.bio,
      location: body.location,
      timezone: body.timezone,
      availability: body.availability,
      experienceLevel: body.experienceLevel,
      interests: body.interests,
      goals: body.goals,
      githubUsername: body.githubUsername,
      openToCollaboration: body.openToCollaboration,
    },
  });

  for (const input of body.skills) {
    const skill = await prisma.skill.upsert({ where: { name: input.name }, create: { name: input.name }, update: {} });
    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: skill.id } },
      create: { userId, skillId: skill.id, level: input.level as Difficulty },
      update: { level: input.level as Difficulty },
    });
  }
}

export async function GET() {
  const current = await session();
  if (!current) return Response.json({ error: "Authentication required" }, { status: 401 });

  const github = await syncGithubProfile(current.user.id).catch(() => undefined);
  const data = await prisma.user.findUnique({
    where: { id: current.user.id },
    include: { profile: true, skills: { include: { skill: true } }, contributions: true },
  });
  return Response.json({ user: data, github });
}

export async function POST(request: Request) {
  const current = await session();
  if (!current) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = schema.parse(await request.json());
  await saveProfile(current.user.id, body);
  await syncGithubProfile(current.user.id).catch(() => undefined);
  return Response.json({ ok: true });
}
