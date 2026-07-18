import { SearchResultsSkeleton, Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl py-8 sm:py-12" aria-busy="true" aria-label="Loading KOBI">
      <div className="mx-auto max-w-3xl text-center">
        <Skeleton className="mx-auto h-7 w-40 rounded-full" />
        <Skeleton className="mx-auto mt-6 h-14 w-[78%] rounded-2xl sm:h-20" />
        <Skeleton className="mx-auto mt-3 h-5 w-[60%]" />
        <Skeleton className="mx-auto mt-8 h-16 w-full rounded-[24px]" />
      </div>
      <div className="mt-10"><SearchResultsSkeleton /></div>
    </main>
  );
}
