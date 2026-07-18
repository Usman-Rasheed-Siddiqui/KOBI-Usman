import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { DiscoveryLibrary } from "@/components/discovery-library";
import { Badge } from "@/components/ui";

export const metadata = { title: "KOBI Pulse Collection" };

export default function Page() {
  return (
    <main>
      <section className="mx-auto max-w-6xl pb-6 pt-8 sm:pb-10 sm:pt-16">
        <Badge className="border-[#b9d9c4] bg-[#e8f5ec] text-[#275f43]"><CalendarDays className="mr-1.5 size-3" />Pulse Collection</Badge>
        <h1 className="mt-5 text-balance max-w-4xl text-[clamp(2.35rem,6vw,5.2rem)] font-semibold leading-[.92] tracking-[-.07em]">
          Indexed events KOBI has already found.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#687168] sm:text-lg">
          Browse saved events without triggering a new scrape. Use KOBI Pulse when you want a fresh personalized event search.
        </p>
        <Link href="/pulse" className="mt-5 inline-flex items-center gap-2 rounded-[13px] border border-black/8 bg-white/70 px-4 py-2.5 text-sm font-semibold">
          <ArrowLeft className="size-4" />Back to KOBI Pulse
        </Link>
      </section>
      <DiscoveryLibrary kind="pulse" />
    </main>
  );
}
