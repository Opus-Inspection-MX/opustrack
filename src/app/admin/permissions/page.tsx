import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRouteAccess } from "@/lib/auth/auth";
import {
  PERMISSION_LIST,
  type PermissionDef,
} from "@/lib/authz/permission-catalog";

/**
 * Read-only permission catalog (G-8).
 *
 * The `route:admin-permissions` grant exists only so this page opens; no seed
 * role but ROOT holds it. There is deliberately no editor here: grants change
 * through the roles screens (and the catalog itself in code), so this page
 * documents what each permission means and which route it guards.
 */
export default async function PermissionsPage() {
  await requireRouteAccess("/admin/permissions");

  const groups = new Map<string, PermissionDef[]>();
  for (const permission of PERMISSION_LIST) {
    const key = permission.resource ?? "rutas";
    const group = groups.get(key) ?? [];
    group.push(permission);
    groups.set(key, group);
  }

  return (
    <PageContainer>
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin" label="Volver" />
        <div className="flex-1">
          <PageHeader
            title="Permisos"
            description="Catálogo de permisos del sistema (solo lectura)"
          />
        </div>
      </div>

      <div className="space-y-6">
        {[...groups.entries()].map(([resource, permissions]) => (
          <Card key={resource}>
            <CardHeader>
              <CardTitle className="capitalize">{resource}</CardTitle>
              <CardDescription>{permissions.length} permiso(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {permissions.map((permission) => (
                  <li
                    key={permission.name}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {permission.name}
                      </code>
                      <p className="text-sm text-muted-foreground">
                        {permission.description}
                      </p>
                    </div>
                    {permission.routePath && (
                      <Badge variant="outline" className="w-fit shrink-0">
                        {permission.routePath}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
