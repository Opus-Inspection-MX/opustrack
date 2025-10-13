// src/lib/authz/authz.ts

// ==== Grupos de permisos reutilizables ====

// Permisos básicos de incidentes
const INCIDENT_BASE = ["incident.read", "incident.create"];

// Permisos completos de incidentes
const INCIDENT_FULL = [
  ...INCIDENT_BASE,
  "incident.update",
  "incident.delete",
  "incident.assign",
  "incident.close",
] as const;

// Permisos de gestión de usuarios
const USER_MANAGEMENT = [
  "user.read",
  "user.create",
  "user.update",
  "user.delete",
] as const;

// ==== Objeto de roles unificado (fuente de verdad) ====
export const ROLE_DEFS = {
  USUARIO_EXTERNO: {
    defaultPath: "/dashboard/external",
    permissions: INCIDENT_BASE,
  },
  USUARIO_PERSONAL: {
    defaultPath: "/dashboard/staff",
    permissions: [
      ...INCIDENT_BASE,
      "incident.update",
      "incident.close",
    ] as const,
  },
  USUARIO_SISTEMA: {
    defaultPath: "/dashboard/system",
    permissions: INCIDENT_FULL,
  },
  USUARIO_ADMINISTRADOR: {
    defaultPath: "/dashboard/admin",
    permissions: [...USER_MANAGEMENT, ...INCIDENT_FULL] as const,
  },
} as const;

// ==== Tipos derivados automáticamente ====
export type RoleName = keyof typeof ROLE_DEFS;
export type PermissionName =
  (typeof ROLE_DEFS)[RoleName]["permissions"][number];

// Lista de roles (en orden estable)
export const ROLES = Object.keys(ROLE_DEFS) as RoleName[];

// Lista de permisos únicos
export const PERMISSIONS = Array.from(
  new Set(
    (
      Object.values(ROLE_DEFS) as { permissions: readonly PermissionName[] }[]
    ).flatMap((r) => r.permissions)
  )
) as PermissionName[];

// Helper: verificar si un rol tiene un permiso
export function roleHasPermission(role: RoleName, permission: string) {
  return ROLE_DEFS[role].permissions.includes(permission);
}

// Helper: resolver default path (BD > ROLE_DEFS > fallback)
export function resolveDefaultPath(params: {
  roleName?: string | null;
  dbDefaultPath?: string | null;
}): string {
  if (params.dbDefaultPath && params.dbDefaultPath.startsWith("/")) {
    return params.dbDefaultPath;
  }
  const rn = params.roleName as RoleName | undefined;
  if (rn && ROLE_DEFS[rn]?.defaultPath) {
    return ROLE_DEFS[rn].defaultPath;
  }
  return "/dashboard";
}
