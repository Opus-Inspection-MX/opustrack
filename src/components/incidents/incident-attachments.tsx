"use client";

import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttachmentPreview } from "@/components/assignments/attachment-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "@/hooks/use-toast";
import {
  deleteIncidentAttachment,
  uploadIncidentAttachment,
} from "@/lib/actions/incident-attachments";
import { isFailure } from "@/lib/actions/result";
import { normalizeMimeType } from "@/lib/upload";

export type IncidentAttachmentView = {
  id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploadedAt: Date;
  description: string | null;
  provider: string;
};

type IncidentAttachmentsProps = {
  incidentId: number;
  attachments: IncidentAttachmentView[];
  /** Caller resolved incidents:create OR incidents:update. */
  canManage: boolean;
  /** CERRADO/CANCELADA: evidence is frozen, list stays visible. */
  terminal: boolean;
};

/**
 * Evidence photos on the incident detail (RF-217).
 *
 * Read list reuses the assignment AttachmentPreview (same contract, no new
 * design language). Managing (add/delete) doubles as the repair path for
 * reports whose uploads failed mid-flow on /reporter/new.
 */
export function IncidentAttachments({
  incidentId,
  attachments,
  canManage,
  terminal,
}: IncidentAttachmentsProps) {
  const router = useRouter();
  const [staged, setStaged] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);

  const editable = canManage && !terminal;

  const handleUpload = async () => {
    if (staged.length === 0) return;
    setUploading(true);
    try {
      const results = await Promise.allSettled(
        staged.map((file) => {
          const fd = new FormData();
          fd.append("incidentId", String(incidentId));
          fd.append("file", file);
          fd.append("mimetype", normalizeMimeType(file));
          return uploadIncidentAttachment(fd);
        }),
      );
      const failures = results
        .map((r, i) => {
          const name = staged[i].name;
          if (r.status === "rejected") {
            const reason = r.reason;
            const msg =
              reason instanceof Error ? reason.message : "Error desconocido";
            return `${name}: ${msg}`;
          }
          if (isFailure(r.value)) return `${name}: ${r.value.error}`;
          return null;
        })
        .filter((f): f is string => f !== null);
      if (failures.length > 0) {
        toast.error(
          `Algunas fotos no se pudieron subir (${failures.length}/${staged.length}): ${failures.join("; ")}`,
        );
      } else {
        toast.success("Evidencia agregada");
      }
      setStaged([]);
      setUploadKey((k) => k + 1);
      router.refresh();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteIncidentAttachment(id);
    if (isFailure(result)) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Paperclip className="h-6 w-6" />
          Evidencia fotográfica ({attachments.length})
        </h2>
        <p className="text-sm text-muted-foreground">
          Fotos reportadas con el incidente
        </p>
      </div>

      {attachments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Sin fotos de evidencia.
            {editable && " Agrega la primera con el botón de abajo."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {attachments.map((attachment) => (
            <Card key={attachment.id}>
              <CardContent className="p-0">
                <AttachmentPreview
                  attachment={attachment}
                  onDelete={editable ? handleDelete : undefined}
                  readOnly={!editable}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editable && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <FileUpload
              key={uploadKey}
              onFilesSelected={setStaged}
              maxFiles={5}
              maxSizeMB={10}
              showCamera
              label="Agregar fotos"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleUpload}
                disabled={staged.length === 0 || uploading}
              >
                {uploading ? "Subiendo..." : "Subir evidencia"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
