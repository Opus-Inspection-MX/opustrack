"use client";

import { motion } from "motion/react";
import type React from "react";
import { staggerChildVariants, staggerParentVariants } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

/**
 * Staggered entrance for short lists (filter chips, quick actions, KPI rows).
 * Children appear 40 ms apart. Not for tables or long lists.
 */
export function StaggerGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(className)}
      variants={staggerParentVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={cn(className)} variants={staggerChildVariants}>
      {children}
    </motion.div>
  );
}
