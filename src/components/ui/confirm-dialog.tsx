"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmDialogProps {
  /** Controls whether the dialog is visible. */
  open: boolean;
  /** Called when the dialog open state changes (e.g. Escape key). */
  onOpenChange: (open: boolean) => void;
  /** Dialog title. */
  title: string;
  /** Dialog body message / description. */
  message: string;
  /** Label for the confirm button. Defaults to "Confirmar". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancelar". */
  cancelLabel?: string;
  /**
   * Visual variant for the confirm button.
   * - "destructive" → red button (for delete actions)
   * - "default" → primary button
   */
  variant?: "default" | "destructive";
  /** Called when the user confirms the action. */
  onConfirm: () => void;
  /** Called when the user cancels. If omitted, cancel closes the dialog via onOpenChange. */
  onCancel?: () => void;
  /**
   * Async mode. When provided, the dialog stops closing itself on confirm —
   * the caller closes it once the action settles — and both buttons are
   * disabled while `true`, so a slow delete cannot be fired twice.
   * Omitted, the dialog behaves as before.
   */
  busy?: boolean;
}

/**
 * Accessible confirmation dialog built on top of `ui/dialog`.
 * Traps focus, supports Escape to cancel and Enter/Space to confirm.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  onCancel,
  busy,
}: ConfirmDialogProps) {
  function handleCancel() {
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  }

  function handleConfirm() {
    onConfirm();
    // In async mode the caller decides when to close, once it knows whether
    // the action succeeded.
    if (busy === undefined) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={handleConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
