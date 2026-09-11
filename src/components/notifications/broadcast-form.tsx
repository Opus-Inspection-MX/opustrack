"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  type BroadcastKindInput,
  type BroadcastListRow,
  type BroadcastTargetRole,
  createBroadcast,
  previewBroadcastRecipients,
  updateBroadcast,
} from "@/lib/actions/broadcasts";
import { isFailure } from "@/lib/actions/result";
import { toDatetimeLocalMX } from "@/lib/utils/datetime";

interface BroadcastFormProps {
  allowedRoles: BroadcastTargetRole[];
  canTargetAll: boolean;
  /** Set when editing a scheduled broadcast; null for a new one. */
  editing: BroadcastListRow | null;
  onCancelEdit: () => void;
  onSaved: () => void;
}

const EMPTY_PREVIEW = "—";

/**
 * Broadcast composer: copy + kind + channels + scope + timing in one card.
 *
 * Role checkboxes render ONLY the sender's allowed roles (fail closed comes
 * from the server too — `createBroadcast` re-validates the scope). The
 * recipient preview counts the live audience, clamped to that scope.
 */
export function BroadcastForm({
  allowedRoles,
  canTargetAll,
  editing,
  onCancelEdit,
  onSaved,
}: BroadcastFormProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<BroadcastKindInput>("ANNOUNCEMENT");
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [allRoles, setAllRoles] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [includeSender, setIncludeSender] = useState(false);
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [preview, setPreview] = useState<string>(EMPTY_PREVIEW);
  const [loading, setLoading] = useState(false);

  const hasTargets = allowedRoles.length > 0 || canTargetAll;

  // Fill the form when an edit starts; clear it when the edit ends.
  useEffect(() => {
    if (!editing) {
      setTitle("");
      setMessage("");
      setKind("ANNOUNCEMENT");
      setSendInApp(true);
      setSendEmail(false);
      setAllRoles(false);
      setSelectedRoleIds([]);
      setIncludeSender(false);
      setSendNow(true);
      setScheduledAtLocal("");
      return;
    }
    setTitle(editing.title);
    setMessage(editing.message);
    setKind(editing.kind);
    setSendInApp(editing.sendInApp);
    setSendEmail(editing.sendEmail);
    setAllRoles(editing.allRoles);
    setSelectedRoleIds(editing.roles.map((r) => r.id));
    setIncludeSender(editing.includeSender);
    setSendNow(false);
    setScheduledAtLocal(toDatetimeLocalMX(editing.scheduledAt));
  }, [editing]);

  // Live recipient preview, clamped to the sender's scope server-side.
  useEffect(() => {
    if (!hasTargets) {
      setPreview(EMPTY_PREVIEW);
      return;
    }
    let cancelled = false;
    previewBroadcastRecipients({
      roleIds: selectedRoleIds,
      allRoles,
      includeSender,
      userIds: [],
    })
      .then((result) => {
        if (!cancelled) setPreview(String(result.count));
      })
      .catch(() => {
        if (!cancelled) setPreview(EMPTY_PREVIEW);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRoleIds, allRoles, includeSender, hasTargets]);

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((ids) =>
      ids.includes(roleId)
        ? ids.filter((id) => id !== roleId)
        : [...ids, roleId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title,
        message,
        kind,
        sendInApp,
        sendEmail,
        allRoles,
        roleIds: selectedRoleIds,
        userIds: [],
        includeSender,
        scheduledAtLocal: sendNow ? null : scheduledAtLocal,
      };
      // Validation comes back as a value, not an exception: Next strips the
      // message of anything a Server Action throws in a production build.
      const result = editing
        ? await updateBroadcast(editing.id, payload)
        : await createBroadcast({ ...payload, sendNow });

      if (isFailure(result)) {
        toast.error(
          editing ? "No se pudo guardar" : "No se pudo enviar",
          result.error,
        );
        return;
      }

      toast.success(
        editing
          ? "Difusión actualizada"
          : sendNow
            ? "Difusión enviada"
            : "Difusión programada",
      );
      onCancelEdit();
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasTargets) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nueva difusión</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No tienes destinos de difusión configurados. Pídele a un usuario
            ROOT que defina a qué roles puede difundir tu rol.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {editing ? "Editar difusión programada" : "Nueva difusión"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ingrese el título de la difusión"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ingrese el mensaje de la difusión"
              rows={4}
              required
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kind">Tipo</Label>
              <Select
                value={kind}
                onValueChange={(val) => setKind(val as BroadcastKindInput)}
                disabled={loading}
              >
                <SelectTrigger id="kind">
                  <SelectValue placeholder="Seleccione el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANNOUNCEMENT">Anuncio</SelectItem>
                  <SelectItem value="SYSTEM">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Canales</Label>
              <div className="flex gap-6 pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="channel-inapp"
                    checked={sendInApp}
                    onCheckedChange={(v) => setSendInApp(v === true)}
                    disabled={loading}
                  />
                  <label htmlFor="channel-inapp">Notificación</label>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="channel-email"
                    checked={sendEmail}
                    onCheckedChange={(v) => setSendEmail(v === true)}
                    disabled={loading}
                  />
                  <label htmlFor="channel-email">Correo</label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Destinatarios</Label>
            {canTargetAll && (
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="audience-all"
                  checked={allRoles}
                  onCheckedChange={(v) => setAllRoles(v === true)}
                  disabled={loading}
                />
                <label htmlFor="audience-all">Todos los roles</label>
              </div>
            )}
            {!allRoles && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {allowedRoles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center gap-2 text-sm"
                    title={role.description ?? undefined}
                  >
                    <Checkbox
                      id={`audience-role-${role.id}`}
                      checked={selectedRoleIds.includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                      disabled={loading}
                    />
                    <label htmlFor={`audience-role-${role.id}`}>
                      {role.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Destinatarios estimados:{" "}
              <span className="font-medium text-foreground">{preview}</span>
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="include-sender"
                checked={includeSender}
                onCheckedChange={(v) => setIncludeSender(v === true)}
                disabled={loading}
              />
              <label htmlFor="include-sender">Enviarme una copia</label>
            </div>
          </div>

          {!editing && (
            <div className="space-y-2">
              <Label>Envío</Label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="timing"
                    checked={sendNow}
                    onChange={() => setSendNow(true)}
                    disabled={loading}
                  />
                  Enviar ahora
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="timing"
                    checked={!sendNow}
                    onChange={() => setSendNow(false)}
                    disabled={loading}
                  />
                  Programar
                </label>
              </div>
              {!sendNow && (
                <Input
                  type="datetime-local"
                  value={scheduledAtLocal}
                  onChange={(e) => setScheduledAtLocal(e.target.value)}
                  required
                  disabled={loading}
                />
              )}
            </div>
          )}

          {editing && (
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Fecha y hora programadas</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEdit}
                disabled={loading}
              >
                Cancelar edición
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading
                ? "Guardando..."
                : editing
                  ? "Guardar cambios"
                  : sendNow
                    ? "Enviar ahora"
                    : "Programar difusión"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
