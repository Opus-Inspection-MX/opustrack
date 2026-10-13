"use client";

import { Plus, Save } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { FormError } from "@/components/ui/form-error";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { createAssignmentActivity } from "@/lib/actions/assignment-activities";
import { uploadAssignmentAttachment } from "@/lib/actions/assignments";
import { isFailure } from "@/lib/actions/result";
import { logger } from "@/lib/observability/logger";
import { normalizeMimeType } from "@/lib/upload";

type AssignmentActivityFormProps = {
  assignmentId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

type FileDraft = {
  id: number;
  file: File;
  status: "pending" | "uploaded" | "failed";
  error?: string;
};

export function AssignmentActivityForm({
  assignmentId,
  onSuccess,
  onCancel,
}: AssignmentActivityFormProps) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileDraft[]>([]);
  const [committedActivityId, setCommittedActivityId] = useState<string | null>(
    null,
  );
  const [uploadKey, setUploadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);

    try {
      // Validate description
      if (!description.trim()) {
        setError("La descripción es requerida");
        return;
      }

      if (!committedActivityId) {
        const result = await createAssignmentActivity({
          assignmentId,
          description: description.trim(),
          performedAt: new Date(),
        });

        if (isFailure(result)) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        setCommittedActivityId(result.data.id);
      }

      // Successful attachments remain recorded; retries only send unfinished files.
      const pendingFiles = files.filter((draft) => draft.status !== "uploaded");
      if (pendingFiles.length > 0) {
        const activityDescription = `Attached to activity: ${description.substring(0, 50)}`;
        const results = await Promise.allSettled(
          pendingFiles.map(async ({ file }) => {
            const fd = new FormData();
            fd.append("assignmentId", assignmentId);
            fd.append("file", file);
            fd.append("mimetype", normalizeMimeType(file));
            fd.append("description", activityDescription);
            return uploadAssignmentAttachment(fd);
          }),
        );

        const attemptedFiles: FileDraft[] = results.map((result, index) => {
          const draft = pendingFiles[index];
          if (result.status === "fulfilled" && !isFailure(result.value)) {
            return { ...draft, status: "uploaded", error: undefined };
          }
          const reason =
            result.status === "rejected"
              ? result.reason
              : isFailure(result.value)
                ? result.value.error
                : "Error desconocido";
          return {
            ...draft,
            status: "failed",
            error:
              reason instanceof Error
                ? reason.message
                : String(reason ?? "Error desconocido"),
          };
        });
        const updatedFiles = files.map(
          (draft) =>
            attemptedFiles.find((attempt) => attempt.id === draft.id) ?? draft,
        );
        setFiles(updatedFiles);
        const failures = attemptedFiles.filter(
          (draft) => draft.status === "failed",
        );

        if (failures.length > 0) {
          const detail = failures
            .map(({ file, error }) => `${file.name}: ${error}`)
            .join("; ");
          const message = `La actividad está guardada, pero faltan ${failures.length} archivos: ${detail}`;
          setError(message);
          toast.error(message);
          return;
        }
      }

      // Reset form
      setDescription("");
      setFiles([]);
      setCommittedActivityId(null);
      setUploadKey((key) => key + 1);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      logger.error("Error creating work activity:", err);
      const message =
        err instanceof Error ? err.message : "Error al guardar la actividad";
      setError(message);
      toast.error(message);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Agregar Actividad
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
          {error && <FormError message={error} />}
          {committedActivityId && (
            <div className="space-y-2 text-sm">
              <output className="block">
                Actividad guardada. Archivos subidos:{" "}
                {files.filter((draft) => draft.status === "uploaded").length}/
                {files.length}. Solo se reintentarán los archivos pendientes.
              </output>
              <ul className="space-y-1">
                {files.map((draft) => (
                  <li key={draft.id}>
                    {draft.file.name}:{" "}
                    {draft.status === "uploaded"
                      ? "Subido"
                      : draft.status === "failed"
                        ? `No subido: ${draft.error}`
                        : "Pendiente"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">
              Descripción <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el trabajo realizado..."
              rows={4}
              required
              readOnly={committedActivityId !== null}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Proporciona una descripción detallada del trabajo realizado
            </p>
          </div>

          {!committedActivityId && (
            <fieldset disabled={loading}>
              <FileUpload
                key={uploadKey}
                onFilesSelected={(selected) =>
                  setFiles(
                    selected.map((file, id) => ({
                      id,
                      file,
                      status: "pending",
                    })),
                  )
                }
                maxFiles={10}
                maxSizeMB={10}
                label="Archivos de Evidencia (Fotos, Videos, Documentos)"
                showCamera={true}
              />
            </fieldset>
          )}

          <div className="flex justify-end gap-2 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                {committedActivityId
                  ? "Salir sin completar adjuntos"
                  : "Cancelar"}
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? (
                "Guardando..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {committedActivityId
                    ? "Reintentar archivos pendientes"
                    : "Guardar Actividad"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
