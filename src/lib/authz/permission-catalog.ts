/**
 * Permission catalog — the single source of truth for authorization names.
 *
 * Every permission row the seeds create and every permission string the code
 * requires (`requirePermission`, `withPermission`, `canPerform`, catalog
 * action configs) must come from here. `PermissionName` flows into the auth
 * helper signatures, so a misspelled permission stops `tsc` instead of
 * silently denying (or, worse, the seed silently skipping the grant — H-20).
 *
 * This module is dependency-free on purpose: seeds, scripts, tests and the
 * Edge middleware can import it without pulling Prisma or Node APIs.
 */

export type PermissionDef = {
  readonly name: string;
  readonly description: string;
  readonly resource?: string;
  readonly action?: string;
  readonly routePath?: string;
  readonly exact?: boolean;
};

/**
 * Every permission row. Mirrors the seed data that used to live inline in
 * `initial_load/seed.example.ts` (and the gitignored `seed.ts`): both seeds
 * now upsert exactly this list, so a fresh database converges to it.
 */
export const PERMISSIONS = [
  {
    name: "route:inicio",
    description: "Personal landing screen",
    routePath: "/inicio",
  },
  {
    name: "route:admin",
    description:
      "Whole admin panel (/admin prefix). For the landing page alone use route:admin-panel",
    routePath: "/admin",
  },
  {
    name: "route:fsr",
    description: "Access to FSR dashboard",
    routePath: "/fsr",
  },
  {
    name: "route:reporter",
    description: "Access to reporter dashboard",
    routePath: "/reporter",
  },
  {
    name: "route:guest",
    description: "Access to guest dashboard",
    routePath: "/guest",
  },
  {
    name: "route:profile",
    description: "Access to the shared profile page",
    routePath: "/profile",
  },
  {
    name: "route:vacations",
    description: "My vacations",
    routePath: "/vacations",
  },
  {
    name: "route:notifications",
    description: "My notifications",
    routePath: "/notifications",
  },
  {
    name: "route:admin-panel",
    description: "Admin landing page",
    routePath: "/admin",
    exact: true,
  },
  {
    name: "route:admin-tracking",
    description: "Care queue tracking",
    routePath: "/admin/tracking",
  },
  {
    name: "route:admin-incidents",
    description: "Incident administration",
    routePath: "/admin/incidents",
  },
  {
    name: "route:admin-programacion",
    description: "Schedule staffing",
    routePath: "/admin/programacion",
  },
  {
    name: "route:admin-schedules",
    description: "Schedules",
    routePath: "/admin/schedules",
  },
  {
    name: "route:admin-assignments",
    description: "Assignments",
    routePath: "/admin/assignments",
  },
  {
    name: "route:admin-assignment-activities",
    description: "Work activities",
    routePath: "/admin/assignment-activities",
  },
  {
    name: "route:admin-reports",
    description: "Reports",
    routePath: "/admin/reports",
  },
  {
    name: "route:admin-organization",
    description: "Organization: clients, lines, equipment, states",
    routePath: "/admin/clients",
  },
  {
    name: "route:admin-lines",
    description: "Lines",
    routePath: "/admin/lines",
  },
  {
    name: "route:admin-equipments",
    description: "Equipment",
    routePath: "/admin/equipments",
  },
  {
    name: "route:admin-states",
    description: "States",
    routePath: "/admin/states",
  },
  {
    name: "route:admin-vehicles",
    description: "Vehicles",
    routePath: "/admin/vehicles",
  },
  {
    name: "route:admin-users",
    description: "User administration",
    routePath: "/admin/users",
  },
  {
    name: "route:admin-roles",
    description: "Role administration",
    routePath: "/admin/roles",
  },
  {
    name: "route:admin-permissions",
    description: "Permission administration",
    routePath: "/admin/permissions",
  },
  {
    name: "route:admin-vacations",
    description: "Vacation administration",
    routePath: "/admin/vacations",
  },
  {
    name: "route:admin-vacation-accrual",
    description: "Vacation accrual rules",
    routePath: "/admin/settings/vacation-accrual",
  },
  {
    name: "route:admin-notifications",
    description:
      "Notifications (obsolete: replaced by notifications:broadcast and route:notifications)",
    routePath: "/admin/notifications",
  },
  {
    name: "notifications:broadcast",
    description: "Broadcast notifications to roles",
    resource: "notifications",
    action: "broadcast",
    routePath: "/admin/notifications",
  },
  {
    name: "notifications:configure",
    description: "Configure notification channels",
    resource: "notifications",
    action: "configure",
    routePath: "/admin/settings/notifications",
  },
  {
    name: "scope:all-clients",
    description: "See data from every Client, not just assigned ones",
    resource: "scope",
    action: "all-clients",
  },
  {
    name: "assignments:manage-all",
    description: "Manage assignments one is not the FSR of",
    resource: "assignments",
    action: "manage-all",
  },
  {
    name: "vehicle-trips:manage-all",
    description: "Manage other FSRs' vehicle trips",
    resource: "vehicle-trips",
    action: "manage-all",
  },
  {
    name: "incidents:read",
    description: "View incidents",
    resource: "incidents",
    action: "read",
    routePath: "/incidents",
  },
  {
    name: "incidents:create",
    description: "Create incidents",
    resource: "incidents",
    action: "create",
  },
  {
    name: "incidents:update",
    description: "Update incidents",
    resource: "incidents",
    action: "update",
  },
  {
    name: "incidents:delete",
    description: "Delete incidents",
    resource: "incidents",
    action: "delete",
  },
  {
    name: "incidents:assign",
    description: "Assign incidents",
    resource: "incidents",
    action: "assign",
  },
  {
    name: "incidents:close",
    description: "Close incidents",
    resource: "incidents",
    action: "close",
  },
  {
    name: "incidents:cancel",
    description: "Cancel incidents (admin terminal action without ODT)",
    resource: "incidents",
    action: "cancel",
  },
  {
    name: "users:read",
    description: "View users",
    resource: "users",
    action: "read",
  },
  {
    name: "users:create",
    description: "Create users",
    resource: "users",
    action: "create",
  },
  {
    name: "users:update",
    description: "Update users",
    resource: "users",
    action: "update",
  },
  {
    name: "users:delete",
    description: "Delete users",
    resource: "users",
    action: "delete",
  },
  {
    name: "roles:read",
    description: "View roles",
    resource: "roles",
    action: "read",
  },
  {
    name: "roles:create",
    description: "Create roles",
    resource: "roles",
    action: "create",
  },
  {
    name: "roles:update",
    description: "Update roles",
    resource: "roles",
    action: "update",
  },
  {
    name: "roles:delete",
    description: "Delete roles",
    resource: "roles",
    action: "delete",
  },
  {
    name: "permissions:read",
    description: "View permissions",
    resource: "permissions",
    action: "read",
  },
  {
    name: "permissions:manage",
    description: "Manage permissions",
    resource: "permissions",
    action: "manage",
  },
  {
    name: "assignments:read",
    description: "View assignments",
    resource: "assignments",
    action: "read",
  },
  {
    name: "assignments:create",
    description: "Create assignments",
    resource: "assignments",
    action: "create",
  },
  {
    name: "assignments:update",
    description: "Update assignments",
    resource: "assignments",
    action: "update",
  },
  {
    name: "assignments:delete",
    description: "Delete assignments",
    resource: "assignments",
    action: "delete",
  },
  {
    name: "assignments:assign",
    description: "Assign assignments",
    resource: "assignments",
    action: "assign",
  },
  {
    name: "assignments:complete",
    description: "Complete assignments",
    resource: "assignments",
    action: "complete",
  },
  {
    name: "assignments:reopen",
    description: "Reopen closed assignments (admin only)",
    resource: "assignments",
    action: "reopen",
  },
  {
    name: "assignment-activities:read",
    description: "View assignment activities",
    resource: "assignment-activities",
    action: "read",
  },
  {
    name: "assignment-activities:create",
    description: "Create assignment activities",
    resource: "assignment-activities",
    action: "create",
  },
  {
    name: "assignment-activities:update",
    description: "Update assignment activities",
    resource: "assignment-activities",
    action: "update",
  },
  {
    name: "assignment-activities:delete",
    description: "Delete assignment activities",
    resource: "assignment-activities",
    action: "delete",
  },
  {
    name: "assignment-activities:complete",
    description: "Complete assignment activities",
    resource: "assignment-activities",
    action: "complete",
  },
  {
    name: "clients:read",
    description: "View clients",
    resource: "clients",
    action: "read",
  },
  {
    name: "clients:create",
    description: "Create clients",
    resource: "clients",
    action: "create",
  },
  {
    name: "clients:update",
    description: "Update clients",
    resource: "clients",
    action: "update",
  },
  {
    name: "clients:delete",
    description: "Delete clients",
    resource: "clients",
    action: "delete",
  },
  {
    name: "schedules:read",
    description: "View schedules",
    resource: "schedules",
    action: "read",
  },
  {
    name: "schedules:create",
    description: "Create schedules",
    resource: "schedules",
    action: "create",
  },
  {
    name: "schedules:update",
    description: "Update schedules",
    resource: "schedules",
    action: "update",
  },
  {
    name: "schedules:delete",
    description: "Delete schedules",
    resource: "schedules",
    action: "delete",
  },
  {
    name: "reports:view",
    description: "View reports",
    resource: "reports",
    action: "read",
  },
  {
    name: "reports:export",
    description: "Export reports",
    resource: "reports",
    action: "export",
  },
  {
    name: "states:read",
    description: "View states",
    resource: "states",
    action: "read",
  },
  {
    name: "states:create",
    description: "Create states",
    resource: "states",
    action: "create",
  },
  {
    name: "states:update",
    description: "Update states",
    resource: "states",
    action: "update",
  },
  {
    name: "states:delete",
    description: "Delete states",
    resource: "states",
    action: "delete",
  },
  {
    name: "user-status:read",
    description: "View user statuses",
    resource: "user-status",
    action: "read",
  },
  {
    name: "user-status:create",
    description: "Create user statuses",
    resource: "user-status",
    action: "create",
  },
  {
    name: "user-status:update",
    description: "Update user statuses",
    resource: "user-status",
    action: "update",
  },
  {
    name: "user-status:delete",
    description: "Delete user statuses",
    resource: "user-status",
    action: "delete",
  },
  {
    name: "incident-types:read",
    description: "View incident types",
    resource: "incident-types",
    action: "read",
  },
  {
    name: "incident-types:create",
    description: "Create incident types",
    resource: "incident-types",
    action: "create",
  },
  {
    name: "incident-types:update",
    description: "Update incident types",
    resource: "incident-types",
    action: "update",
  },
  {
    name: "incident-types:delete",
    description: "Delete incident types",
    resource: "incident-types",
    action: "delete",
  },
  {
    name: "incident-status:read",
    description: "View incident statuses",
    resource: "incident-status",
    action: "read",
  },
  {
    name: "incident-status:create",
    description: "Create incident statuses",
    resource: "incident-status",
    action: "create",
  },
  {
    name: "incident-status:update",
    description: "Update incident statuses",
    resource: "incident-status",
    action: "update",
  },
  {
    name: "incident-status:delete",
    description: "Delete incident statuses",
    resource: "incident-status",
    action: "delete",
  },
  {
    name: "settings:read",
    description: "View settings and lookup data",
    resource: "settings",
    action: "read",
    routePath: "/admin/settings",
  },
  {
    name: "settings:create",
    description: "Create settings and lookup data",
    resource: "settings",
    action: "create",
  },
  {
    name: "settings:update",
    description: "Update settings and lookup data",
    resource: "settings",
    action: "update",
  },
  {
    name: "settings:delete",
    description: "Delete settings and lookup data",
    resource: "settings",
    action: "delete",
  },
  {
    name: "vehicles:read",
    description: "View vehicles",
    resource: "vehicles",
    action: "read",
  },
  {
    name: "vehicles:create",
    description: "Create vehicles",
    resource: "vehicles",
    action: "create",
  },
  {
    name: "vehicles:update",
    description: "Update vehicles",
    resource: "vehicles",
    action: "update",
  },
  {
    name: "vehicles:delete",
    description: "Delete vehicles",
    resource: "vehicles",
    action: "delete",
  },
  {
    name: "vehicle-trips:read",
    description: "View vehicle trips",
    resource: "vehicle-trips",
    action: "read",
  },
  {
    name: "vehicle-trips:create",
    description: "Start vehicle trips",
    resource: "vehicle-trips",
    action: "create",
  },
  {
    name: "vehicle-trips:update",
    description: "Update and end vehicle trips",
    resource: "vehicle-trips",
    action: "update",
  },
  {
    name: "vehicle-trips:delete",
    description: "Delete vehicle trips",
    resource: "vehicle-trips",
    action: "delete",
  },
  {
    name: "lines:read",
    description: "View lines",
    resource: "lines",
    action: "read",
  },
  {
    name: "lines:create",
    description: "Create lines",
    resource: "lines",
    action: "create",
  },
  {
    name: "lines:update",
    description: "Update lines",
    resource: "lines",
    action: "update",
  },
  {
    name: "lines:delete",
    description: "Delete lines",
    resource: "lines",
    action: "delete",
  },
  {
    name: "tracking:read",
    description: "View tracking dashboard",
    resource: "tracking",
    action: "read",
  },
  {
    name: "tracking:update",
    description: "Update tracking assignments",
    resource: "tracking",
    action: "update",
  },
  {
    name: "notifications:read",
    description: "View notifications",
    resource: "notifications",
    action: "read",
  },
  {
    name: "notifications:update",
    description: "Update notifications",
    resource: "notifications",
    action: "update",
  },
  {
    name: "notifications:delete",
    description: "Delete notifications",
    resource: "notifications",
    action: "delete",
  },
  {
    name: "dashboard:view",
    description: "View dashboard",
    resource: "dashboard",
    action: "read",
  },
  {
    name: "assignment-status:read",
    description: "View assignment statuses",
    resource: "assignment-status",
    action: "read",
  },
  {
    name: "assignment-status:create",
    description: "Create assignment statuses",
    resource: "assignment-status",
    action: "create",
  },
  {
    name: "assignment-status:update",
    description: "Update assignment statuses",
    resource: "assignment-status",
    action: "update",
  },
  {
    name: "assignment-status:delete",
    description: "Delete assignment statuses",
    resource: "assignment-status",
    action: "delete",
  },
  {
    name: "equipments:read",
    description: "View equipments",
    resource: "equipments",
    action: "read",
  },
  {
    name: "equipments:create",
    description: "Create equipments",
    resource: "equipments",
    action: "create",
  },
  {
    name: "equipments:update",
    description: "Update equipments",
    resource: "equipments",
    action: "update",
  },
  {
    name: "equipments:delete",
    description: "Delete equipments",
    resource: "equipments",
    action: "delete",
  },
  {
    name: "holidays:read",
    description: "View holiday catalog",
    resource: "holidays",
    action: "read",
    routePath: "/admin/holidays",
  },
  {
    name: "holidays:create",
    description: "Create holiday rules",
    resource: "holidays",
    action: "create",
  },
  {
    name: "holidays:update",
    description: "Update holiday rules",
    resource: "holidays",
    action: "update",
  },
  {
    name: "holidays:delete",
    description: "Soft-delete holiday rules",
    resource: "holidays",
    action: "delete",
  },
  {
    name: "vacations:read",
    description: "View vacation requests",
    resource: "vacations",
    action: "read",
  },
  {
    name: "vacations:create",
    description: "Create vacation requests",
    resource: "vacations",
    action: "create",
  },
  {
    name: "vacations:approve",
    description: "Approve or reject vacation requests",
    resource: "vacations",
    action: "approve",
  },
  {
    name: "vacations:delete",
    description: "Soft-delete vacation requests",
    resource: "vacations",
    action: "delete",
  },
  {
    name: "vacations:manage",
    description: "Set hire dates and override vacation day balances",
    resource: "vacations",
    action: "manage",
  },
] as const satisfies readonly PermissionDef[];

