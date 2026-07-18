"use client";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto grid min-h-[65dvh] max-w-xl place-items-center py-12"><section className="surface w-full rounded-[28px] p-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-[16px] bg-[#fff1ed] text-[#9a4937]"><AlertTriangle className="size-5"/></span><h1 className="mt-4 text-xl font-semibold tracking-[-.04em]">This surface could not finish loading.</h1><p className="mt-2 text-sm leading-6 text-[#6b756d]">Your current page state is safe. Retry the request, or continue using another KOBI section.</p><button onClick={reset} className="mt-5 inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#163c2d] px-4 text-sm font-semibold text-white"><RotateCcw className="size-4"/>Try again</button></section></main>;
}
