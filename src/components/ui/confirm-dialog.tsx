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
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
