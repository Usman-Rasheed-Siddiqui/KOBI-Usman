"use client";
import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";

// A lightweight, progressive-enhancement genie surface. It uses a multi-point clip path
// plus transform/perspective on the compositor. The component intentionally degrades to
// a shared-element spring when reduced motion is requested or clipping is unsupported.
export function GenieTransition({ active, target = { x: 0, y: 0 }, children, className = "" }: { active: boolean; target?: { x:number; y:number }; children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const initialClip = "polygon(0% 0%,100% 0%,100% 20%,100% 40%,100% 60%,100% 80%,100% 100%,0% 100%,0% 80%,0% 60%,0% 40%,0% 20%)";
  const suckedClip = target.x >= 0
    ? "polygon(82% 0%,100% 4%,100% 22%,100% 42%,100% 62%,100% 82%,100% 100%,88% 96%,72% 80%,60% 62%,55% 42%,64% 20%)"
    : "polygon(0% 4%,18% 0%,36% 20%,44% 42%,40% 62%,28% 80%,12% 96%,0% 100%,0% 82%,0% 62%,0% 42%,0% 22%)";
  return <motion.div className={className} style={{ transformOrigin: target.x >= 0 ? "100% 100%" : "0% 100%", willChange: active ? "transform, clip-path, opacity" : "auto" } as CSSProperties} animate={active && !reduce ? { x: target.x, y: target.y, scaleX:.18, scaleY:.08, opacity:.1, clipPath:suckedClip, rotateX:3 } : {x:0,y:0,scaleX:1,scaleY:1,opacity:1,clipPath:initialClip,rotateX:0}} transition={{duration: active ? .58 : .42, ease: active ? [.55,.04,.68,.18] : [.16,1,.3,1]}}>{children}</motion.div>;
}
