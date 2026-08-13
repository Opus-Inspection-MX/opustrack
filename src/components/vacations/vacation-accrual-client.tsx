"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import {
  type AccrualRuleFormData,
  createAccrualRule,
  deleteAccrualRule,
  updateAccrualRule,
  updateVacationSetting,
} from "@/lib/actions/vacation-accrual-rules";

interface AccrualRule {
  id: number;
  minYears: number;
  maxYears: number | null;
  days: number;
}

interface VacationAccrualClientProps {
  initialRules: AccrualRule[];
  initialGraceWindowMonths: number;
}

const EMPTY_DRAFT = { minYears: "", maxYears: "", days: "" };

/**
 * Admin editor for the two knobs behind every vacation balance: how many days
 * each year of service grants, and how long those days stay usable.
 *
 * Both only affect periods created afterwards — existing periods snapshot their
 * values, so editing here can never retroactively change someone's balance.
 */
export function VacationAccrualClient({
  initialRules,
  initialGraceWindowMonths,
}: VacationAccrualClientProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [grace, setGrace] = useState(String(initialGraceWindowMonths));
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const parseDraft = (): AccrualRuleFormData | null => {
    const minYears = Number(draft.minYears);
    const days = Number(draft.days);
    // Blank max means the open-ended final tier that catches everyone above.
    const maxYears =
      draft.maxYears.trim() === "" ? null : Number(draft.maxYears);

    if (!Number.isInteger(minYears) || minYears < 1) {
      toast.error("El año inicial debe ser un entero mayor o igual a 1.");
      return null;
    }
    if (maxYears !== null && !Number.isInteger(maxYears)) {
      toast.error("El año final debe ser un entero.");
      return null;
    }
    if (!Number.isInteger(days) || days < 0) {
      toast.error("Los días deben ser un entero positivo.");
      return null;
    }
    return { minYears, maxYears, days };
  };

  const startCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setCreating(true);
  };

  const startEdit = (rule: AccrualRule) => {
    setDraft({
      minYears: String(rule.minYears),
      maxYears: rule.maxYears === null ? "" : String(rule.maxYears),
      days: String(rule.days),
    });
    setCreating(false);
    setEditingId(rule.id);
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const saveRule = async () => {
    const data = parseDraft();
    if (!data) return;

    setSaving(true);
    try {
      const result =
        editingId !== null
          ? await updateAccrualRule(editingId, data)
          : await createAccrualRule(data);

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }

      toast.success(editingId !== null ? "Regla actualizada" : "Regla creada");
      cancel();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;
    const result = await deleteAccrualRule(deleteId);
    setDeleteId(null);

    if (isFailure(result)) {
      toast.error(result.error);
      return;
    }
    toast.success("Regla eliminada");
    router.refresh();
  };

  const saveGrace = async () => {
    const months = Number(grace);
    if (!Number.isInteger(months) || months < 0) {
      toast.error("La vigencia debe ser un número entero de meses.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateVacationSetting(months);
      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      toast.success("Vigencia actualizada");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const rangeLabel = (rule: AccrualRule) =>
    rule.maxYears === null
      ? `${rule.minYears} años o más`
      : rule.minYears === rule.maxYears
        ? `Año ${rule.minYears}`
        : `Años ${rule.minYears} a ${rule.maxYears}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vigencia de los períodos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Meses adicionales, después de que cierra el año de acumulación,
            durante los que el usuario aún puede tomar esos días. Solo aplica a
            períodos creados a partir de ahora.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="grace">Meses de vigencia</Label>
              <Input
                id="grace"
                type="number"
                min={0}
                value={grace}
                onChange={(e) => setGrace(e.target.value)}
                className="w-32"
              />
            </div>
            <Button onClick={saveGrace} disabled={saving}>
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Días por antigüedad</CardTitle>
              <p className="text-sm text-muted-foreground">
                Días otorgados según los años de servicio cumplidos (LFT Art.
                76). Los rangos no pueden traslaparse.
              </p>
            </div>
            <Button onClick={startCreate} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva regla
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Antigüedad</TableHead>
                <TableHead>Año inicial</TableHead>
                <TableHead>Año final</TableHead>
                <TableHead>Días</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creating && (
                <TableRow>
                  <TableCell className="text-muted-foreground">Nueva</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={draft.minYears}
                      onChange={(e) =>
                        setDraft({ ...draft, minYears: e.target.value })
                      }
                      className="h-8 w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      placeholder="Sin límite"
                      value={draft.maxYears}
                      onChange={(e) =>
                        setDraft({ ...draft, maxYears: e.target.value })
                      }
                      className="h-8 w-28"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={draft.days}
                      onChange={(e) =>
                        setDraft({ ...draft, days: e.target.value })
                      }
                      className="h-8 w-24"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={saveRule} disabled={saving}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancel}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {initialRules.map((rule) =>
                editingId === rule.id ? (
                  <TableRow key={rule.id}>
                    <TableCell className="text-muted-foreground">
                      Editando
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={draft.minYears}
                        onChange={(e) =>
                          setDraft({ ...draft, minYears: e.target.value })
                        }
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="Sin límite"
                        value={draft.maxYears}
                        onChange={(e) =>
                          setDraft({ ...draft, maxYears: e.target.value })
                        }
                        className="h-8 w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={draft.days}
                        onChange={(e) =>
                          setDraft({ ...draft, days: e.target.value })
                        }
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={saveRule} disabled={saving}>
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancel}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {rangeLabel(rule)}
                    </TableCell>
                    <TableCell>{rule.minYears}</TableCell>
                    <TableCell>{rule.maxYears ?? "Sin límite"}</TableCell>
                    <TableCell>{rule.days}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(rule)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(rule.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Eliminar regla"
        message="Los períodos ya creados conservan sus días; esto solo afecta a los períodos que se generen en el futuro."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
