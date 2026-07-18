import { Suspense } from "react";
import { ForgeWorkspace } from "@/components/forge-workspace";
import { SearchResultsSkeleton } from "@/components/skeletons";

export const metadata = { title: "KOBI Agent" };

export default function Page() {
  return <main><Suspense fallback={<SearchResultsSkeleton count={4} />}><ForgeWorkspace /></Suspense></main>;
}
