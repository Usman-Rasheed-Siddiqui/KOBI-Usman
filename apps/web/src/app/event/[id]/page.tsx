import { prisma } from "@openforge/database";
import { cleanDescription } from "@openforge/domain";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let event;
  try {
    event = await prisma.event.findUnique({ where: { id } });
  } catch {
    return (
      <div className="surface mx-auto max-w-xl rounded-[26px] p-8 text-center">
        Connect Neon to load persisted event details.
      </div>
    );
  }
  if (!event) notFound();

  const description = cleanDescription(event.description, event.title);

  return (
    <main className="mx-auto max-w-4xl py-8">
      <div className="surface rounded-[30px] p-6 sm:p-8">
        <div className="text-[11px] font-bold uppercase tracking-[.15em] text-[#78827a]">
          {event.eventType} - {event.source}
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-.055em]">{event.title}</h1>
        <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#657067]">
          {event.startsAt && (
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4" />
              {event.startsAt.toLocaleString()}
            </span>
          )}
          {event.location && (
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-4" />
              {event.location}
            </span>
          )}
        </div>
        <p className="mt-5 text-sm leading-7 text-[#657067]">
          {description ?? "Open the organizer page for full event details."}
        </p>
        <a
          href={event.registrationUrl ?? event.canonicalUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#163c2d] px-5 text-sm font-semibold text-white"
        >
          Open organizer page <ArrowUpRight className="size-4" />
        </a>
      </div>
    </main>
  );
}
