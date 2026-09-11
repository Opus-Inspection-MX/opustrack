"use client";

import { useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Decimals to show, e.g. 0 for counts, 1 for averages. */
  decimals?: number;
  className?: string;
}

/**
 * Spring-animated counter for KPI values. Renders the final value instantly
 * when the user prefers reduced motion, and on the server.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  className,
}: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const spring = useSpring(value, { stiffness: 90, damping: 20 });
  const rounded = useTransform(spring, (v) => v.toFixed(decimals));

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const unsubscribe = rounded.on("change", (v) => setDisplay(Number(v)));
    spring.set(value);
    return unsubscribe;
  }, [value, spring, rounded, reduceMotion]);

  // Plain fixed-point formatting on purpose: date/number locale formatting
  // lives in src/lib/utils/datetime.ts and new toLocaleString calls are out.
  return <span className={className}>{display.toFixed(decimals)}</span>;
}
