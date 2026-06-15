"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { approveVacation, rejectVacation } from "@/lib/actions/vacations";

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
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (statusName !== "PENDIENTE") {
    return null;
  }

  const handleApprove = async () => {
    setLoading("approve");
    setError(null);
    try {
      await approveVacation(vacationId);
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading("reject");
    setError(null);
    try {
      await rejectVacation(vacationId);
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
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
    </div>
  );
}
