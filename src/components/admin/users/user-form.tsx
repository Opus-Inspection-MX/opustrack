"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createUser, updateUser, type UserFormData } from "@/lib/actions/users";

type UserFormProps = {
  user?: {
    id: string;
    name: string;
    email: string;
    roleId: number;
    userStatusId: number;
    vicId: string | null;
    userProfile: {
      telephone: string | null;
      secondaryTelephone: string | null;
      emergencyContact: string | null;
      jobPosition: string | null;
    } | null;
  };
  roles: Array<{ id: number; name: string }>;
  statuses: Array<{ id: number; name: string }>;
  vics: Array<{ id: string; name: string; code: string }>;
};

export function UserForm({ user, roles, statuses, vics }: UserFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UserFormData>({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    roleId: user?.roleId || roles[0]?.id || 0,
    userStatusId: user?.userStatusId || statuses[0]?.id || 0,
    vicId: user?.vicId || null,
    telephone: user?.userProfile?.telephone || "",
    secondaryTelephone: user?.userProfile?.secondaryTelephone || "",
    emergencyContact: user?.userProfile?.emergencyContact || "",
    jobPosition: user?.userProfile?.jobPosition || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (user) {
        await updateUser(user.id, formData);
      } else {
        await createUser(formData);
      }
      router.push("/admin/users");
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
          <CardTitle>Información Personal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Contraseña {user ? "(dejar vacío para no cambiar)" : "*"}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required={!user}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobPosition">Puesto de Trabajo</Label>
              <Input
                id="jobPosition"
                value={formData.jobPosition}
                onChange={(e) =>
                  setFormData({ ...formData, jobPosition: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asignación y Permisos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="roleId">Rol *</Label>
              <Select
                value={formData.roleId.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, roleId: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userStatusId">Estado *</Label>
              <Select
                value={formData.userStatusId.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, userStatusId: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vicId">Centro de Verificación</Label>
              <Select
                value={formData.vicId || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, vicId: value === "none" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar VIC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {vics.map((vic) => (
                    <SelectItem key={vic.id} value={vic.id}>
                      {vic.name} ({vic.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información de Contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telephone">Teléfono</Label>
              <Input
                id="telephone"
                type="tel"
                value={formData.telephone}
                onChange={(e) =>
                  setFormData({ ...formData, telephone: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryTelephone">Teléfono Secundario</Label>
              <Input
                id="secondaryTelephone"
                type="tel"
                value={formData.secondaryTelephone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    secondaryTelephone: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Contacto de Emergencia</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    emergencyContact: e.target.value,
                  })
                }
              />
            </div>
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
          {loading ? "Guardando..." : user ? "Actualizar Usuario" : "Crear Usuario"}
        </Button>
      </div>
    </form>
  );
}
