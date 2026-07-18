import { auth } from "@/lib/auth";
import { prisma } from "@openforge/database";
import { safeFetchJson } from "@openforge/discovery";
import { headers } from "next/headers";
import { z } from "zod";

const allowedHosts = new Set(["github.com", "gitlab.com", "codeberg.org"]);
const signals = ["Recommended First Issue", "Mentor Available", "Needs Designer", "Needs Documentation", "Needs Hardware Tester", "Needs Firmware", "Needs Researcher"] as const;

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("claim"),
    repositoryUrl: z.string().url().max(500),
    evidenceUrl: z.string().url().max(500).optional(),
  }),
  z.object({
    action: z.literal("signals"),
    projectId: z.string().min(1),
    signals: z.array(z.enum(signals)).max(signals.length),
  }),
]);

function normalizeRepository(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase())) throw new Error("Use a public GitHub, GitLab, or Codeberg repository URL.");
  const parts = url.pathname.replace(/\.git$/i, "").split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("Repository URL must include an owner and repository name.");
  const owner = parts[0]!;
  const name = parts[1]!;
  const canonicalUrl = `https://${url.hostname.toLowerCase()}/${owner}/${name}`;
  const provider = url.hostname === "github.com" ? "github" : url.hostname === "gitlab.com" ? "gitlab" : "codeberg";
  return { owner, name, canonicalUrl, provider };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "project";
}

async function canAutoVerifyGithub(userId: string, owner: string, name: string) {
  const account = await prisma.account.findFirst({ where: { userId, providerId: "github" }, select: { accessToken: true } });
  if (!account?.accessToken) return false;
  try {
    const repo = await safeFetchJson<{ permissions?: { admin?: boolean; maintain?: boolean; push?: boolean } }>(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
      approvedHosts: ["api.github.com"],
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${account.accessToken}`,
        "x-github-api-version": "2022-11-28",
      },
    });
    return Boolean(repo.permissions?.admin || repo.permissions?.maintain || repo.permissions?.push);
  } catch {
    return false;
  }
}

async function canManage(userId: string, projectId: string) {
  const [membership, claim] = await Promise.all([
    prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } }),
    prisma.maintainerClaim.findUnique({ where: { projectId_userId: { projectId, userId } } }),
  ]);
  return membership?.status === "ACTIVE" && ["owner", "maintainer", "manager"].includes(membership.role.toLowerCase()) || claim?.status === "VERIFIED";
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const [claims, projects] = await Promise.all([
      prisma.maintainerClaim.findMany({
        where: { userId: session.user.id },
        include: { project: { include: { repository: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.project.findMany({
        where: {
          OR: [
            { members: { some: { userId: session.user.id, status: "ACTIVE", role: { in: ["Owner", "Maintainer", "Manager", "OWNER", "MAINTAINER", "MANAGER"] } } } },
            { maintainerClaims: { some: { userId: session.user.id, status: "VERIFIED" } } },
          ],
        },
        include: {
          repository: true,
          opportunities: { orderBy: [{ beginnerFriendly: "desc" }, { lastActivity: "desc" }], take: 8 },
          roleSlots: { where: { open: true } },
          members: { where: { status: "ACTIVE" } },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
    ]);
    return Response.json({ claims, projects, signals });
  } catch {
    return Response.json({ claims: [], projects: [], signals });
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    if (body.action === "signals") {
      if (!(await canManage(session.user.id, body.projectId))) return Response.json({ error: "Maintainer access required" }, { status: 403 });
      const current = await prisma.project.findUnique({ where: { id: body.projectId }, select: { metadata: true } });
      if (!current) return Response.json({ error: "Project not found" }, { status: 404 });
      const metadata = current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata) ? current.metadata as Record<string, unknown> : {};
      const project = await prisma.project.update({
        where: { id: body.projectId },
        data: {
          metadata: { ...metadata, maintainerSignals: body.signals },
          beginnerScore: body.signals.includes("Recommended First Issue") ? Math.max(80, await currentBeginnerScore(body.projectId)) : undefined,
        },
      });
      return Response.json({ project });
    }

    const parsed = normalizeRepository(body.repositoryUrl);
    let project = await prisma.project.findFirst({
      where: { OR: [{ canonicalUrl: parsed.canonicalUrl }, { repository: { repositoryUrl: parsed.canonicalUrl } }] },
      include: { repository: true },
    });
    if (!project) {
      const id = crypto.randomUUID();
      project = await prisma.project.create({
        data: {
          id,
          title: `${parsed.owner}/${parsed.name}`,
          slug: `${slugify(`${parsed.owner}-${parsed.name}`)}-${id.slice(0, 8)}`,
          canonicalUrl: parsed.canonicalUrl,
          entityType: "PROJECT",
          hardware: false,
          technologies: [],
          languages: [],
          topics: [],
          sourceId: parsed.provider,
          sourceExternalId: `${parsed.owner}/${parsed.name}`,
          metadata: { importedForClaim: true },
          repository: { create: { provider: parsed.provider, owner: parsed.owner, name: parsed.name, repositoryUrl: parsed.canonicalUrl } },
        },
        include: { repository: true },
      });
    }

    const verified = parsed.provider === "github" ? await canAutoVerifyGithub(session.user.id, parsed.owner, parsed.name) : false;
    const claim = await prisma.maintainerClaim.upsert({
      where: { projectId_userId: { projectId: project.id, userId: session.user.id } },
      update: { evidenceUrl: body.evidenceUrl, provider: parsed.provider, status: verified ? "VERIFIED" : "PENDING", verifiedAt: verified ? new Date() : null, notes: verified ? "Verified from connected GitHub repository permissions." : null },
      create: { projectId: project.id, userId: session.user.id, evidenceUrl: body.evidenceUrl, provider: parsed.provider, status: verified ? "VERIFIED" : "PENDING", verifiedAt: verified ? new Date() : null, notes: verified ? "Verified from connected GitHub repository permissions." : null },
    });

    if (verified) {
      await Promise.all([
        prisma.projectMember.upsert({ where: { projectId_userId: { projectId: project.id, userId: session.user.id } }, update: { role: "Maintainer", status: "ACTIVE" }, create: { projectId: project.id, userId: session.user.id, role: "Maintainer", status: "ACTIVE" } }),
        session.user.role === "USER" ? prisma.user.update({ where: { id: session.user.id }, data: { role: "MAINTAINER" } }) : Promise.resolve(),
      ]);
    }

    return Response.json({ claim, autoVerified: verified, project });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid maintainer request" }, { status: 400 });
  }
}

async function currentBeginnerScore(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { beginnerScore: true } });
  return project?.beginnerScore ?? 0;
}
