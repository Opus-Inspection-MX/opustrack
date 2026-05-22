"use client";

import { Ban, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelIncident } from "@/lib/actions/incidents";

type Props = {
  incidentId: number;
  disabled?: boolean;
};

export function CancelIncidentButton({ incidentId, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await cancelIncident(incidentId, reason.trim() || undefined);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cancelar la incidencia");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Ban className="mr-2 h-4 w-4" />
        Cancelar incidencia
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar incidencia</DialogTitle>
            <DialogDescription>
              Al cancelar la incidencia, se marcará como <strong>CANCELADA</strong>{" "}
              y todas sus asignaciones quedarán bloqueadas. Esta acción no
              requiere folio ODT. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">Razón (opcional)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe brevemente por qué se cancela"
              rows={3}
              disabled={loading}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Volver
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
