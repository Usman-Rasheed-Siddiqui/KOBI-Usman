"use client";

import { motion, useReducedMotion } from "motion/react";
import { springs } from "@/lib/motion";

/** Restrained route-entry continuity. Navigation remains immediately interactive. */
export default function RouteTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return <motion.div initial={reduce ? { opacity: .92 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: .08 } : springs.snappy}>{children}</motion.div>;
}
