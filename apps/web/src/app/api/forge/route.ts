import { runForgeAgent, type ForgeAgentContext } from "@openforge/ai";
import { prisma, type Prisma } from "@openforge/database";
import { checkRateLimit, getClientIp } from "@openforge/security";
import { headers } from "next/headers";
import { z } from "zod";
import { persistOpportunities } from "@/lib/persist-opportunities";
import { auth } from "@/lib/auth";
import { getCurrentUserMatchProfile } from "@/lib/personalization";
import { searchIndexed } from "@/lib/indexed-search";

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) })).max(20).optional(),
  context: z
    .object({
      conversationId: z.string().optional(),
      lastIntent: z.record(z.string(), z.unknown()).optional(),
      lastResults: z.array(z.object({
        id: z.string(),
        title: z.string(),
        entityType: z.string(),
        url: z.string(),
        source: z.string(),
        technologies: z.array(z.string()).optional(),
        topics: z.array(z.string()).optional(),
      })).max(30).optional(),
      resultPool: z.array(z.record(z.string(), z.unknown())).max(40).optional(),
      shownResultIds: z.array(z.string()).max(80).optional(),
      shownResultKeys: z.array(z.string()).max(140).optional(),
      resultCursor: z.number().int().nonnegative().optional(),
      selectedId: z.string().optional(),
      lastRoute: z.string().optional(),
    })
    .optional(),
  profile: z
    .object({
      skills: z.array(z.string()).default([]),
      interests: z.array(z.string()).default([]),
      level: z.enum(["STARTING", "BEGINNER", "INTERMEDIATE", "ADVANCED", "UNKNOWN"]).optional(),
    })
    .optional(),
});

async function saveAgentTurn(input: {
  userId?: string;
  message: string;
  result: Awaited<ReturnType<typeof runForgeAgent>>;
  incomingContext?: ForgeAgentContext;
}) {
  const context = input.result.context;
  const existingId = input.incomingContext?.conversationId;
  const ownedConversation = existingId
    ? await prisma.chatConversation.findFirst({
        where: {
          id: existingId,
          userId: input.userId ?? null,
        },
        select: { id: true },
      }).catch(() => null)
    : null;
  const conversation = ownedConversation
    ? await prisma.chatConversation.update({
        where: { id: ownedConversation.id },
        data: { context: context as Prisma.InputJsonValue },
      })
    : null;
  const saved = conversation ?? await prisma.chatConversation.create({
    data: {
      userId: input.userId,
      title: input.message.slice(0, 80),
      context: context as Prisma.InputJsonValue,
    },
  });

  await prisma.chatMessage.create({
    data: {
      conversationId: saved.id,
      role: "user",
      content: input.message,
    },
  });
  const assistant = await prisma.chatMessage.create({
    data: {
      conversationId: saved.id,
      role: "assistant",
      content: input.result.text,
      metadata: {
        context,
        resultIds: input.result.opportunities.map((item) => item.id),
      } as Prisma.InputJsonValue,
    },
  });
  if (input.result.events.length) {
    await prisma.toolInvocation.createMany({
      data: input.result.events.map((event) => ({
        messageId: assistant.id,
        toolName: event.tool,
        input: {},
        output: { detail: event.detail, data: event.data } as Prisma.InputJsonValue,
        status: event.status,
        completedAt: event.status === "started" ? null : new Date(),
      })),
    });
  }

  return {
    ...input.result,
    context: { ...context, conversationId: saved.id },
  };
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`forge:${getClientIp(request.headers)}`, 20, 60_000);
  if (!rate.allowed) {
    return Response.json({ error: "KOBI Agent is receiving too many requests. Try again shortly." }, { status: 429 });
  }

  try {
    const body = schema.parse(await request.json());
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
    const profile = body.profile ?? (await getCurrentUserMatchProfile());
    const result = await runForgeAgent(body.message, profile, body.history ?? [], body.context as ForgeAgentContext | undefined, {
      searchIndexed,
      persist: (items) => persistOpportunities(items, { workflow: "agent", query: body.message }),
    });
    return Response.json(await saveAgentTurn({
      userId: session?.user.id,
      message: body.message,
      result,
      incomingContext: body.context as ForgeAgentContext | undefined,
    }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
