"use client";

import { MotionConfig } from "motion/react";
import type React from "react";

/**
 * Root motion provider.
 *
 * `reducedMotion="user"` defers to the OS `prefers-reduced-motion` setting,
 * so every animation below degrades to an instant state change for users
 * who ask for it. Mounted once in the root layout.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
