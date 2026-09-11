"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { reopenAssignment } from "@/lib/actions/assignments";
import { isFailure } from "@/lib/actions/result";

type Props = {
  assignmentId: string;
  disabled?: boolean;
};

/**
 * Admin-only reopen for a CERRADO assignment (CERRADO → EN_PROGRESO).
 * Rendered behind `canPerform("assignments:reopen")` by the caller, so the
 * role that sees the button holds the grant the action requires (H-06).
 */
export function ReopenAssignmentButton({ assignmentId, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await reopenAssignment(assignmentId);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al reabrir la asignación",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Reabrir asignación
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir asignación</DialogTitle>
            <DialogDescription>
              La asignación volverá a <strong>EN_PROGRESO</strong> y la
              incidencia recalculará su estado. Esta acción queda registrada en
              el historial.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Volver
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar reapertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