/** Every permission name the system knows. Auth helper signatures use it. */
export type PermissionName = (typeof PERMISSIONS)[number]["name"];

/**
 * Widened view of PERMISSIONS for runtime consumers (seeds, scripts) that
 * read the optional fields. Iterating the `as const` tuple directly narrows
 * each element to its literal shape, so `perm.resource` fails to compile on
 * route entries that omit it.
 */
export const PERMISSION_LIST: readonly PermissionDef[] = PERMISSIONS;

/** Fast membership check for seeds, scripts and tests. */
const CATALOG_NAMES: ReadonlySet<string> = new Set(
  PERMISSIONS.map((permission) => permission.name),
);

/** True when the catalog defines this permission name. */
export function isCatalogPermission(name: string): name is PermissionName {
  return CATALOG_NAMES.has(name);
}

// ---------------------------------------------------------------------------
// Reusable grant groups (spread into seed roles, as before)
// ---------------------------------------------------------------------------

/** Universal home: every role lands on /inicio with inbox and profile. */
export const UNIVERSAL_ROUTES: readonly PermissionName[] = [
  "route:inicio",
  "route:notifications",
  "route:profile",
];

/** Self-service vacations for every staff role (REPORTER and GUEST excluded). */
export const SELF_SERVICE_VACATIONS: readonly PermissionName[] = [
  "route:vacations",
  "vacations:read",
  "vacations:create",
  "vacations:delete",
];

