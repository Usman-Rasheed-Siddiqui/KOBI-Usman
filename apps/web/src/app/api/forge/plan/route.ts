import { buildOpportunityPlan, type ForgeAgentContext } from "@openforge/ai";
import type { Opportunity, UserMatchProfile } from "@openforge/domain";
import { getCurrentUserMatchProfile } from "@/lib/personalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json() as {
    opportunity?: Opportunity;
    profile?: UserMatchProfile;
    context?: ForgeAgentContext;
  };
  if (!body.opportunity) return Response.json({ error: "Opportunity required" }, { status: 400 });
  const profile = body.profile ?? await getCurrentUserMatchProfile().catch(() => undefined);
  const plan = await buildOpportunityPlan(body.opportunity, profile, body.context);
  return Response.json({
    plan,
    steps: plan.sections.flatMap((section) => section.items).concat(plan.nextStep).slice(0, 9),
  });
}
