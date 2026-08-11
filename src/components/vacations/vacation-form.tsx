"use client";

import { isFailure } from "@/lib/actions/result";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createVacation } from "@/lib/actions/vacations";
import type { VacationFormData } from "@/lib/validations/vacations";

type FsrOption = {
  id: string;
  name: string;
  email: string;
};

type VacationFormProps = {
  /**
   * When true, shows a select input so an admin can choose the target FSR.
   * When false, the vacation is created for the current authenticated user.
   */
  showFsrSelect: boolean;
  fsrs?: FsrOption[];
  redirectPath?: string;
};

export function VacationForm({
  showFsrSelect,
  fsrs = [],
  redirectPath = "/fsr/vacations",
}: VacationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string>(
    fsrs.length > 0 ? (fsrs[0]?.id ?? "") : "",
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data: VacationFormData = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason.trim() || null,
      };

      if (showFsrSelect && selectedUserId) {
        data.userId = selectedUserId;
      }

      const result = await createVacation(data);

      if (isFailure(result)) {
        setError(result.error);
        return;
      }
      router.push(redirectPath);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos de la Solicitud</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* FSR selector (admin only) */}
          {showFsrSelect && (
            <div className="space-y-2">
              <Label htmlFor="userId">FSR *</Label>
              {fsrs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No se encontraron usuarios FSR activos.
                </p>
              ) : (
                <select
                  id="userId"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  {fsrs.map((fsr) => (
                    <option key={fsr.id} value={fsr.id}>
                      {fsr.name} ({fsr.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de inicio *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha de fin *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describa el motivo de la solicitud"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar Solicitud"}
        </Button>
      </div>
    </form>
  );
}
