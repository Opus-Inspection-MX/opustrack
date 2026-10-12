"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import {
  approveVacation,
  correctStartedVacation,
  getVacationApprovalConflicts,
  getVacationById,
  rejectVacation,
  type VacationAssignmentConflict,
} from "@/lib/actions/vacations";
import { VACATION_STATUS } from "@/lib/constants/status-codes";
import { formatMX, mxDateString } from "@/lib/utils/datetime";

type VacationApprovalButtonsProps = {
  vacationId: string;
  /** Current status code; approved requests expose the correction workflow. */
  statusName: string;
  onSuccess?: () => void;
};

/**
 * Renders Aprobar / Rechazar action buttons for a single vacation row.
 * Pending requests expose decisions; approved requests expose corrections.
 */
export function VacationApprovalButtons({
  vacationId,
  statusName,
  onSuccess,
}: VacationApprovalButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [conflicts, setConflicts] = useState<
    VacationAssignmentConflict[] | null
  >(null);
  const [correction, setCorrection] = useState(false);
  const [correctionEnd, setCorrectionEnd] = useState(mxDateString(new Date()));
  const [correctionReason, setCorrectionReason] = useState("");
  const [reviewedDays, setReviewedDays] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [maxCorrectionEnd, setMaxCorrectionEnd] = useState<string>();
  const [maxReviewedDays, setMaxReviewedDays] = useState<number>();

  if (
    statusName !== VACATION_STATUS.PENDIENTE &&
    statusName !== VACATION_STATUS.APROBADA
  ) {
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
    try {
      const result = await run();

      if (isFailure(result)) {
        toast.error(result.error);
        return false;
      }
      toast.success(successMessage);
      onSuccess?.();
      router.refresh();
      return true;
    } catch (err) {
      const message = (err as Error).message;
      toast.error(message);
      return false;
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

  if (statusName === VACATION_STATUS.APROBADA) {
    return (
      <div className="space-y-2">
        <Button
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={async () => {
            setLoading("approve");
            try {
              const row = await getVacationById(vacationId);
              if (
                !row ||
                mxDateString(row.startDate) > mxDateString(new Date())
              ) {
                toast.error("La corrección requiere una vacación iniciada.");
                return;
              }
              if (!row.active || row.businessDaysUsed == null) {
                toast.error(
                  "La solicitud requiere conciliación de consumo antes de corregirla.",
                );
                return;
              }
              const lastAllowed = new Date(
                `${mxDateString(row.endDate)}T00:00:00Z`,
              );
              lastAllowed.setUTCDate(lastAllowed.getUTCDate() - 1);
              if (
                lastAllowed.toISOString().slice(0, 10) <
                mxDateString(new Date())
              ) {
                toast.error(
                  "La vacación ya no tiene días futuros que puedan liberarse.",
                );
                return;
              }
              setMaxCorrectionEnd(lastAllowed.toISOString().slice(0, 10));
              setMaxReviewedDays(row.businessDaysUsed);
              setNeedsReview(!row.chargeSnapshotAvailable);
              setCorrectionEnd(mxDateString(new Date()));
              setCorrectionReason("");
              setReviewedDays("");
              setCorrection(true);
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setLoading(null);
            }
          }}
        >
          Corregir período iniciado
        </Button>
        {correction && (
          <div className="space-y-2 rounded border p-3">
            <p className="text-sm">
              Se conserva el consumo hasta la fecha elegida, incluido hoy. Solo
              se liberan los días posteriores.
            </p>
            <Label htmlFor={`correction-end-${vacationId}`}>
              Último día de ausencia
            </Label>
            <Input
              id={`correction-end-${vacationId}`}
              type="date"
              min={mxDateString(new Date())}
              max={maxCorrectionEnd}
              value={correctionEnd}
              onChange={(event) => setCorrectionEnd(event.target.value)}
            />
            <Label htmlFor={`correction-reason-${vacationId}`}>
              Motivo de la corrección
            </Label>
            <Textarea
              id={`correction-reason-${vacationId}`}
              value={correctionReason}
              onChange={(event) => setCorrectionReason(event.target.value)}
              maxLength={1000}
            />
            {needsReview && (
              <>
                <Label htmlFor={`correction-days-${vacationId}`}>
                  Días consumidos revisados (historial sin detalle diario)
                </Label>
                <Input
                  id={`correction-days-${vacationId}`}
                  type="number"
                  min={0}
                  max={maxReviewedDays}
                  step={1}
                  value={reviewedDays}
                  onChange={(event) => setReviewedDays(event.target.value)}
                />
              </>
            )}
            <Button
              size="sm"
              disabled={
                loading !== null ||
                !correctionEnd ||
                !correctionReason.trim() ||
                (needsReview && reviewedDays === "")
              }
              onClick={async () => {
                const saved = await decide(
                  "approve",
                  () =>
                    correctStartedVacation(
                      vacationId,
                      new Date(`${correctionEnd}T00:00:00Z`),
                      correctionReason,
                      needsReview ? Number(reviewedDays) : undefined,
                    ),
                  "Corrección registrada",
                );
                if (saved) setCorrection(false);
              }}
            >
              Guardar corrección
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCorrection(false)}
            >
              Cerrar
            </Button>
          </div>
        )}
      </div>
    );
  }

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