/** Operational module routes held by ADMIN_OPERACION. */
export const OPERATIONS_ROUTES: readonly PermissionName[] = [
  "route:admin-panel",
  "route:admin-tracking",
  "route:admin-incidents",
  "route:admin-programacion",
  "route:admin-schedules",
  "route:admin-assignments",
  "route:admin-assignment-activities",
  "route:admin-reports",
  "route:admin-organization",
  "route:admin-lines",
  "route:admin-equipments",
  "route:admin-states",
  "route:admin-vehicles",
];

// ---------------------------------------------------------------------------
// Seed roles, by code
// ---------------------------------------------------------------------------

export type SeedRoleCode =
  | "ROOT"
  | "ADMIN_OPERACION"
  | "ADMIN_VACACIONES"
  | "FSR"
  | "EMPLEADO"
  | "REPORTER"
  | "GUEST";

export type SeedRoleDef = {
  readonly isSuperuser?: boolean;
  readonly grants: readonly PermissionName[];
};

export const SEED_ROLES = {
  // Holds everything implicitly via `isSuperuser`; the seed still writes one
  // row per catalog permission so the admin UI shows ROOT holding them.
  ROOT: { isSuperuser: true, grants: [] },
  ADMIN_OPERACION: {
    grants: [
      ...OPERATIONS_ROUTES,
      ...UNIVERSAL_ROUTES,
      "notifications:broadcast",
      ...SELF_SERVICE_VACATIONS,
      "scope:all-clients",
      "assignments:manage-all",
      "vehicle-trips:manage-all",
      "incidents:read",
      "incidents:create",
      "incidents:update",
      "incidents:delete",
      "incidents:assign",
      // Cancels from the incident detail screen (Fase 0d · H-06): the
      // role that sees CancelIncidentButton must hold this grant.
      "incidents:cancel",
      "assignments:read",
      "assignments:create",
      "assignments:update",
      "assignments:delete",
      "assignments:complete",
      // Reopens a CERRADO assignment from the admin detail screen
      // (Fase 0d · H-06; CERRADO → EN_PROGRESO is admin-only).
      "assignments:reopen",
      "assignment-activities:read",
      "assignment-activities:create",
      "assignment-activities:update",
      "assignment-activities:delete",
      "assignment-activities:complete",
      "schedules:read",
      "schedules:create",
      "schedules:update",
      "schedules:delete",
      "clients:read",
      "clients:create",
      "clients:update",
      "clients:delete",
      "lines:read",
      "lines:create",
      "lines:update",
      "lines:delete",
      "equipments:read",
      "equipments:create",
      "equipments:update",
      "equipments:delete",
      "vehicles:read",
      "vehicles:create",
      "vehicles:update",
      "vehicles:delete",
      "vehicle-trips:read",
      "vehicle-trips:create",
      "vehicle-trips:update",
      "vehicle-trips:delete",
      "incident-types:read",
      "incident-status:read",
      "assignment-status:read",
      // Reads states for the /admin/states screen the role already
      // routes to (Fase 0d · H-06; read only, not create/update/delete).
      "states:read",
      "users:read",
      "reports:view",
      "reports:export",
      "tracking:read",
      "tracking:update",
      "notifications:read",
      "notifications:update",
      "notifications:delete",
      "dashboard:view",
    ],
  },
  ADMIN_VACACIONES: {
    grants: [
      "route:admin-panel",
      "route:admin-vacations",
      ...UNIVERSAL_ROUTES,
      "notifications:broadcast",
      ...SELF_SERVICE_VACATIONS,
      "vacations:approve",
      "vacations:manage",
      "holidays:read",
      "holidays:create",
      "holidays:update",
      "holidays:delete",
      "route:admin-vacation-accrual",
      "users:read",
      "notifications:read",
      "notifications:update",
      "notifications:delete",
      "dashboard:view",
    ],
  },
  FSR: {
    grants: [
      "route:fsr",
      ...UNIVERSAL_ROUTES,
      ...SELF_SERVICE_VACATIONS,
      "incidents:read",
      "incidents:update",
      "assignments:read",
      "assignments:update",
      "assignments:complete",
      "assignment-activities:read",
      "assignment-activities:create",
      "assignment-activities:update",
      "assignment-activities:complete",
      "schedules:read",
      "users:read",
      "clients:read",
      "reports:view",
      "reports:export",
      "incident-status:read",
      "incident-types:read",
      "vehicles:read",
      "vehicle-trips:read",
      "vehicle-trips:create",
      "vehicle-trips:update",
      "vehicle-trips:delete",
      "lines:read",
      "lines:create",
      "lines:update",
      "lines:delete",
      "equipments:read",
      "equipments:create",
      "equipments:update",
      "equipments:delete",
      "notifications:read",
      "notifications:update",
      "notifications:delete",
      "dashboard:view",
      "assignment-status:read",
    ],
  },
  EMPLEADO: {
    grants: [
      ...UNIVERSAL_ROUTES,
      ...SELF_SERVICE_VACATIONS,
      "notifications:read",
      "notifications:update",
      "notifications:delete",
    ],
  },
  REPORTER: {
    grants: [
      "route:reporter",
      ...UNIVERSAL_ROUTES,
      "incidents:read",
      "incidents:create",
      "incident-types:read",
      "incident-status:read",
      "clients:read",
      "assignments:read",
      "schedules:read",
      "lines:read",
      "equipments:read",
      "notifications:read",
      "notifications:update",
      "notifications:delete",
      "dashboard:view",
    ],
  },
  GUEST: {
    grants: [
      "route:guest",
      ...UNIVERSAL_ROUTES,
      "incidents:read",
      "incident-types:read",
      "incident-status:read",
      "clients:read",
      "assignments:read",
      "schedules:read",
      "lines:read",
      "equipments:read",
      "notifications:read",
      "notifications:update",
      "notifications:delete",
      "dashboard:view",
    ],
  },
} as const satisfies Record<SeedRoleCode, SeedRoleDef>;

