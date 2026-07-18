import Link from "next/link";
import { ArrowRight, GitPullRequest, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { SearchExperience } from "@/components/search-experience";
import { Badge } from "@/components/ui";

export const metadata = { title: "KOBI Forge" };

export default async function Page({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const initialQuery = typeof params.q === "string" ? params.q : "";
  return (
    <main>
      <section className="mx-auto max-w-6xl pb-6 pt-8 sm:pb-10 sm:pt-16">
        <Badge className="border-[#b9d9c4] bg-[#e8f5ec] text-[#275f43]"><GitPullRequest className="mr-1.5 size-3" />KOBI Forge</Badge>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <h1 className="text-balance max-w-4xl text-[clamp(2.35rem,6vw,5.5rem)] font-semibold leading-[.92] tracking-[-.07em]">Personalized open-source opportunities.</h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#687168] sm:text-lg">
              KOBI Forge searches only contribution issues, repositories, good-first opportunities, help-wanted work, and projects seeking contributors. Events never leak into this lane.
            </p>
            <Link href="/forge/collection" className="mt-5 inline-flex items-center gap-2 rounded-[13px] border border-black/8 bg-white/70 px-4 py-2.5 text-sm font-semibold">
              Browse Forge Collection<ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-2 text-sm text-[#556158] sm:grid-cols-3 lg:grid-cols-1">
            <Signal icon={<ShieldCheck className="size-4" />} title="Active first" text="Closed or unavailable issues do not dominate the default view." />
            <Signal icon={<Timer className="size-4" />} title="Freshness filters" text="Narrow by recent updates and current project activity." />
            <Signal icon={<Sparkles className="size-4" />} title="Beginner aware" text="Good-first and help-wanted signals stay visible." />
          </div>
        </div>
      </section>
      <SearchExperience initialQuery={initialQuery} mode="forge" />
    </main>
  );
}

function Signal({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-[18px] border border-black/7 bg-white/65 p-4"><div className="flex items-center gap-2 font-semibold text-[#23352a]">{icon}{title}</div><p className="mt-1 text-xs leading-5 text-[#687168]">{text}</p></div>;
}
