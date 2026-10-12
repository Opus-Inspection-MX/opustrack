"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { cancelVehicleTrip } from "@/lib/actions/vehicle-trips";

export function TripCancelForm({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await cancelVehicleTrip(
        tripId,
        String(data.get("reason") ?? ""),
      );
      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      toast.success("Viaje cancelado. Sus evidencias se conservaron.");
      router.refresh();
    } catch {
      toast.error("No se pudo cancelar el viaje.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancelar viaje</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Libera el vehículo y conserva la fotografía y lectura de inicio.
            Para un recorrido realizado, finaliza el viaje con su lectura final.
          </p>
          <div>
            <Label htmlFor="trip-cancel-reason">Motivo de cancelación</Label>
            <Textarea
              id="trip-cancel-reason"
              name="reason"
              required
              maxLength={1000}
            />
          </div>
          <Button type="submit" variant="destructive" disabled={busy}>
            {busy ? "Cancelando..." : "Cancelar viaje con motivo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
