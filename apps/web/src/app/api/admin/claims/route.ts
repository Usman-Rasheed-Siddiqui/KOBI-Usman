import { auth } from "@/lib/auth";
import { prisma } from "@openforge/database";
import { headers } from "next/headers";
import { z } from "zod";

async function adminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.role === "ADMIN" ? session : null;
}

export async function GET() {
  if (!(await adminSession())) return Response.json({ error: "Admin access required" }, { status: 403 });
  const claims = await prisma.maintainerClaim.findMany({
    include: { user: { select: { id: true, name: true, email: true } }, project: { include: { repository: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return Response.json({ claims });
}

const schema = z.object({ claimId: z.string().min(1), status: z.enum(["VERIFIED", "REJECTED"]), notes: z.string().trim().max(1000).optional() });

export async function PATCH(request: Request) {
  const session = await adminSession();
  if (!session) return Response.json({ error: "Admin access required" }, { status: 403 });
  const body = schema.parse(await request.json());
  const claim = await prisma.maintainerClaim.update({
    where: { id: body.claimId },
    data: { status: body.status, notes: body.notes, reviewedBy: session.user.id, verifiedAt: body.status === "VERIFIED" ? new Date() : null },
  });
  if (body.status === "VERIFIED") {
    await Promise.all([
      prisma.projectMember.upsert({ where: { projectId_userId: { projectId: claim.projectId, userId: claim.userId } }, update: { role: "Maintainer", status: "ACTIVE" }, create: { projectId: claim.projectId, userId: claim.userId, role: "Maintainer", status: "ACTIVE" } }),
      prisma.user.update({ where: { id: claim.userId }, data: { role: "MAINTAINER" } }),
    ]);
  }
  return Response.json({ claim });
}
