"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { assignPermissionsToRole } from "@/lib/actions/roles";

type Permission = {
  id: number;
  name: string;
  description: string | null;
  resource: string | null;
  action: string | null;
  routePath: string | null;
};

type PermissionSelectorProps = {
  roleId: number;
  roleName: string;
  allPermissions: Permission[];
  currentPermissionIds: number[];
};

export function PermissionSelector({
  roleId,
  roleName,
  allPermissions,
  currentPermissionIds,
}: PermissionSelectorProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(currentPermissionIds)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group permissions by resource
  const groupedPermissions = allPermissions.reduce(
    (acc, perm) => {
      const resource = perm.resource || "general";
      if (!acc[resource]) {
        acc[resource] = [];
      }
      acc[resource].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const handleToggle = (permId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(permId)) {
      newSelected.delete(permId);
    } else {
      newSelected.add(permId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (resource: string) => {
    const newSelected = new Set(selectedIds);
    const resourcePerms = groupedPermissions[resource];
    const allSelected = resourcePerms.every((p) => selectedIds.has(p.id));

    if (allSelected) {
      // Deselect all
      resourcePerms.forEach((p) => newSelected.delete(p.id));
    } else {
      // Select all
      resourcePerms.forEach((p) => newSelected.add(p.id));
    }
    setSelectedIds(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await assignPermissionsToRole(roleId, Array.from(selectedIds));
      router.push(`/admin/roles/${roleId}`);
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

      <div className="flex items-center justify-between bg-muted p-4 rounded-lg">
        <div>
          <p className="text-sm font-medium">Permisos seleccionados</p>
          <p className="text-2xl font-bold">{selectedIds.size}</p>
        </div>
        <Badge variant="outline">{allPermissions.length} totales</Badge>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedPermissions).map(([resource, perms]) => {
          const allSelected = perms.every((p) => selectedIds.has(p.id));
          const someSelected = perms.some((p) => selectedIds.has(p.id));

          return (
            <Card key={resource}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg capitalize">{resource}</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAll(resource)}
                  >
                    {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {perms.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border"
                    >
                      <Checkbox
                        id={`perm-${perm.id}`}
                        checked={selectedIds.has(perm.id)}
                        onCheckedChange={() => handleToggle(perm.id)}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`perm-${perm.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {perm.name}
                        </Label>
                        {perm.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {perm.description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {perm.action && (
                            <Badge variant="secondary" className="text-xs">
                              {perm.action}
                            </Badge>
                          )}
                          {perm.routePath && (
                            <Badge variant="outline" className="text-xs">
                              {perm.routePath}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
          {loading ? "Guardando..." : "Guardar Permisos"}
        </Button>
      </div>
    </form>
  );
}
