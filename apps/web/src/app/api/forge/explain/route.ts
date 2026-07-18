import { explainContribution } from "@openforge/ai";
import type { Opportunity } from "@openforge/domain";
export async function POST(request:Request){const body=await request.json() as {opportunity?:Opportunity};if(!body.opportunity)return Response.json({error:"Opportunity required"},{status:400});return Response.json({text:await explainContribution(body.opportunity)})}
