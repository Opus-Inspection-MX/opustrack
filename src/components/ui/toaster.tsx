"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

/**
 * The viewport. Mounted once, in the root layout.
 *
 * Portalled to `document.body` so a toast is never clipped by the overflow or
 * stacking context of whatever screen raised it — several of the callers live
 * inside dialogs and scrollable tables.
 *
 * The live region is mounted unconditionally: a screen reader only announces
 * changes to a region that already existed, so creating it together with the
 * first toast would swallow that first message.
 */
export function Toaster() {
  const { toasts } = useToast();
  const [mounted, setMounted] = React.useState(false);

  // `document` does not exist during the server render.
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed top-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4"
    >
      {toasts.map((item) => (
        <Toast key={item.id} toast={item} />
      ))}
    </div>,
    document.body,
  );
}
