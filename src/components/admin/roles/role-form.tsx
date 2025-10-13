"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createRole, updateRole, type RoleFormData } from "@/lib/actions/roles";

type RoleFormProps = {
  role?: {
    id: number;
    name: string;
    description: string | null;
    defaultPath: string;
  };
};

export function RoleForm({ role }: RoleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<RoleFormData>({
    name: role?.name || "",
    description: role?.description || "",
    defaultPath: role?.defaultPath || "/",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (role) {
        await updateRole(role.id, formData);
      } else {
        await createRole(formData);
      }
      router.push("/admin/roles");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Información del Rol</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Rol *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="ej. ADMINISTRADOR, FSR, CLIENT"
                required
              />
              <p className="text-xs text-muted-foreground">
                Identificador único del rol (usar mayúsculas)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultPath">Ruta Predeterminada *</Label>
              <Input
                id="defaultPath"
                value={formData.defaultPath}
                onChange={(e) =>
                  setFormData({ ...formData, defaultPath: e.target.value })
                }
                placeholder="/admin"
                required
              />
              <p className="text-xs text-muted-foreground">
                Ruta donde el usuario inicia después de login
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descripción del rol y sus responsabilidades"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? "Guardando..."
            : role
              ? "Actualizar Rol"
              : "Crear Rol"}
        </Button>
      </div>

      {!role && (
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> Después de crear el rol, podrás asignarle
            permisos desde la página de detalles del rol.
          </p>
        </div>
      )}
    </form>
  );
}
