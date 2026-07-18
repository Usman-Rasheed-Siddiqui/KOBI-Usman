import { auth } from "@/lib/auth";
import { prisma } from "@openforge/database";
import { headers } from "next/headers";
import { z } from "zod";

async function userId() {
  return (await auth.api.getSession({ headers: await headers() }))?.user.id;
}

export async function GET() {
  const id = await userId();
  if (!id) return Response.json({ notifications: [], unread: 0 });
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.notification.count({ where: { userId: id, read: false } }),
  ]);
  return Response.json({ notifications, unread });
}

const patchSchema = z.object({ id: z.string().optional(), all: z.boolean().optional() }).refine((value) => value.id || value.all, "Notification id or all=true is required");

export async function PATCH(request: Request) {
  const userIdValue = await userId();
  if (!userIdValue) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = patchSchema.parse(await request.json());
  await prisma.notification.updateMany({
    where: { userId: userIdValue, ...(body.id ? { id: body.id } : {}), read: false },
    data: { read: true },
  });
  return Response.json({ ok: true });
}