/**
 * Validate a grant list against the catalog, failing fast on typos.
 *
 * Separated from `resolveSeedGrants` so tests can prove the throw without a
 * seed role carrying a bad grant (which `tsc` would already reject).
 */
export function validateGrants(
  role: string,
  grants: readonly string[],
): PermissionName[] {
  for (const grant of grants) {
    if (!CATALOG_NAMES.has(grant)) {
      throw new Error(
        `Unknown permission "${grant}" in seed grants for role "${role}". ` +
          "Add it to PERMISSIONS in src/lib/authz/permission-catalog.ts or fix the grant name.",
      );
    }
  }
  return [...grants] as PermissionName[];
}

/**
 * Grants for a seed role, validated against the catalog.
 *
 * The old seed silently skipped unknown names (`if (permission) { … }`), so a
 * typo granted nothing and nobody noticed (H-20). This throws instead — in
 * English, because a missing catalog row is a defect, not an operator decision.
 * `tsc` also checks the table above via `PermissionName`, but the seeds run
 * under `tsx` without typechecking, so the runtime guard is the one that bites.
 */
export function resolveSeedGrants(role: SeedRoleCode): PermissionName[] {
  const grants: readonly string[] =
    role === "ROOT"
      ? PERMISSIONS.map((permission) => permission.name)
      : SEED_ROLES[role].grants;
  return validateGrants(role, grants);
}

