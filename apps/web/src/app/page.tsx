import Link from "next/link";
import { Archive, ArrowRight, Bot, CalendarDays, GitPullRequest, Search } from "lucide-react";
import { SearchExperience } from "@/components/search-experience";
import { Badge } from "@/components/ui";

export const metadata = { title: "Discover" };

export default async function Home({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const initialQuery = typeof params.q === "string" ? params.q : "";

  return (
    <main>
      <section className="mx-auto max-w-6xl pb-6 pt-10 text-center sm:pb-9 sm:pt-18">
        <Badge className="mb-5 border-[#b9d9c4] bg-[#e8f5ec] text-[#275f43]"><Search className="mr-1.5 size-3" />Universal discovery</Badge>
        <h1 className="text-balance mx-auto max-w-5xl text-[clamp(2.55rem,7vw,6rem)] font-semibold leading-[.92] tracking-[-.07em]">
          Search what KOBI can uncover.
        </h1>
        <p className="text-balance mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-[#687168] sm:text-lg">
          Ask for events, hackathons, repositories, good-first issues, or projects looking for contributors. KOBI checks saved discoveries first, then searches fresh sources when it should.
        </p>
      </section>

      <SearchExperience initialQuery={initialQuery} mode="all" />

      <section className="mx-auto mt-10 grid max-w-6xl gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DiscoverLink href="/pulse" icon={<CalendarDays className="size-5" />} title="KOBI Pulse" text="Personalized event search only." cta="Search events" />
        <DiscoverLink href="/forge" icon={<GitPullRequest className="size-5" />} title="KOBI Forge" text="Personalized contribution search only." cta="Search contributions" />
        <DiscoverLink href="/pulse/collection" icon={<Archive className="size-5" />} title="Pulse Collection" text="All indexed events KOBI has saved." cta="Browse events" />
        <DiscoverLink href="/forge/collection" icon={<Archive className="size-5" />} title="Forge Collection" text="All indexed contribution opportunities." cta="Browse opportunities" />
        <DiscoverLink href="/agent" icon={<Bot className="size-5" />} title="KOBI Agent" text="Conversational discovery with context." cta="Ask Agent" />
      </section>
    </main>
  );
}

function DiscoverLink({ href, icon, title, text, cta }: { href: string; icon: React.ReactNode; title: string; text: string; cta: string }) {
  return (
    <Link href={href} className="surface group rounded-[22px] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_55px_rgba(30,45,35,.12)]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#e8f5ec] text-[#24543c]">{icon}</span>
        <div>
          <h2 className="text-lg font-semibold tracking-[-.035em]">{title}</h2>
          <p className="mt-1 min-h-12 text-sm leading-6 text-[#687168]">{text}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#24543c]">{cta}<ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></span>
        </div>
      </div>
    </Link>
  );
}
