"use client";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/motion";

export function Button({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <motion.button whileTap={{ scale: .975 }} transition={springs.snappy} className={cn("focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[13px] bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white shadow-sm transition-[background,box-shadow] hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50", className)} {...(props as object)}>{children}</motion.button>;
}
export function GhostButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <motion.button whileTap={{ scale: .97 }} transition={springs.snappy} className={cn("focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[13px] border border-black/8 bg-white/70 px-3 text-sm font-medium shadow-[0_1px_4px_rgba(20,30,24,.04)] transition hover:bg-white", className)} {...(props as object)}>{children}</motion.button>;
}
export function Badge({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) { return <span className={cn("inline-flex h-6 items-center rounded-full border border-black/7 bg-white/75 px-2.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#586159]", className)} {...props}>{children}</span>; }
export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) { return <div>{eyebrow && <div className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#6b776d]">{eyebrow}</div>}<h2 className="text-balance text-2xl font-semibold tracking-[-.045em] sm:text-3xl">{title}</h2>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687168] sm:text-[15px]">{description}</p>}</div>; }