// ---------------------------------------------------------------------------
// ROOT_ONLY: required by code, deliberately held by no seed role
// ---------------------------------------------------------------------------

/**
 * Permissions the code requires that no non-superuser seed role holds.
 *
 * Two families share this list, and the comments say which is which:
 *
 * - Deliberately ROOT-only: user/role/permission administration. Only ROOT
 *   opens those screens, so nobody else needs them.
 * - H-06 debt: the code requires them but the seed never granted them
 *   (cancel/close, reopen, states, settings, notification channels,
 *   lookup-catalog writes). Each is reachable only as ROOT today. Fase 0d
 *   moves these into seed roles (needs user decision #2); when it does, the
 *   reachability test below forces them OUT of this list — it fails if a
 *   listed permission gains a non-superuser holder.
 */
export const ROOT_ONLY: readonly PermissionName[] = [
  // User/role/permission administration (deliberately ROOT-only).
  "users:create",
  "users:update",
  "users:delete",
  "roles:read",
  "roles:create",
  "roles:update",
  "roles:delete",
  "permissions:read",
  "permissions:manage",
  // H-06 debt: terminal incident actions (closeIncident is dead code, see
  // decision #3 in the maintainability plan).
  "incidents:cancel",
  "incidents:close",
  "assignments:reopen",
  // H-06 debt: the states screen the operations admin opens but cannot use.
  "states:read",
  "states:create",
  "states:update",
  "states:delete",
  // H-06 debt: accrual rules and the notification channel matrix require
  // settings:*, which no module admin holds.
  "settings:read",
  "settings:create",
  "settings:update",
  "settings:delete",
  "notifications:configure",
  // Lookup-catalog writes, currently ROOT-only (review alongside H-06 in 0d).
  "user-status:read",
  "user-status:create",
  "user-status:update",
  "user-status:delete",
  "incident-types:create",
  "incident-types:update",
  "incident-types:delete",
  "incident-status:create",
  "incident-status:update",
  "incident-status:delete",
  "assignment-status:create",
  "assignment-status:update",
  "assignment-status:delete",
];

