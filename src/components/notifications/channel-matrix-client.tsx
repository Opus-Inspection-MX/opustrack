"use client";

import { Mail, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  type ChannelMatrixRow,
  type FailedEmailRow,
  getFailedEmails,
  retryFailedEmail,
  type SmtpStatus,
  saveChannelPolicies,
  sendTestEmail,
} from "@/lib/actions/notification-settings";
import { isFailure } from "@/lib/actions/result";
import { NOTIFICATION_GROUPS } from "@/lib/notifications/catalog";

interface ChannelMatrixClientProps {
  initialMatrix: ChannelMatrixRow[];
  initialSmtp: SmtpStatus;
  initialFailed: FailedEmailRow[];
}

/**
 * Event × channel matrix plus the SMTP panel.
 *
 * The matrix is the admin's single switchboard: unchecking both channels
 * disables the event, and saving writes `NotificationChannelPolicy`,
 * audits the change and invalidates the dispatch cache. The SMTP panel
 * shows which transport mail would use, probes it, and retries failures.
 */
export function ChannelMatrixClient({
  initialMatrix,
  initialSmtp,
  initialFailed,
}: ChannelMatrixClientProps) {
  const router = useRouter();
  const [matrix, setMatrix] = useState(initialMatrix);
  const [failed, setFailed] = useState(initialFailed);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const toggle = (type: string, channel: "inApp" | "email") => {
    setMatrix((rows) =>
      rows.map((row) =>
        row.type === type ? { ...row, [channel]: !row[channel] } : row,
      ),
    );
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const result = await saveChannelPolicies(
      matrix.map((row) => ({
        type: row.type,
        inApp: row.inApp,
        email: row.email,
      })),
    );
    setSaving(false);
    if (isFailure(result)) {
      toast.error("No se pudo guardar", result.error);
      return;
    }
    toast.success("Canales actualizados");
    setDirty(false);
    router.refresh();
  };

  const probe = async () => {
    setTesting(true);
    const result = await sendTestEmail();
    setTesting(false);
    if (isFailure(result)) {
      toast.error("Correo de prueba fallido", result.error);
      return;
    }
    toast.success("Correo de prueba enviado", "Revisa tu bandeja de entrada");
  };

  const retry = async (id: string) => {
    setRetryingId(id);
    const result = await retryFailedEmail(id);
    setRetryingId(null);
    if (isFailure(result)) {
      toast.error("Reintento fallido", result.error);
      return;
    }
    toast.success("Correo reenviado");
    setFailed(await getFailedEmails());
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Canales por evento</CardTitle>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {NOTIFICATION_GROUPS.map((group) => (
            <section key={group}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead className="w-32 text-center">
                      Notificación
                    </TableHead>
                    <TableHead className="w-24 text-center">Correo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix
                    .filter((row) => row.group === group)
                    .map((row) => (
                      <TableRow key={row.type}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={row.inApp}
                            onCheckedChange={() => toggle(row.type, "inApp")}
                            aria-label={`${row.label}: notificación`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={row.email}
                            onCheckedChange={() => toggle(row.type, "email")}
                            aria-label={`${row.label}: correo`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Correo SMTP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Transporte:</span>
            <code className="rounded bg-muted px-2 py-1 text-sm">
              {initialSmtp.transport}
            </code>
            {!initialSmtp.configured && (
              <span className="text-sm text-amber-600">
                Sin SMTP_HOST: los correos se registran pero no se envían.
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={probe}
              disabled={testing}
            >
              <Send className="mr-2 h-4 w-4" />
              {testing ? "Enviando…" : "Enviar correo de prueba"}
            </Button>
          </div>

          {failed.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">
                Correos fallidos ({failed.length})
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asunto</TableHead>
                    <TableHead className="w-20 text-center">Intentos</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failed.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.subject}</TableCell>
                      <TableCell className="text-center">
                        {row.attempts}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {row.lastError ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retry(row.id)}
                          disabled={retryingId === row.id}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" />
                          Reintentar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
