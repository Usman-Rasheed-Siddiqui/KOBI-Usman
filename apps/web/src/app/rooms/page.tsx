import { PageHero } from "@/components/page-hero";
import { RoomsClient } from "@/components/rooms-client";

export const metadata = { title: "Project Rooms" };
export default function RoomsPage() {
  return <main><PageHero badge="Build together" title="A lightweight room around the real work." description="Find teammates, advertise role slots, coordinate tasks and keep momentum after an event—while source control stays on the repository host." /><RoomsClient /></main>;
}
