"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  type BroadcastListRow,
  cancelBroadcast,
} from "@/lib/actions/broadcasts";
import { isFailure } from "@/lib/actions/result";
import { formatMX } from "@/lib/utils/datetime";

interface BroadcastHistoryProps {
  rows: BroadcastListRow[];
  onEdit: (row: BroadcastListRow) => void;
  onChanged: () => void;
}

const STATUS_LABEL: Record<BroadcastListRow["status"], string> = {
  PROGRAMADA: "Programada",
  ENVIANDO: "Enviando",
  ENVIADA: "Enviada",
  CANCELADA: "Cancelada",
  FALLIDA: "Fallida",
};

function StatusBadge({ status }: { status: BroadcastListRow["status"] }) {
  const variant =
    status === "FALLIDA"
      ? "destructive"
      : status === "ENVIADA"
        ? "default"
        : status === "CANCELADA"
          ? "outline"
          : "secondary";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}

function ChannelsCell({ row }: { row: BroadcastListRow }) {
  const channels = [
    row.sendInApp ? "Notificación" : null,
    row.sendEmail ? "Correo" : null,
  ].filter(Boolean);
  return <span className="text-sm">{channels.join(" + ")}</span>;
}

function AudienceCell({ row }: { row: BroadcastListRow }) {
  if (row.status === "ENVIADA") {
    return (
      <span className="text-sm">
        {row.recipientCount}{" "}
        {row.recipientCount === 1 ? "destinatario" : "destinatarios"}
      </span>
    );
  }
  if (row.allRoles) return <span className="text-sm">Todos los roles</span>;
  const parts: string[] = [];
  if (row.roles.length > 0) {
    parts.push(row.roles.map((r) => r.name).join(", "));
  }
  if (row.usersTotal > 0) {
    const shown = row.users.map((u) => `${u.name} (${u.email})`).join(", ");
    parts.push(
      row.usersTotal > row.users.length
        ? `${shown} y ${row.usersTotal - row.users.length} más`
        : shown,
    );
  }
  if (parts.length === 0) return <span className="text-sm">—</span>;
  return <span className="text-sm">{parts.join(" + ")}</span>;
}

/**
 * Scheduled + history tables. Only PROGRAMADA rows offer edit/cancel —
 * the server re-checks the status, so a race with the cron fails closed.
 */
export function BroadcastHistory({
  rows,
  onEdit,
  onChanged,
}: BroadcastHistoryProps) {
  const [cancelling, setCancelling] = useState<BroadcastListRow | null>(null);
  const [busy, setBusy] = useState(false);

  const scheduled = rows.filter((r) => r.status === "PROGRAMADA");
  const history = rows.filter((r) => r.status !== "PROGRAMADA");

  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      const result = await cancelBroadcast(cancelling.id);
      if (isFailure(result)) {
        toast.error("No se pudo cancelar", result.error);
        return;
      }
      toast.success("Difusión cancelada");
      setCancelling(null);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const renderTable = (items: BroadcastListRow[], showActions: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Canales</TableHead>
          <TableHead>Destinatarios</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha</TableHead>
          {showActions && (
            <TableHead className="text-right">Acciones</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <p className="font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {row.message}
              </p>
            </TableCell>
            <TableCell>
              <span className="text-sm">
                {row.kind === "ANNOUNCEMENT" ? "Anuncio" : "Sistema"}
              </span>
            </TableCell>
            <TableCell>
              <ChannelsCell row={row} />
            </TableCell>
            <TableCell>
              <AudienceCell row={row} />
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell>
              <span className="text-sm whitespace-nowrap">
                {row.status === "ENVIADA" && row.sentAt
                  ? formatMX(row.sentAt)
                  : formatMX(row.scheduledAt)}
              </span>
              {row.createdByName && (
                <p className="text-xs text-muted-foreground">
                  por {row.createdByName}
                </p>
              )}
            </TableCell>
            {showActions && (
              <TableCell className="text-right whitespace-nowrap">
                <Button variant="outline" size="sm" onClick={() => onEdit(row)}>
                  Editar
                </Button>{" "}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setCancelling(row)}
                >
                  Cancelar
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Programadas ({scheduled.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay difusiones programadas.
            </p>
          ) : (
            renderTable(scheduled, true)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial ({history.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay difusiones enviadas.
            </p>
          ) : (
            renderTable(history, false)
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
        title="Cancelar difusión"
        message={`¿Cancelar la difusión programada "${cancelling?.title ?? ""}"? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, cancelar"
        variant="destructive"
        busy={busy}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
