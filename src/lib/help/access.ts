import {
  type UserAuthz,
  userCanAccessRoute,
  userHasAllPermissions,
} from "@/lib/authz/authz";
import type { PermissionName } from "@/lib/authz/permission-catalog";
import { canAccessRoute } from "@/lib/authz/route-access";

interface HelpRequirements {
  permissions: PermissionName[];
  routes?: string[];
  /** These workflows include detail/new pages, not just an exact list route. */
  routePrefixes?: string[];
}

interface HelpDefinition {
  slug: string;
  requires: HelpRequirements;
  sections?: { title: string; requires: HelpRequirements }[];
}

// Requirements follow the documented workflows, never editable role names.
export const HELP_GUIDES: HelpDefinition[] = [
  {
    slug: "reportar-incidente",
    requires: {
      permissions: [
        "incidents:read",
        "incidents:create",
        "incident-types:read",
        "lines:read",
        "equipments:read",
      ],
      routePrefixes: ["/reporter"],
    },
  },
  {
    slug: "programar-trabajo",
    requires: {
      permissions: ["assignments:read", "assignments:create"],
      routes: ["/admin", "/admin/assignments", "/admin/assignments/new"],
    },
    sections: [
      {
        title: "Programación y asignaciones",
        requires: {
          permissions: ["schedules:read", "clients:read"],
          routes: ["/admin", "/admin/schedules", "/admin/programacion"],
        },
      },
    ],
  },
  {
    slug: "cerrar-asignacion",
    requires: {
      permissions: [
        "assignments:read",
        "assignments:update",
        "assignments:complete",
      ],
      routes: ["/fsr"],
      routePrefixes: ["/fsr/assignments"],
    },
  },
  {
    slug: "registrar-viaje",
    requires: {
      permissions: [
        "vehicle-trips:read",
        "vehicle-trips:create",
        "vehicle-trips:update",
        "vehicles:read",
      ],
      routes: ["/fsr"],
      routePrefixes: ["/fsr/vehicle-trips"],
    },
  },
  {
    slug: "solicitar-vacaciones",
    requires: {
      permissions: ["vacations:read", "vacations:create"],
      routes: ["/vacations", "/vacations/new"],
    },
  },
];

export function meetsHelpRequirements(
  user: UserAuthz,
  requires: HelpRequirements,
) {
  return (
    userHasAllPermissions(user, requires.permissions) &&
    (requires.routes ?? []).every((path) => userCanAccessRoute(user, path)) &&
    (requires.routePrefixes ?? []).every((path) =>
      canAccessRoute(
        { prefixes: user.routeGrants.prefixes },
        user.isSuperuser,
        path,
      ),
    )
  );
}

export function canReadHelpGuide(user: UserAuthz, slug: string) {
  const definition = HELP_GUIDES.find((guide) => guide.slug === slug);
  return Boolean(
    definition && meetsHelpRequirements(user, definition.requires),
  );
}
