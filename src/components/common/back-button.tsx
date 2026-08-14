"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useBackTarget } from "@/hooks/use-back-target";

/**
 * The back arrow, pointing at wherever you actually came from.
 *
 * Replaces `<Button asChild><Link href="/admin/algo"><ArrowLeft/></Link></Button>`,
 * which always returned to one hardcoded list regardless of the route that led
 * here — so reaching an incident from Seguimiento and pressing back left you in
 * a screen you had never opened.
 */
export function BackButton({
  fallback,
  label,
}: {
  /** Where to go on a fresh tab with no history — usually this entity's list. */
  fallback: string;
  /** Optional visible text; the icon alone is the default. */
  label?: string;
}) {
  const href = useBackTarget(fallback);

  return (
    <Button
      variant="ghost"
      size={label ? "sm" : "icon"}
      asChild
      aria-label={label ? undefined : "Volver"}
    >
      <Link href={href}>
        <ArrowLeft className="h-4 w-4" />
        {label ? <span className="ml-2">{label}</span> : null}
      </Link>
    </Button>
  );
}
