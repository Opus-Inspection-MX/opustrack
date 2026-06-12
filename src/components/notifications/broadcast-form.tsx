"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  type BroadcastAudience,
  type BroadcastType,
  sendBroadcast,
} from "@/lib/actions/notifications";

interface Role {
  id: number;
  name: string;
  description: string | null;
}

interface BroadcastFormProps {
  roles: Role[];
}

export function BroadcastForm({ roles }: BroadcastFormProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<BroadcastType>("announcement");
  const [audience, setAudience] = useState<BroadcastAudience>("all");
  const [roleId, setRoleId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessCount(null);

    try {
      const result = await sendBroadcast({
        title,
        message,
        type,
        audience,
        roleId: audience === "by-role" && roleId ? Number(roleId) : undefined,
      });
      setSuccessCount(result.count);
      setTitle("");
      setMessage("");
      setType("announcement");
      setAudience("all");
      setRoleId("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva difusión</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {successCount !== null && (
            <div className="bg-green-500/15 text-green-700 dark:text-green-400 px-4 py-3 rounded-md text-sm">
              Notificación enviada correctamente a {successCount}{" "}
              {successCount === 1 ? "usuario" : "usuarios"}.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ingrese el título de la notificación"
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
              placeholder="Ingrese el mensaje de la notificación"
              rows={4}
              required
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de notificación</Label>
              <Select
                value={type}
                onValueChange={(val) => setType(val as BroadcastType)}
                disabled={loading}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Seleccione el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">Anuncio</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Audiencia</Label>
              <Select
                value={audience}
                onValueChange={(val) => {
                  setAudience(val as BroadcastAudience);
                  if (val !== "by-role") setRoleId("");
                }}
                disabled={loading}
              >
                <SelectTrigger id="audience">
                  <SelectValue placeholder="Seleccione la audiencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todos los usuarios activos
                  </SelectItem>
                  <SelectItem value="by-role">Por rol</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {audience === "by-role" && (
            <div className="space-y-2">
              <Label htmlFor="roleId">Rol</Label>
              <Select
                value={roleId}
                onValueChange={setRoleId}
                disabled={loading}
                required
              >
                <SelectTrigger id="roleId">
                  <SelectValue placeholder="Seleccione un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {role.name}
                      {role.description ? ` — ${role.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar notificación"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
