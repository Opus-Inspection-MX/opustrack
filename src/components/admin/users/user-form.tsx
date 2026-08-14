"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isFailure } from "@/lib/actions/result";
import { createUser, type UserFormData, updateUser } from "@/lib/actions/users";
import { toDateInputMX } from "@/lib/utils/datetime";

type UserFormProps = {
  user?: {
    id: string;
    name: string;
    email: string;
    userRoles: Array<{ role: { id: number; name: string } }>;
    userStatusId: number;
    clienteId: string | null;
    hireDate: Date | string | null;
    userProfile: {
      telephone: string | null;
      secondaryTelephone: string | null;
      emergencyContact: string | null;
      jobPosition: string | null;
    } | null;
  };
  roles: Array<{ id: number; name: string }>;
  statuses: Array<{ id: number; name: string }>;
  clientes: Array<{ id: string; name: string; code: string }>;
};

export function UserForm({ user, roles, statuses, clientes }: UserFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UserFormData>({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    roleIds: user?.userRoles?.map((ur) => ur.role.id) ?? [],
    userStatusId: user?.userStatusId || statuses[0]?.id || 0,
    clienteId: user?.clienteId || null,
    // The date input wants "YYYY-MM-DD"; the server sends an instant.
    hireDate: user?.hireDate ? toDateInputMX(user.hireDate) : "",
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
      const result = user
        ? await updateUser(user.id, formData)
        : await createUser(formData);

      if (isFailure(result)) {
        setError(result.error);
        // Without this the submit button stays disabled after a rejected save
        // and the form can never be retried.
        setLoading(false);
        return;
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
              <Label htmlFor="roleIds">Roles *</Label>
              {/* Many: a person can administer vacations, administer
                  operations and still be an FSR who gets dispatched. */}
              <MultiSelect
                id="roleIds"
                options={roles.map((role) => ({
                  value: role.id.toString(),
                  label: role.name,
                }))}
                value={formData.roleIds.map(String)}
                onValueChange={(ids) =>
                  setFormData({
                    ...formData,
                    roleIds: ids.map((id) => parseInt(id, 10)),
                  })
                }
                placeholder="Seleccionar roles"
                searchPlaceholder="Buscar rol..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userStatusId">Estado *</Label>
              <Select
                value={formData.userStatusId.toString()}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    userStatusId: parseInt(value, 10),
                  })
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
              <Label htmlFor="clienteId">Centro de Verificación</Label>
              <SearchableSelect
                options={[
                  { value: "none", label: "Sin asignar" },
                  ...clientes.map((cliente) => ({
                    value: cliente.id,
                    label: `${cliente.name} (${cliente.code})`,
                  })),
                ]}
                value={formData.clienteId || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    clienteId: value === "none" ? null : value,
                  })
                }
                placeholder="Seleccionar Cliente"
                searchPlaceholder="Buscar Cliente..."
                emptyMessage="No se encontraron Cliente."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hireDate">Fecha de Contratación</Label>
              <Input
                id="hireDate"
                type="date"
                value={formData.hireDate ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, hireDate: e.target.value || null })
                }
              />
              <p className="text-xs text-muted-foreground">
                Determina los períodos y días de vacaciones del usuario.
              </p>
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
          {loading
            ? "Guardando..."
            : user
              ? "Actualizar Usuario"
              : "Crear Usuario"}
        </Button>
      </div>
    </form>
  );
}
