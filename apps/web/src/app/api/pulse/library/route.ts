import { searchPulseLibrary } from "@/lib/library-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return Response.json(await searchPulseLibrary(searchParams));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "KOBI Pulse could not load saved discoveries." }, { status: 500 });
  }
}
