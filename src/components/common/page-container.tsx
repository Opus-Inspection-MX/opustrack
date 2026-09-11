import type React from "react";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Narrow reading width for forms and inboxes. Defaults to full width. */
  size?: "full" | "narrow" | "wide";
}

/**
 * Consistent page gutter and max width.
 * Replaces the hand-written `space-y-6 max-w-* mx-auto` wrappers.
 */
export function PageContainer({
  children,
  className,
  size = "full",
}: PageContainerProps) {
  return (
    <FadeIn
      className={cn(
        "mx-auto w-full space-y-6",
        size === "narrow" && "max-w-3xl",
        size === "wide" && "max-w-6xl",
        className,
      )}
    >
      {children}
    </FadeIn>
  );
}
