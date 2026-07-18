import { MaintainerClient } from "@/components/maintainer-client";
import { PageHero } from "@/components/page-hero";

export const metadata = { title: "Maintainer Mode" };
export default function Page() {
  return <main className="py-6 sm:py-10"><PageHero eyebrow="Maintainer mode" title="Make your project easier to join." description="Verify stewardship, publish real contributor signals, highlight approachable work, and turn project activity into a clear path for new contributors." /><div className="mt-7"><MaintainerClient /></div></main>;
}
