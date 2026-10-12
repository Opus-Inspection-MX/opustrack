"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { correctVehicleOdometer } from "@/lib/actions/vehicles";

export function OdometerCorrectionForm({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const result = await correctVehicleOdometer(
        vehicleId,
        Number(data.get("reading")),
        String(data.get("reason") ?? ""),
      );
      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      toast.success("Corrección del odómetro registrada con historial.");
      form.reset();
      router.refresh();
    } catch {
      toast.error("No se pudo registrar la corrección del odómetro.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Corrección del odómetro</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Registra una nueva lectura de referencia por sustitución o corrección
          del odómetro. Conserva los viajes anteriores y requiere que no haya
          viajes en curso.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="odometer-reading">Nueva lectura (km)</Label>
            <Input
              id="odometer-reading"
              name="reading"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              required
            />
          </div>
          <div>
            <Label htmlFor="odometer-reason">Motivo de corrección</Label>
            <Textarea
              id="odometer-reason"
              name="reason"
              required
              maxLength={1000}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Registrando..." : "Registrar corrección"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
