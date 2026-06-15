"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createHoliday, updateHoliday } from "@/lib/actions/holidays";
import type { HolidayFormData as ActionHolidayFormData } from "@/lib/validations/holidays";

// Rule type controls which sub-field is displayed: fixed day or n-th Monday.
type RuleType = "fixed" | "nthMonday";

type HolidayFormProps = {
  holiday?: {
    id: number;
    name: string;
    month: number;
    day: number | null;
    nthMonday: number | null;
    isRecurring: boolean;
    year: number | null;
  };
  redirectPath?: string;
};

export function HolidayForm({
  holiday,
  redirectPath = "/admin/holidays",
}: HolidayFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Infer initial rule type from existing data
  const initialRuleType: RuleType =
    holiday?.nthMonday !== null && holiday?.nthMonday !== undefined
      ? "nthMonday"
      : "fixed";

  const [ruleType, setRuleType] = useState<RuleType>(initialRuleType);
  const [isRecurring, setIsRecurring] = useState<boolean>(
    holiday?.isRecurring ?? true,
  );

  const [formData, setFormData] = useState<ActionHolidayFormData>({
    name: holiday?.name ?? "",
    month: holiday?.month ?? 1,
    day: holiday?.day ?? null,
    nthMonday: holiday?.nthMonday ?? null,
    isRecurring: holiday?.isRecurring ?? true,
    year: holiday?.year ?? null,
  });

  // When rule type changes, clear the unused field.
  const handleRuleTypeChange = (type: RuleType) => {
    setRuleType(type);
    if (type === "fixed") {
      setFormData((prev: ActionHolidayFormData) => ({
        ...prev,
        nthMonday: null,
      }));
    } else {
      setFormData((prev: ActionHolidayFormData) => ({ ...prev, day: null }));
    }
  };

  const handleRecurringChange = (checked: boolean) => {
    setIsRecurring(checked);
    setFormData((prev: ActionHolidayFormData) => ({
      ...prev,
      isRecurring: checked,
      year: checked ? null : prev.year,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (holiday) {
        await updateHoliday(holiday.id, formData);
      } else {
        await createHoliday(formData);
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
          <CardTitle>Información del Festivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Nombre del festivo"
              required
            />
          </div>

          {/* Month */}
          <div className="space-y-2">
            <Label htmlFor="month">Mes *</Label>
            <Input
              id="month"
              type="number"
              min={1}
              max={12}
              value={formData.month}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  month: Number.parseInt(e.target.value, 10) || 1,
                })
              }
              required
            />
          </div>

          {/* Rule type toggle */}
          <div className="space-y-2">
            <Label>Tipo de regla *</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ruleType"
                  value="fixed"
                  checked={ruleType === "fixed"}
                  onChange={() => handleRuleTypeChange("fixed")}
                />
                <span className="text-sm">Día fijo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ruleType"
                  value="nthMonday"
                  checked={ruleType === "nthMonday"}
                  onChange={() => handleRuleTypeChange("nthMonday")}
                />
                <span className="text-sm">Lunes N del mes</span>
              </label>
            </div>
          </div>

          {/* Fixed day */}
          {ruleType === "fixed" && (
            <div className="space-y-2">
              <Label htmlFor="day">Día del mes *</Label>
              <Input
                id="day"
                type="number"
                min={1}
                max={31}
                value={formData.day ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    day: e.target.value
                      ? Number.parseInt(e.target.value, 10)
                      : null,
                  })
                }
                required={ruleType === "fixed"}
              />
            </div>
          )}

          {/* N-th Monday */}
          {ruleType === "nthMonday" && (
            <div className="space-y-2">
              <Label htmlFor="nthMonday">
                Número de lunes (1 = primero, 3 = tercero) *
              </Label>
              <Input
                id="nthMonday"
                type="number"
                min={1}
                max={5}
                value={formData.nthMonday ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nthMonday: e.target.value
                      ? Number.parseInt(e.target.value, 10)
                      : null,
                  })
                }
                required={ruleType === "nthMonday"}
              />
            </div>
          )}

          {/* Recurring switch */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="isRecurring">Festivo recurrente (anual)</Label>
              <p className="text-sm text-muted-foreground">
                Desactive para festivos de ocurrencia única (sexenal).
              </p>
            </div>
            <Switch
              id="isRecurring"
              checked={isRecurring}
              onCheckedChange={handleRecurringChange}
            />
          </div>

          {/* Year (only shown when non-recurring) */}
          {!isRecurring && (
            <div className="space-y-2">
              <Label htmlFor="year">
                Año (obligatorio para festivos únicos) *
              </Label>
              <Input
                id="year"
                type="number"
                min={2000}
                max={2100}
                value={formData.year ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: e.target.value
                      ? Number.parseInt(e.target.value, 10)
                      : null,
                  })
                }
                required={!isRecurring}
              />
            </div>
          )}
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
          {loading
            ? "Guardando..."
            : holiday
              ? "Actualizar Festivo"
              : "Crear Festivo"}
        </Button>
      </div>
    </form>
  );
}
