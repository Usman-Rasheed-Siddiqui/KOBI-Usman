import { auth } from "@/lib/auth";
import { prisma } from "@openforge/database";
import { headers } from "next/headers";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  hardware: z.boolean().default(false),
  technologies: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  roles: z.array(z.object({ title: z.string().trim().min(2).max(100), slots: z.number().int().min(1).max(50), skills: z.array(z.string().max(60)).max(12) })).max(12).default([]),
});

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "project";
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  try {
    const rooms = await prisma.project.findMany({
      where: {
        metadata: { path: ["KOBIRoom"], equals: true },
        ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] } : {}),
      },
      include: {
        roleSlots: { where: { open: true } },
        members: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, name: true, image: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
    return Response.json({ rooms });
  } catch {
    return Response.json({ rooms: [] });
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = createSchema.parse(await request.json());
  const id = crypto.randomUUID();
  const base = (process.env.KOBI_BASE_URL ?? process.env.OPENFORGE_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const room = await prisma.project.create({
    data: {
      id,
      title: body.title,
      slug: `${slugify(body.title)}-${id.slice(0, 8)}`,
      description: body.description,
      canonicalUrl: `${base}/project/${id}`,
      entityType: body.hardware ? "HARDWARE_PROJECT" : "PROJECT",
      hardware: body.hardware,
      technologies: body.technologies,
      languages: [],
      topics: ["KOBI Room"],
      metadata: { KOBIRoom: true, createdBy: session.user.id },
      members: { create: { userId: session.user.id, role: "Owner", status: "ACTIVE" } },
      roleSlots: { create: body.roles.map((role) => ({ ...role, open: true })) },
    },
    include: { roleSlots: true, members: { include: { user: { select: { id: true, name: true, image: true } } } } },
  });
  return Response.json({ room }, { status: 201 });
}
