import type { Transition, Variants } from "motion/react";

/**
 * Shared motion presets for OpusTrack.
 *
 * Durations stay short (150/200/300 ms) with a single ease-out curve so the
 * UI feels snappy on low-end devices. Large tables are never animated — the
 * tracking grid stays static for performance.
 */
export const MOTION_DURATION = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
} as const;

export const MOTION_EASE: [number, number, number, number] = [0.2, 0, 0, 1];

export const MOTION_STAGGER_CHILDREN = 0.04;

export function motionTransition(
  duration: number = MOTION_DURATION.base,
): Transition {
  return { duration, ease: MOTION_EASE };
}

export const fadeInVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: motionTransition(MOTION_DURATION.base),
  },
};

export const staggerParentVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: MOTION_STAGGER_CHILDREN },
  },
};

export const staggerChildVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: motionTransition(MOTION_DURATION.fast),
  },
};
