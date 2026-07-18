import Link from "next/link";
import { ArrowRight, CalendarDays, Globe2, MapPin, Radio } from "lucide-react";
import { SearchExperience } from "@/components/search-experience";
import { Badge } from "@/components/ui";

export const metadata = { title: "KOBI Pulse" };

export default async function Page({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const initialQuery = typeof params.q === "string" ? params.q : "upcoming developer events";
  return (
    <main>
      <section className="mx-auto max-w-6xl pb-6 pt-8 sm:pb-10 sm:pt-16">
        <Badge className="border-[#b9d9c4] bg-[#e8f5ec] text-[#275f43]"><CalendarDays className="mr-1.5 size-3" />KOBI Pulse</Badge>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <h1 className="text-balance max-w-4xl text-[clamp(2.35rem,6vw,5.5rem)] font-semibold leading-[.92] tracking-[-.07em]">Personalized event discovery, kept current.</h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#687168] sm:text-lg">
              KOBI Pulse searches only events, hackathons, conferences, meetups, workshops, and developer gatherings. KOBI Fit uses your profile and preferences as a relevance signal while your explicit query stays in charge.
            </p>
            <Link href="/pulse/collection" className="mt-5 inline-flex items-center gap-2 rounded-[13px] border border-black/8 bg-white/70 px-4 py-2.5 text-sm font-semibold">
              Browse Pulse Collection<ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-2 text-sm text-[#556158] sm:grid-cols-3 lg:grid-cols-1">
            <Signal icon={<Globe2 className="size-4" />} title="Events only" text="Contribution issues never appear in KOBI Pulse." />
            <Signal icon={<Radio className="size-4" />} title="Mode aware" text="Online, in-person, and hybrid events stay filterable." />
            <Signal icon={<MapPin className="size-4" />} title="Fresh first" text="Current and upcoming events are prioritized." />
          </div>
        </div>
      </section>
      <SearchExperience initialQuery={initialQuery} mode="pulse" />
    </main>
  );
}

function Signal({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-[18px] border border-black/7 bg-white/65 p-4"><div className="flex items-center gap-2 font-semibold text-[#23352a]">{icon}{title}</div><p className="mt-1 text-xs leading-5 text-[#687168]">{text}</p></div>;
}
