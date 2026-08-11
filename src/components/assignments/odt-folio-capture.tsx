"use client";

import { Check, FileText, Pencil, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { updateAssignmentOdtFolio } from "@/lib/actions/assignments";
import { isFailure } from "@/lib/actions/result";

type OdtFolioCaptureProps = {
  assignmentId: string;
  initialValue: string | null;
  disabled?: boolean;
  onChange?: (value: string | null) => void;
};

export function OdtFolioCapture({
  assignmentId,
  initialValue,
  disabled,
  onChange,
}: OdtFolioCaptureProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue || "");
  const [saved, setSaved] = useState(initialValue || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = value.trim();
      const result = await updateAssignmentOdtFolio(
        assignmentId,
        trimmed || null,
      );

      if (isFailure(result)) {
        setError(result.error);
        return;
      }
      const newValue = result.data.odtFolio || "";
      setSaved(newValue);
      setValue(newValue);
      setEditing(false);
      onChange?.(newValue || null);
    } catch (err) {
      setError((err as Error).message || "Error al guardar el folio ODT");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setValue(saved);
    setError(null);
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Folio ODT
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <FormError message={error} />}
        {editing ? (
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Capturar folio ODT del sistema externo"
              maxLength={100}
              disabled={loading}
            />
            <Button onClick={handleSave} disabled={loading} size="sm">
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              size="sm"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {saved || (
                <span className="text-muted-foreground italic">
                  No registrado
                </span>
              )}
            </p>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                {saved ? "Editar" : "Capturar"}
              </Button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Requerido para finalizar la asignación.
        </p>
      </CardContent>
    </Card>
  );
}
