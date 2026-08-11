"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import * as React from "react";
import {
  dismissToast,
  type ToastItem,
  type ToastVariant,
} from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const toastVariants = cva(
  "pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 pr-10 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-full data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-full",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        success:
          "border-green-500/50 bg-background text-foreground [&>svg]:text-green-600",
        destructive:
          "border-destructive/50 bg-background text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const icons: Record<
  ToastVariant,
  React.ComponentType<{ className?: string }>
> = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertCircle,
};

interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  toast: ToastItem;
}

/**
 * One toast.
 *
 * It owns its own auto-dismiss timer instead of the store so that hovering
 * pauses it — a rejected business rule is text the user has to read, and losing
 * it halfway through is the whole reason `alert()` was tolerable before.
 *
 * A destructive toast is announced as `role="alert"` (assertive); the rest are
 * `role="status"`, which does not interrupt what a screen reader is saying.
 */
export function Toast({ toast, className, ...props }: ToastProps) {
  const { id, title, description, variant, duration, open } = toast;
  const [paused, setPaused] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const Icon = icons[variant];

  // Pause listeners are attached natively rather than as JSX handlers: a toast
  // is a live region, not a control, and putting mouse handlers on a static
  // element is exactly what `a11y/noStaticElementInteractions` forbids. Focus
  // events cover the keyboard path — tabbing to the close button pauses too.
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const pause = () => setPaused(true);
    const resume = () => setPaused(false);

    node.addEventListener("mouseenter", pause);
    node.addEventListener("mouseleave", resume);
    node.addEventListener("focusin", pause);
    node.addEventListener("focusout", resume);

    return () => {
      node.removeEventListener("mouseenter", pause);
      node.removeEventListener("mouseleave", resume);
      node.removeEventListener("focusin", pause);
      node.removeEventListener("focusout", resume);
    };
  }, []);

  React.useEffect(() => {
    if (!open || paused || duration <= 0) return;
    const timer = setTimeout(() => dismissToast(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, open, paused]);

  return (
    <div
      ref={ref}
      data-state={open ? "open" : "closed"}
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1 space-y-1">
        {title && <p className="text-sm font-medium leading-tight">{title}</p>}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => dismissToast(id)}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
