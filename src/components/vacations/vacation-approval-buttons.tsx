"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import {
  approveVacation,
  getVacationApprovalConflicts,
  rejectVacation,
  type VacationAssignmentConflict,
} from "@/lib/actions/vacations";
import { formatMX } from "@/lib/utils/datetime";

type VacationApprovalButtonsProps = {
  vacationId: string;
  /** Current status name; buttons are hidden for already-settled vacations. */
  statusName: string;
  onSuccess?: () => void;
};

/**
 * Renders Aprobar / Rechazar action buttons for a single vacation row.
 * Only shows for PENDIENTE vacations.
 */
export function VacationApprovalButtons({
  vacationId,
  statusName,
  onSuccess,
}: VacationApprovalButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<
    VacationAssignmentConflict[] | null
  >(null);

  if (statusName !== "PENDIENTE") {
    return null;
  }

  /**
   * Both decisions follow the same shape: report the outcome as a toast and
   * refresh so the row leaves the pending list without a manual reload.
   */
  const decide = async (
    action: "approve" | "reject",
    run: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setLoading(action);
    setError(null);
    try {
      const result = await run();

      if (isFailure(result)) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const runApproval = () =>
    decide(
      "approve",
      () => approveVacation(vacationId),
      "Solicitud de vacaciones aprobada",
    );

  /**
   * Approving makes the FSR unavailable, but work already scheduled inside
   * those dates is left where it is — nothing is reassigned automatically.
   * Show what would be affected first so the admin can decide, then approve.
   */
  const handleApprove = async () => {
    setLoading("approve");
    setError(null);
    try {
      const found = await getVacationApprovalConflicts(vacationId);
      if (found.length > 0) {
        setConflicts(found);
        return;
      }
    } catch {
      // A failed conflict lookup must not block the decision: approving is
      // still valid, the admin just does not get the heads-up.
    } finally {
      setLoading(null);
    }

    await runApproval();
  };

  const handleReject = () =>
    decide(
      "reject",
      () => rejectVacation(vacationId),
      "Solicitud de vacaciones rechazada",
    );

  const conflictMessage = (items: VacationAssignmentConflict[]): string => {
    const lines = items
      .map(
        (item) =>
          `• Folio ${item.folio} — ${formatMX(item.scheduledDate, {
            dateStyle: "medium",
          })} — ${item.incidentTitle}`,
      )
      .join("\n");

    return (
      `Este técnico tiene ${items.length} asignación(es) programada(s) dentro de las fechas solicitadas:\n\n${lines}\n\n` +
      "Aprobar las vacaciones no reasigna ese trabajo: tendrás que reprogramarlo o asignarlo a otro técnico."
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={handleApprove}
          disabled={loading !== null}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {loading === "approve" ? "Procesando..." : "Aprobar"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleReject}
          disabled={loading !== null}
        >
          {loading === "reject" ? "Procesando..." : "Rechazar"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <ConfirmDialog
        open={conflicts !== null}
        onOpenChange={(open) => !open && setConflicts(null)}
        title="Hay trabajo programado en esas fechas"
        message={conflicts ? conflictMessage(conflicts) : ""}
        confirmLabel="Aprobar de todos modos"
        busy={loading === "approve"}
        onConfirm={async () => {
          await runApproval();
          setConflicts(null);
        }}
      />
    </div>
  );
}
