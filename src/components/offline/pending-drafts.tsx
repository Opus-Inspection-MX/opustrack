"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "@/hooks/use-toast";
import { entryRequiresPhoto, flushEntry } from "@/lib/offline/flush";
import {
  delayForAttempt,
  isStaleLocal,
  loadEntries,
  type OfflineActionKind,
  OUTBOX_CHANGED_EVENT,
  OUTBOX_MAX_ENTRIES,
  type OutboxEntry,
  recordAttempt,
  removeEntry,
  stagePhoto,
  takeStagedPhoto,
} from "@/lib/offline/outbox";
import { formatMX } from "@/lib/utils/datetime";

const KIND_LABELS: Record<OfflineActionKind, string> = {
  startAssignmentWork: "Inicio de trabajo",
  closeAssignment: "Cierre de asignación",
  startVehicleTrip: "Inicio de viaje",
  endVehicleTrip: "Fin de viaje",
};

interface PendingDraftsProps {
  /** Which action kinds to list. */
  kinds: OfflineActionKind[];
  /** Narrow to drafts for one entity, e.g. { key: "assignmentId", value: id }. */
  matchField?: { key: string; value: string };
  /** Refresh the parent (server state changed after a successful flush). */
  onFlushed?: () => void;
}

/**
 * Pending offline drafts (RF-260, RF-261): "Pendiente de envío" badges with
 * entry detail (captured-at, attempts, last error) plus Reintentar /
 * Descartar. Auto-flushes on reconnect with bounded backoff; past the
 * schedule only manual retry remains. Business-rule failures keep the entry
 * — the operator resolves them manually, exactly like an online failure.
 */
export function PendingDrafts({
  kinds,
  matchField,
  onFlushed,
}: PendingDraftsProps) {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [flushing, setFlushing] = useState<string | null>(null);
  const [replacementPhotos, setReplacementPhotos] = useState<
    Record<string, File>
  >({});

  // Props arrive as inline literals; depend on stable primitives instead so
  // effects below resubscribe only when the filter actually changes.
  const kindKey = kinds.join(",");
  const matchKey = matchField?.key;
  const matchValue = matchField?.value;

  const matches = useCallback(
    (entry: OutboxEntry) =>
      kindKey.split(",").includes(entry.kind) &&
      (!matchKey || entry.fields[matchKey] === matchValue),
    [kindKey, matchKey, matchValue],
  );

  const reload = useCallback(() => {
    setEntries(loadEntries().filter(matches));
  }, [matches]);

  useEffect(() => {
    reload();
    window.addEventListener(OUTBOX_CHANGED_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(OUTBOX_CHANGED_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  const flushOne = useCallback(
    async (entry: OutboxEntry, manual: boolean) => {
      if (!manual && entry.attempts >= 3) return; // bounded backoff: manual-only
      const replacement = replacementPhotos[entry.key];
      if (
        entryRequiresPhoto(entry.kind) &&
        !replacement &&
        !takeStagedPhoto(entry.key)
      ) {
        toast.error(
          "La foto del odómetro ya no está disponible. Vuelve a adjuntarla antes de reintentar.",
        );
        return;
      }
      setFlushing(entry.key);
      try {
        const result = await flushEntry(entry, replacement);
        if (result.success) {
          removeEntry(entry.key);
          setReplacementPhotos((prev) => {
            const next = { ...prev };
            delete next[entry.key];
            return next;
          });
          toast.success("Borrador enviado correctamente");
          onFlushed?.();
        } else {
          recordAttempt(entry.key, result.error);
          toast.error(result.error);
        }
      } catch (error) {
        // Transport failure (still offline, server unreachable): the draft
        // stays queued with its frozen evidence for the next retry.
        const message =
          error instanceof Error ? error.message : "Error de conexión";
        recordAttempt(entry.key, message);
        toast.error(`Sin conexión. Borrador guardado (${message})`);
      } finally {
        setFlushing(null);
        reload();
      }
    },
    [onFlushed, reload, replacementPhotos],
  );

  // Auto-flush on reconnect, honoring the backoff schedule per entry.
  useEffect(() => {
    const timers: number[] = [];
    const schedule = () => {
      if (!navigator.onLine) return;
      for (const entry of loadEntries().filter(matches)) {
        const delay = delayForAttempt(entry.attempts);
        if (delay === null) continue;
        timers.push(
          window.setTimeout(() => {
            void flushOne(entry, false);
          }, delay),
        );
      }
    };
    window.addEventListener("online", schedule);
    return () => {
      window.removeEventListener("online", schedule);
      for (const t of timers) window.clearTimeout(t);
    };
  }, [flushOne, matches]);

  const discard = useCallback(
    (entry: OutboxEntry) => {
      if (
        !confirm(
          `¿Descartar el borrador "${KIND_LABELS[entry.kind]}" capturado el ${formatMX(entry.capturedAt)}? Esta acción no se puede deshacer.`,
        )
      )
        return;
      removeEntry(entry.key);
      reload();
    },
    [reload],
  );

  if (entries.length === 0) return null;

  return (
    <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-600 text-amber-700 dark:text-amber-400"
          >
            Pendiente de envío ({entries.length}/{OUTBOX_MAX_ENTRIES})
          </Badge>
          <p className="text-xs text-muted-foreground">
            Borradores guardados sin conexión. Se enviarán al reconectar.
          </p>
        </div>
        {entries.map((entry) => {
          const needsPhoto =
            entryRequiresPhoto(entry.kind) &&
            !takeStagedPhoto(entry.key) &&
            !replacementPhotos[entry.key];
          return (
            <div
              key={entry.key}
              className="rounded-md border bg-background p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">
                  {KIND_LABELS[entry.kind]}
                </span>
                {isStaleLocal(entry.capturedAt) && (
                  <Badge variant="destructive">Expirado (&gt;24h)</Badge>
                )}
                {entry.attempts >= 3 && (
                  <Badge variant="outline">Solo reintento manual</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Capturado: {formatMX(entry.capturedAt)}
                {entry.attempts > 0 && ` · Intentos: ${entry.attempts}`}
                {entry.photoName && ` · Foto: ${entry.photoName}`}
              </div>
              {entry.lastError && (
                <p className="text-xs text-destructive">
                  Último error: {entry.lastError}
                </p>
              )}
              {needsPhoto && (
                <FileUpload
                  onFilesSelected={(files) => {
                    const file = files[0];
                    if (file) {
                      stagePhoto(entry.key, file);
                      setReplacementPhotos((prev) => ({
                        ...prev,
                        [entry.key]: file,
                      }));
                    }
                  }}
                  maxFiles={1}
                  maxSizeMB={10}
                  label="Vuelve a adjuntar la foto del odómetro"
                  showCamera={true}
                  accept="image/*"
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void flushOne(entry, true)}
                  disabled={flushing === entry.key || needsPhoto}
                >
                  {flushing === entry.key ? "Enviando…" : "Reintentar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => discard(entry)}
                  disabled={flushing === entry.key}
                >
                  Descartar
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
