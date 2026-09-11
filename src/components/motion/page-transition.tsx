"use client";

import { motion } from "motion/react";
import type React from "react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/ui/motion";

/**
 * Page-level transition rendered once inside `main`.
 * A short fade only — no layout animation, and large tables inside stay static.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE }}
    >
      {children}
    </motion.div>
  );
}