// ---------------------------------------------------------------------------
// ROUTE_REQUIRES: route → action coherence
// ---------------------------------------------------------------------------

/**
 * Action permissions the screens behind each route permission require.
 *
 * Explicit table rather than a page→action static scan: pages are Server
 * Components that call actions (or client components behind them), so import
 * graphs over-approximate and rot silently. Each entry was verified against
 * the page code and the actions it calls; the catalog test enforces that
 * every role holding the route also holds the actions — the H-06 pattern
 * ("can open the screen, cannot use it") fails the build instead of the
 * operator. Dead actions with zero references (`incidents:close`,
 * `assignments:reopen`) stay OUT until decision #3 wires or deletes them.
 *
 * Routes gated by `requireRouteAccess` alone (`route:inicio`, `route:guest`,
 * `route:admin-panel`) carry no entry: there is no action to cohere with.
 */
export const ROUTE_REQUIRES: Record<string, readonly PermissionName[]> = {
  "route:admin-tracking": ["tracking:read", "tracking:update"],
  "route:admin-incidents": [
    "incidents:read",
    "incidents:create",
    "incidents:update",
    "incidents:delete",
    "incidents:cancel",
    "assignments:read",
    "assignments:update",
  ],
  "route:admin-schedules": [
    "schedules:read",
    "schedules:create",
    "schedules:update",
    "schedules:delete",
  ],
  "route:admin-assignments": [
    "assignments:read",
    "assignments:create",
    "assignments:update",
    "assignments:delete",
    "assignments:complete",
  ],
  "route:admin-assignment-activities": [
    "assignments:read",
    "assignments:update",
  ],
  "route:admin-reports": ["reports:view", "reports:export", "clients:read"],
  "route:admin-organization": [
    "clients:read",
    "clients:create",
    "clients:update",
    "clients:delete",
    "users:read",
  ],
  "route:admin-lines": [
    "lines:read",
    "lines:create",
    "lines:update",
    "lines:delete",
  ],
  "route:admin-equipments": [
    "equipments:read",
    "equipments:create",
    "equipments:update",
    "equipments:delete",
  ],
  "route:admin-vehicles": [
    "vehicles:read",
    "vehicles:create",
    "vehicles:update",
    "vehicles:delete",
  ],
  "route:admin-states": [
    "states:read",
    "states:create",
    "states:update",
    "states:delete",
  ],
  "route:admin-users": [
    "users:read",
    "users:create",
    "users:update",
    "users:delete",
  ],
  "route:admin-roles": [
    "roles:read",
    "roles:create",
    "roles:update",
    "roles:delete",
    "permissions:read",
  ],
  "route:admin-vacations": [
    "vacations:read",
    "vacations:approve",
    "vacations:manage",
  ],
  "route:admin-vacation-accrual": [
    "settings:read",
    "settings:create",
    "settings:update",
    "settings:delete",
  ],
  "route:admin-programacion": ["clients:read", "schedules:read"],
  "holidays:read": [
    "holidays:read",
    "holidays:create",
    "holidays:update",
    "holidays:delete",
  ],
  "notifications:configure": ["notifications:configure"],
  "route:fsr": [
    "incidents:read",
    "incidents:update",
    "assignments:read",
    "assignments:update",
    "assignments:complete",
    "vehicle-trips:read",
    "vehicle-trips:create",
    "vehicle-trips:update",
    "vehicle-trips:delete",
    "schedules:read",
  ],
  "route:reporter": [
    "incidents:read",
    "incidents:create",
    "assignments:read",
    "lines:read",
    "equipments:read",
    "clients:read",
    "incident-types:read",
    "incident-status:read",
    "schedules:read",
  ],
  "route:vacations": ["vacations:read", "vacations:create", "vacations:delete"],
  "route:notifications": ["notifications:read"],
};

