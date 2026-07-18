import { auth } from "@/lib/auth";
import { Prisma, prisma } from "@openforge/database";
import { headers } from "next/headers";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  query: z.string().trim().min(1).max(400),
  filters: z.record(z.string(), z.unknown()).default({}),
});
const updateSchema = z.object({ id: z.string(), enabled: z.boolean() });
const deleteSchema = z.object({ id: z.string() });

async function userId() {
  return (await auth.api.getSession({ headers: await headers() }))?.user.id;
}

export async function POST(request: Request) {
  const id = await userId();
  if (!id) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = createSchema.parse(await request.json());
  const watchlist = await prisma.watchlist.create({ data: { ...body, filters: body.filters as Prisma.InputJsonValue, userId: id } });
  return Response.json({ watchlist });
}

export async function GET() {
  const id = await userId();
  if (!id) return Response.json({ error: "Authentication required" }, { status: 401 });
  const watchlists = await prisma.watchlist.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } });
  return Response.json({ watchlists });
}

export async function PATCH(request: Request) {
  const userIdValue = await userId();
  if (!userIdValue) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = updateSchema.parse(await request.json());
  const result = await prisma.watchlist.updateMany({
    where: { id: body.id, userId: userIdValue },
    data: { enabled: body.enabled },
  });
  if (!result.count) return Response.json({ error: "Radar not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userIdValue = await userId();
  if (!userIdValue) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = deleteSchema.parse(await request.json());
  await prisma.watchlist.deleteMany({ where: { id: body.id, userId: userIdValue } });
  return Response.json({ ok: true });
}
