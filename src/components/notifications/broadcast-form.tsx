"use client";

import { X } from "lucide-react";
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
  type BroadcastRecipientOption,
  type BroadcastTargetRole,
  createBroadcast,
  previewBroadcastRecipients,
  searchBroadcastRecipients,
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

type AudienceMode = "all" | "roles" | "users";

/** Keep already-picked options visible when a new search resolves. */
function mergeOptions(
  previous: BroadcastRecipientOption[],
  results: BroadcastRecipientOption[],
  selectedIds: string[],
): BroadcastRecipientOption[] {
  const byId = new Map(results.map((o) => [o.id, o] as const));
  for (const option of previous) {
    if (selectedIds.includes(option.id) && !byId.has(option.id)) {
      byId.set(option.id, option);
    }
  }
  return [...byId.values()];
}

/**
 * Broadcast composer: copy + kind + channels + scope + timing in one card.
 *
 * The audience is one of three exclusive modes — Todos (if the sender may
 * target all), Por rol (the checkboxes, limited to the sender's allowed
 * roles) or Usuarios específicos (type-ahead search, clamped server-side to
 * the sender's reach). Role checkboxes and search results render ONLY what
 * the sender may address (fail closed comes from the server too —
 * `createBroadcast` re-validates the scope). The recipient preview counts
 * the live audience, clamped to that scope.
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
  const [mode, setMode] = useState<AudienceMode>("roles");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<BroadcastRecipientOption[]>(
    [],
  );
  const [userSearch, setUserSearch] = useState("");
  const [searching, setSearching] = useState(false);
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
      setMode("roles");
      setSelectedRoleIds([]);
      setSelectedUserIds([]);
      setUserOptions([]);
      setUserSearch("");
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
    setSelectedRoleIds(editing.roles.map((r) => r.id));
    const editingUsers = editing.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roleNames: [],
    }));
    setSelectedUserIds(editingUsers.map((u) => u.id));
    setUserOptions(editingUsers);
    setUserSearch("");
    setMode(
      editing.allRoles ? "all" : editing.usersTotal > 0 ? "users" : "roles",
    );
    setIncludeSender(editing.includeSender);
    setSendNow(false);
    setScheduledAtLocal(toDatetimeLocalMX(editing.scheduledAt));
  }, [editing]);

  // Type-ahead against the in-reach user search (server clamps the scope).
  useEffect(() => {
    if (mode !== "users") return;
    const query = userSearch.trim();
    if (query.length < 2) {
      setSearching(false);
      setUserOptions((previous) =>
        previous.filter((o) => selectedUserIds.includes(o.id)),
      );
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchBroadcastRecipients(query)
        .then((results) => {
          setUserOptions((previous) =>
            mergeOptions(previous, results, selectedUserIds),
          );
          setSearching(false);
        })
        .catch(() => {
          setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, mode, selectedUserIds]);

  // Live recipient preview, clamped to the sender's scope server-side.
  useEffect(() => {
    if (!hasTargets) {
      setPreview(EMPTY_PREVIEW);
      return;
    }
    let cancelled = false;
    previewBroadcastRecipients({
      roleIds: mode === "roles" ? selectedRoleIds : [],
      allRoles: mode === "all",
      includeSender,
      userIds: mode === "users" ? selectedUserIds : [],
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
  }, [mode, selectedRoleIds, selectedUserIds, includeSender, hasTargets]);

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((ids) =>
      ids.includes(roleId)
        ? ids.filter((id) => id !== roleId)
        : [...ids, roleId],
    );
  };

  const addUser = (option: BroadcastRecipientOption) => {
    setUserOptions((previous) =>
      previous.some((o) => o.id === option.id)
        ? previous
        : [...previous, option],
    );
    setSelectedUserIds((ids) =>
      ids.includes(option.id) ? ids : [...ids, option.id],
    );
  };

  const removeUser = (userId: string) => {
    setSelectedUserIds((ids) => ids.filter((id) => id !== userId));
  };

  const selectedOptions = selectedUserIds.map(
    (id) =>
      userOptions.find((o) => o.id === id) ?? {
        id,
        name: id,
        email: "",
        roleNames: [],
      },
  );
  const searchResults = userOptions.filter(
    (o) => !selectedUserIds.includes(o.id),
  );

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
        allRoles: mode === "all",
        roleIds: mode === "roles" ? selectedRoleIds : [],
        userIds: mode === "users" ? selectedUserIds : [],
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
            <div
              role="radiogroup"
              aria-label="Modo de destinatarios"
              className="flex flex-col gap-1"
            >
              {canTargetAll && (
                <label
                  htmlFor="audience-mode-all"
                  className="flex min-h-[44px] items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    id="audience-mode-all"
                    name="audience-mode"
                    checked={mode === "all"}
                    onChange={() => setMode("all")}
                    disabled={loading}
                  />
                  Todos los roles
                </label>
              )}
              <label
                htmlFor="audience-mode-roles"
                className="flex min-h-[44px] items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  id="audience-mode-roles"
                  name="audience-mode"
                  checked={mode === "roles"}
                  onChange={() => setMode("roles")}
                  disabled={loading}
                />
                Por rol
              </label>
              <label
                htmlFor="audience-mode-users"
                className="flex min-h-[44px] items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  id="audience-mode-users"
                  name="audience-mode"
                  checked={mode === "users"}
                  onChange={() => setMode("users")}
                  disabled={loading}
                />
                Usuarios específicos
              </label>
            </div>

            {mode === "all" && (
              <p className="text-sm text-muted-foreground">
                Llegará a todos los usuarios activos.
              </p>
            )}

            {mode === "roles" && (
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

            {mode === "users" && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="broadcast-user-search">Buscar usuarios</Label>
                <Input
                  id="broadcast-user-search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Escribe al menos 2 letras del nombre o correo"
                  autoComplete="off"
                  disabled={loading}
                />
                {searching && (
                  <p className="text-sm text-muted-foreground">Buscando…</p>
                )}
                {!searching &&
                  userSearch.trim().length >= 2 &&
                  searchResults.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Sin resultados para esa búsqueda.
                    </p>
                  )}
                {searchResults.length > 0 && (
                  <ul className="divide-y rounded-md border">
                    {searchResults.map((option) => (
                      <li key={option.id}>
                        <button
                          type="button"
                          onClick={() => addUser(option)}
                          aria-label={`Agregar a ${option.name}`}
                          disabled={loading}
                          className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span>
                            <span className="font-medium">{option.name}</span>{" "}
                            <span className="text-muted-foreground">
                              {option.email}
                            </span>
                          </span>
                          {option.roleNames.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {option.roleNames.join(", ")}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedOptions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Seleccionados ({selectedOptions.length})
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {selectedOptions.map((option) => (
                        <li
                          key={option.id}
                          className="flex min-h-[44px] items-center gap-1 rounded-md border bg-muted px-2 py-1 text-sm"
                        >
                          <span>
                            <span className="font-medium">{option.name}</span>
                            {option.email && (
                              <span className="text-muted-foreground">
                                {" "}
                                {option.email}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeUser(option.id)}
                            aria-label={`Quitar a ${option.name}`}
                            disabled={loading}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded hover:bg-background"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