export type KnownRouteGap = {
  readonly route: PermissionName;
  readonly role: SeedRoleCode;
  readonly missing: readonly PermissionName[];
  readonly ref: string;
};

/**
 * Coherence gaps that exist TODAY, listed explicitly instead of hidden.
 *
 * Same allowlist philosophy as the access contract: each entry must still be
 * genuinely missing, so granting the permission (Fase 0d) FAILS the test and
 * forces the entry out. A gap that stops being a gap cannot linger.
 */
export const KNOWN_ROUTE_GAPS: readonly KnownRouteGap[] = [
  {
    route: "route:admin-states",
    role: "ADMIN_OPERACION",
    missing: ["states:read", "states:create", "states:update", "states:delete"],
    ref: "H-06: getStatesAdmin and the lookups catalog writes require states:*; grant in Fase 0d.",
  },
  {
    route: "route:admin-vacation-accrual",
    role: "ADMIN_VACACIONES",
    missing: [
      "settings:read",
      "settings:create",
      "settings:update",
      "settings:delete",
    ],
    ref: "H-06: the accrual page requires requireRouteAccess('/admin/settings') plus settings:*; Fase 0d switches the actions to vacations:manage.",
  },
  {
    route: "route:admin-incidents",
    role: "ADMIN_OPERACION",
    missing: ["incidents:cancel"],
    ref: "H-06: CancelIncidentButton renders without a canPerform gate and cancelIncident requires incidents:cancel; grant and gate in Fase 0d.",
  },
];
