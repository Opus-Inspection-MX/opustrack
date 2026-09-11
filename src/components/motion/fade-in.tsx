"use client";

import { motion } from "motion/react";
import type React from "react";
import { fadeInVariants, MOTION_DURATION, MOTION_EASE } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  /** Extra delay in seconds before the entrance starts. */
  delay?: number;
  as?: "div" | "section" | "span";
}

/**
 * Subtle entrance for page-level blocks (headers, cards, empty states).
 * Never wrap large tables with this — they stay static for performance.
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  as = "div",
}: FadeInProps) {
  const Comp =
    as === "section"
      ? motion.section
      : as === "span"
        ? motion.span
        : motion.div;
  return (
    <Comp
      className={cn(className)}
      variants={fadeInVariants}
      initial="hidden"
      animate="visible"
      transition={{
        duration: MOTION_DURATION.base,
        ease: MOTION_EASE,
        delay,
      }}
    >
      {children}
    </Comp>
  );
}
