"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { deleteVacation } from "@/lib/actions/vacations";
import { VACATION_STATUS } from "@/lib/constants/status-codes";
import { VacationEditDialog } from "./vacation-edit-dialog";

type Props = {
  vacationId: string;
  statusCode: string;
  active: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManage: boolean;
  /** Server-derived CDMX eligibility hint; cancellation rechecks live state. */
  startedApproved: boolean;
};

export function VacationRequestActions({
  vacationId,
  statusCode,
  active,
  canUpdate,
  canDelete,
  canManage,
  startedApproved,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!active) return null;
  const editable = canUpdate && statusCode === VACATION_STATUS.PENDIENTE;
  const cancellable = canDelete && !startedApproved;
  return (
    <div className="flex flex-wrap gap-2">
      {editable && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          Editar solicitud
        </Button>
      )}
      {cancellable && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setError("");
            setCancelling(true);
          }}
        >
          Cancelar solicitud
        </Button>
      )}
      {canDelete && startedApproved && (
        <p className="text-xs text-muted-foreground">
          La vacación ya comenzó. Requiere una corrección administrativa.
        </p>
      )}
      {editable && (
        <VacationEditDialog
          vacationId={vacationId}
          open={editing}
          onOpenChange={setEditing}
          canManage={canManage}
        />
      )}
      <ConfirmDialog
        open={cancelling}
        onOpenChange={(next) => {
          if (!busy) setCancelling(next);
        }}
        title="Cancelar solicitud de vacaciones"
        message={
          error ||
          "Se cancelará esta solicitud y se liberará su reserva de días. La decisión y el historial se conservan."
        }
        confirmLabel="Confirmar cancelación"
        cancelLabel="Volver"
        variant="destructive"
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await deleteVacation(vacationId);
            if (isFailure(result)) {
              setError(result.error);
              toast.error(result.error);
              return;
            }
            setCancelling(false);
            toast.success("Solicitud de vacaciones cancelada");
            router.refresh();
          } catch {
            setError("No se pudo cancelar la solicitud. Vuelva a intentar.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
