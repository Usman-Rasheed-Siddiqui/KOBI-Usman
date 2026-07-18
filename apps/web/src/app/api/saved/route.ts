import { auth } from "@/lib/auth";
import { Prisma, prisma } from "@openforge/database";
import { headers } from "next/headers";
import { z } from "zod";
const itemSchema=z.object({entityType:z.enum(["PROJECT","CONTRIBUTION","EVENT","HARDWARE_PROJECT","COLLABORATION_REQUEST","ORGANIZATION"]),entityId:z.string(),canonicalUrl:z.string().url(),title:z.string().min(1).max(300),metadata:z.record(z.string(),z.unknown()).optional()});
async function user(){return (await auth.api.getSession({headers:await headers()}))?.user}
export async function GET(){const u=await user();if(!u)return Response.json({error:"Authentication required"},{status:401});return Response.json({items:await prisma.savedItem.findMany({where:{userId:u.id},orderBy:{createdAt:"desc"}})})}
export async function POST(request:Request){const u=await user();if(!u)return Response.json({error:"Authentication required"},{status:401});const b=itemSchema.parse(await request.json());const metadata=b.metadata as Prisma.InputJsonValue|undefined;const item=await prisma.savedItem.upsert({where:{userId_canonicalUrl:{userId:u.id,canonicalUrl:b.canonicalUrl}},create:{...b,metadata,userId:u.id},update:{title:b.title,entityType:b.entityType,entityId:b.entityId,metadata}});return Response.json({item})}
export async function DELETE(request:Request){const u=await user();if(!u)return Response.json({error:"Authentication required"},{status:401});const b=itemSchema.parse(await request.json());await prisma.savedItem.deleteMany({where:{userId:u.id,canonicalUrl:b.canonicalUrl}});return Response.json({ok:true})}
