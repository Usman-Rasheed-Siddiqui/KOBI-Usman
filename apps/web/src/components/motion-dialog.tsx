"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { springs } from "@/lib/motion";

export type OriginRect = { left: number; top: number; width: number; height: number } | null;

export function MotionDialog({ open, onClose, title, children, originRect, size = "lg" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; originRect?: OriginRect; size?: "md" | "lg" | "xl" }) {
  const reduce = useReducedMotion(); const titleId = useId(); const panelRef = useRef<HTMLDivElement>(null); const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { if (!open) return; previousFocus.current = document.activeElement as HTMLElement; const timer = window.setTimeout(() => panelRef.current?.focus(), 20); const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "Tab" && panelRef.current) { const f = [...panelRef.current.querySelectorAll<HTMLElement>('button,a,input,textarea,select,[tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute("disabled")); if (!f.length) return; const first=f[0]!, last=f[f.length-1]!; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()} else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()} } }; document.addEventListener("keydown", key); document.body.style.overflow="hidden"; return () => { clearTimeout(timer); document.removeEventListener("keydown",key); document.body.style.overflow=""; previousFocus.current?.focus(); }; }, [open,onClose]);
  const max = size === "xl" ? "max-w-6xl" : size === "lg" ? "max-w-3xl" : "max-w-xl";
  const dx = originRect ? originRect.left + originRect.width/2 - windowSafeWidth()/2 : 0; const dy = originRect ? originRect.top + originRect.height/2 - windowSafeHeight()/2 : 26;
  return <AnimatePresence mode="sync">{open && <motion.div className="fixed inset-0 z-[80] grid place-items-center p-3 sm:p-6" role="presentation" initial={{ opacity:0 }} animate={{opacity:1}} exit={{opacity:0}}>
    <motion.button aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-[#07140e]/30 backdrop-blur-[6px]" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2}} />
    <motion.div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`relative flex max-h-[min(880px,92dvh)] w-full ${max} flex-col overflow-hidden rounded-[28px] border border-white/70 bg-[#fbfcf8] shadow-[0_35px_120px_rgba(5,20,12,.28)] outline-none`} initial={reduce?{opacity:0}:{opacity:0,scale:.94,x:dx*.14,y:dy*.14}} animate={{opacity:1,scale:1,x:0,y:0}} exit={reduce?{opacity:0}:{opacity:0,scale:.95,x:dx*.18,y:dy*.18,transition:{duration:.2,ease:[.32,0,.67,0]}}} transition={reduce?{duration:.12}:springs.modal}>
      <div className="flex items-center justify-between border-b border-black/7 px-5 py-4 sm:px-6"><h2 id={titleId} className="text-[17px] font-semibold tracking-[-.03em]">{title}</h2><button onClick={onClose} className="focus-ring grid size-9 place-items-center rounded-xl bg-black/[.045] transition hover:bg-black/[.08]" aria-label="Close"><X className="size-4"/></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}
function windowSafeWidth(){return typeof window==="undefined"?1200:window.innerWidth} function windowSafeHeight(){return typeof window==="undefined"?800:window.innerHeight}
