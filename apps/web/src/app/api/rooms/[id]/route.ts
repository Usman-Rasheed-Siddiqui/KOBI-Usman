import { auth } from "@/lib/auth";
import { prisma } from "@openforge/database";
import { headers } from "next/headers";
import { z } from "zod";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("post"), content: z.string().trim().min(1).max(5000), kind: z.enum(["DISCUSSION", "UPDATE"]).default("DISCUSSION") }),
  z.object({ action: z.literal("task"), title: z.string().trim().min(1).max(180), description: z.string().trim().max(1500).optional() }),
  z.object({ action: z.literal("task-status"), taskId: z.string(), status: z.enum(["TODO", "IN_PROGRESS", "DONE"]) }),
  z.object({ action: z.literal("join"), roleId: z.string(), message: z.string().trim().max(1200).optional() }),
  z.object({ action: z.literal("role"), title: z.string().trim().min(2).max(100), description: z.string().trim().max(800).optional(), slots: z.number().int().min(1).max(50), skills: z.array(z.string().max(60)).max(12) }),
  z.object({ action: z.literal("request-status"), requestId: z.string(), status: z.enum(["ACTIVE", "REJECTED"]) }),
]);

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  try {
    const room = await prisma.project.findUnique({
      where: { id },
      include: {
        roleSlots: { include: { requests: { include: { requester: { select: { id: true, name: true, image: true } } } } } },
        members: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, name: true, image: true } } } },
        tasks: { orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }], take: 100 },
        posts: { orderBy: { createdAt: "desc" }, take: 60, include: { author: { select: { id: true, name: true, image: true } } } },
      },
    });
    if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
    const membership = session ? room.members.find((member: { userId: string }) => member.userId === session.user.id) : undefined;
    return Response.json({ room, viewer: { signedIn: Boolean(session), userId: session?.user.id, membership: membership ? { role: membership.role, status: membership.status } : null, manager: Boolean(membership && ["Owner", "Maintainer"].includes(membership.role)) } });
  } catch {
    return Response.json({ error: "Room storage is unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const body = actionSchema.parse(await request.json());
  const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: id, userId: session.user.id } } });
  const activeMember = membership?.status === "ACTIVE";
  const manager = activeMember && ["Owner", "Maintainer"].includes(membership.role);

  if (body.action === "join") {
    const role = await prisma.projectRole.findFirst({ where: { id: body.roleId, projectId: id, open: true } });
    if (!role) return Response.json({ error: "Role is no longer open" }, { status: 404 });
    const joinRequest = await prisma.collaborationRequest.upsert({
      where: { projectRoleId_requesterId: { projectRoleId: role.id, requesterId: session.user.id } },
      create: { projectRoleId: role.id, requesterId: session.user.id, message: body.message },
      update: { message: body.message, status: "PENDING" },
    });
    return Response.json({ joinRequest });
  }

  if (!activeMember) return Response.json({ error: "Active project membership required" }, { status: 403 });

  if (body.action === "post") {
    const post = await prisma.projectPost.create({ data: { projectId: id, authorId: session.user.id, content: body.content, kind: body.kind } });
    return Response.json({ post });
  }
  if (body.action === "task") {
    const task = await prisma.projectTask.create({ data: { projectId: id, title: body.title, description: body.description } });
    return Response.json({ task });
  }
  if (body.action === "task-status") {
    const task = await prisma.projectTask.updateMany({ where: { id: body.taskId, projectId: id }, data: { status: body.status } });
    return Response.json({ task });
  }
  if (body.action === "role") {
    if (!manager) return Response.json({ error: "Owner or maintainer access required" }, { status: 403 });
    const role = await prisma.projectRole.create({ data: { projectId: id, title: body.title, description: body.description, slots: body.slots, skills: body.skills } });
    return Response.json({ role });
  }
  if (body.action === "request-status") {
    if (!manager) return Response.json({ error: "Owner or maintainer access required" }, { status: 403 });
    const joinRequest = await prisma.collaborationRequest.findFirst({ where: { id: body.requestId, role: { projectId: id } }, include: { role: true } });
    if (!joinRequest) return Response.json({ error: "Request not found" }, { status: 404 });
    if (body.status === "ACTIVE") {
      await prisma.$transaction([
        prisma.collaborationRequest.update({ where: { id: joinRequest.id }, data: { status: "ACTIVE" } }),
        prisma.projectMember.upsert({
          where: { projectId_userId: { projectId: id, userId: joinRequest.requesterId } },
          create: { projectId: id, userId: joinRequest.requesterId, role: joinRequest.role.title, status: "ACTIVE" },
          update: { role: joinRequest.role.title, status: "ACTIVE" },
        }),
      ]);
    } else {
      await prisma.collaborationRequest.update({ where: { id: joinRequest.id }, data: { status: "REJECTED" } });
    }
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unsupported room action" }, { status: 400 });
}
