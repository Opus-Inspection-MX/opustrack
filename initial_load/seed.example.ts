// prisma/seed.ts

import { SEED_ROLE_CODES } from "../src/lib/authz/roles";
import {
  SYSTEM_ASSIGNMENT_STATUSES,
  SYSTEM_INCIDENT_STATUSES,
  SYSTEM_USER_STATUSES,
  SYSTEM_VACATION_STATUSES,
  SYSTEM_VEHICLE_STATUSES,
  SYSTEM_VEHICLE_TRIP_STATUSES,
} from "../src/lib/catalog/system-states";
import { prisma } from "../src/lib/database/prisma.singleton";
import { defaultChannelPolicies } from "../src/lib/notifications/catalog";
import { hashPassword } from "../src/lib/security/hash";

async function main() {
  await prisma.$transaction(
    async (tx) => {
      console.log("🌱 Starting database seed...");

      // 1) UserStatus — system list lives in catalog/system-states.ts (Fase 3).
      // `code` is the stable identity; `name` stays an editable label.
      const userStatusRecords = [];
      for (const name of SYSTEM_USER_STATUSES) {
        userStatusRecords.push(
          await tx.userStatus.upsert({
            where: { name },
            update: { code: name },
            create: { name, code: name },
          }),
        );
      }
      const userStatusActivo = userStatusRecords.find(
        (u) => u.name === "ACTIVO",
      );
      if (!userStatusActivo) throw new Error("UserStatus ACTIVO not found");
      console.log("✅ Seeded UserStatuses");

      // 1c) EquipmentStatus
      const equipmentStatuses = ["OPERATIVO", "MANTENIMIENTO", "INACTIVO"];
      for (const name of equipmentStatuses) {
        await tx.equipmentStatus.upsert({
          where: { name },
          update: {},
          create: { name },
        });
      }
      console.log("✅ Seeded EquipmentStatuses");

      // 1d) VehicleStatus — codes from catalog/system-states.ts (Fase 3).
      for (const name of SYSTEM_VEHICLE_STATUSES) {
        await tx.vehicleStatus.upsert({
          where: { name },
          update: { code: name },
          create: { name, code: name },
        });
      }
      console.log("✅ Seeded VehicleStatuses");

      // 1e) VehicleTripStatus — codes from catalog/system-states.ts (Fase 3).
      for (const name of SYSTEM_VEHICLE_TRIP_STATUSES) {
        await tx.vehicleTripStatus.upsert({
          where: { name },
          update: { code: name },
          create: { name, code: name },
        });
      }
      console.log("✅ Seeded VehicleTripStatuses");

      // 2) States - all 32 Mexican states
      const mexicanStates: Array<{ name: string; code: string }> = [
        { name: "Aguascalientes", code: "AGU" },
        { name: "Baja California", code: "BCN" },
        { name: "Baja California Sur", code: "BCS" },
        { name: "Campeche", code: "CAM" },
        { name: "Coahuila", code: "COA" },
        { name: "Colima", code: "COL" },
        { name: "Chiapas", code: "CHP" },
        { name: "Chihuahua", code: "CHH" },
        { name: "Ciudad de México", code: "CDMX" },
        { name: "Durango", code: "DUR" },
        { name: "Guanajuato", code: "GUA" },
        { name: "Guerrero", code: "GRO" },
        { name: "Hidalgo", code: "HID" },
        { name: "Jalisco", code: "JAL" },
        { name: "México", code: "MEX" },
        { name: "Michoacán", code: "MIC" },
        { name: "Morelos", code: "MOR" },
        { name: "Nayarit", code: "NAY" },
        { name: "Nuevo León", code: "NLE" },
        { name: "Oaxaca", code: "OAX" },
        { name: "Puebla", code: "PUE" },
        { name: "Querétaro", code: "QUE" },
        { name: "Quintana Roo", code: "ROO" },
        { name: "San Luis Potosí", code: "SLP" },
        { name: "Sinaloa", code: "SIN" },
        { name: "Sonora", code: "SON" },
        { name: "Tabasco", code: "TAB" },
        { name: "Tamaulipas", code: "TAM" },
        { name: "Tlaxcala", code: "TLA" },
        { name: "Veracruz", code: "VER" },
        { name: "Yucatán", code: "YUC" },
        { name: "Zacatecas", code: "ZAC" },
      ];
      const stateByCode = new Map<string, { id: number }>();
      for (const s of mexicanStates) {
        const rec = await tx.state.upsert({
          where: { code: s.code },
          update: { name: s.name },
          create: s,
        });
        stateByCode.set(s.code, rec);
      }
      const cdmx = stateByCode.get("CDMX");
      const puebla = stateByCode.get("PUE");
      if (!cdmx || !puebla) throw new Error("Estados base no encontrados");
      console.log("✅ Seeded States (32)");

      // 3) Clients
      // "SIN CENTRO": placeholder usado SOLO como fallback visual; los incidentes
      // sin client dejan clientId = null (no se asignan a este registro).
      await tx.client.upsert({
        where: { code: "SIN-CENTRO" },
        update: { name: "SIN CENTRO" },
        create: {
          code: "SIN-CENTRO",
          name: "SIN CENTRO",
          companyName: "OpusInspection",
          stateId: cdmx.id,
        },
      });

      const clientByCode = new Map<string, { id: string }>();
      // PUEBLA: CVV01..CVV09
      for (let n = 1; n <= 9; n++) {
        const code = `CVV0${n}`;
        const rec = await tx.client.upsert({
          where: { code },
          update: {},
          create: {
            code,
            name: `Centro de Verificación Puebla ${code}`,
            companyName: "OpusInspection Puebla",
            stateId: puebla.id,
          },
        });
        clientByCode.set(code, rec);
      }
      // CDMX: IZ59, IT48, TH61
      for (const code of ["IZ59", "IT48", "TH61"]) {
        const rec = await tx.client.upsert({
          where: { code },
          update: {},
          create: {
            code,
            name: `Centro de Verificación CDMX ${code}`,
            companyName: "OpusInspection CDMX",
            stateId: cdmx.id,
          },
        });
        clientByCode.set(code, rec);
      }
      // Test users below are related to these CDMX clients.
      const civ = clientByCode.get("IZ59");
      const civ2 = clientByCode.get("IT48");
      const civ3 = clientByCode.get("TH61");
      if (!civ || !civ2 || !civ3) throw new Error("Clientes base no creados");
      console.log(
        "✅ Seeded Clientes (SIN CENTRO, PUEBLA CVV01-09, CDMX IZ59/IT48/TH61)",
      );

      // 4) Permissions - Comprehensive database-driven permissions
      const permissionsData = [
        // Route-based permissions
        {
          name: "route:inicio",
          description: "Pantalla inicial personalizada",
          routePath: "/inicio",
        },
        {
          name: "route:admin",
          description:
            "TODO el panel de administración (prefijo /admin). Para dar solo la página de inicio usa route:admin-panel",
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
        // Self-service vacations. Granted to every staff role — a REPORTER is a
        // center account, not a person with vacation days. GUEST is read-only
        // (no create permissions, no balance) and is excluded too.
        {
          name: "route:vacations",
          description: "Acceso a mis vacaciones",
          routePath: "/vacations",
        },
        // Universal inbox. Every role holds it, so the menu entry and the
        // page behind it agree for staff, centers and read-only accounts alike.
        {
          name: "route:notifications",
          description: "Acceso a mis notificaciones",
          routePath: "/notifications",
        },
        // The `/admin` landing page WITHOUT the rest of the panel.
        // Prefix coverage would turn this into "every admin screen", which is
        // exactly what a module administrator must not get.
        {
          name: "route:admin-panel",
          description: "Panel de inicio de administración",
          routePath: "/admin",
          exact: true,
        },
        // Fine-grained admin routes, so ADMIN_OPERACION and ADMIN_VACACIONES
        // can be granted their own module and nothing else.
        {
          name: "route:admin-tracking",
          description: "Seguimiento de atención",
          routePath: "/admin/tracking",
        },
        {
          name: "route:admin-incidents",
          description: "Administración de incidentes",
          routePath: "/admin/incidents",
        },
        {
          name: "route:admin-programacion",
          description: "Asignación de programación",
          routePath: "/admin/programacion",
        },
        {
          name: "route:admin-schedules",
          description: "Programación",
          routePath: "/admin/schedules",
        },
        {
          name: "route:admin-assignments",
          description: "Asignaciones",
          routePath: "/admin/assignments",
        },
        {
          name: "route:admin-assignment-activities",
          description: "Actividades de trabajo",
          routePath: "/admin/assignment-activities",
        },
        {
          name: "route:admin-reports",
          description: "Reportes",
          routePath: "/admin/reports",
        },
        {
          name: "route:admin-organization",
          description: "Organización: clientes, líneas, equipos, estados",
          routePath: "/admin/clients",
        },
        {
          name: "route:admin-lines",
          description: "Líneas",
          routePath: "/admin/lines",
        },
        {
          name: "route:admin-equipments",
          description: "Equipos",
          routePath: "/admin/equipments",
        },
        {
          name: "route:admin-states",
          description: "Estados",
          routePath: "/admin/states",
        },
        {
          name: "route:admin-vehicles",
          description: "Vehículos",
          routePath: "/admin/vehicles",
        },
        {
          name: "route:admin-users",
          description: "Administración de usuarios",
          routePath: "/admin/users",
        },
        {
          name: "route:admin-roles",
          description: "Administración de roles",
          routePath: "/admin/roles",
        },
        {
          name: "route:admin-permissions",
          description: "Administración de permisos",
          routePath: "/admin/permissions",
        },
        {
          name: "route:admin-vacations",
          description: "Administración de vacaciones",
          routePath: "/admin/vacations",
        },
        // Its own permission, NOT `settings:read`: that one carries
        // /admin/settings and would drag in every status catalog beside it.
        {
          name: "route:admin-vacation-accrual",
          description: "Reglas de acumulación de vacaciones",
          routePath: "/admin/settings/vacation-accrual",
        },
        {
          name: "route:admin-notifications",
          description:
            "Notificaciones (obsoleto: lo reemplazan notifications:broadcast y route:notifications)",
          routePath: "/admin/notifications",
        },

        // Broadcasting is a separate capability from reading: without it any
        // authenticated user could diffuse to everyone (Phase 1 fix).
        {
          name: "notifications:broadcast",
          description: "Difundir notificaciones a roles",
          resource: "notifications",
          action: "broadcast",
          routePath: "/admin/notifications",
        },
        // The channel matrix (Phase 2 screen) is admin-only.
        {
          name: "notifications:configure",
          description: "Configurar canales de notificación",
          resource: "notifications",
          action: "configure",
          routePath: "/admin/settings/notifications",
        },

        // Capabilities that the role name ADMINISTRADOR used to imply.
        {
          name: "scope:all-clients",
          description: "Ver datos de todos los Clientes, no solo los asignados",
          resource: "scope",
          action: "all-clients",
        },
        {
          name: "assignments:manage-all",
          description: "Modificar asignaciones de las que no se es FSR",
          resource: "assignments",
          action: "manage-all",
        },
        {
          name: "vehicle-trips:manage-all",
          description: "Modificar viajes de vehículo de otros FSR",
          resource: "vehicle-trips",
          action: "manage-all",
        },

        // Incident permissions
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

        // User management permissions
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

        // Role management permissions
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

        // Permission management
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

        // Assignment permissions
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

        // Assignment activity permissions
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

        // Work part permissions

        // Parts/Inventory permissions

        // Client management permissions
        {
          name: "clients:read",
          description: "View Clients",
          resource: "clients",
          action: "read",
        },
        {
          name: "clients:create",
          description: "Create Clients",
          resource: "clients",
          action: "create",
        },
        {
          name: "clients:update",
          description: "Update Clients",
          resource: "clients",
          action: "update",
        },
        {
          name: "clients:delete",
          description: "Delete Clients",
          resource: "clients",
          action: "delete",
        },

        // Schedule permissions
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

        // Reports permissions
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

        // State permissions (administrative data)
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

        // User Status permissions (lookup data)
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

        // Incident Type permissions (lookup data)
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

        // Incident Status permissions (lookup data)
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

        // Settings permissions (lookup data management)
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

        // Vehicle management permissions (Admin)
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

        // Vehicle trip permissions (FSR)
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
        // Lines permissions
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
        // Tracking permissions
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

        // Notification permissions
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

        // Dashboard permission
        {
          name: "dashboard:view",
          description: "View dashboard",
          resource: "dashboard",
          action: "read",
        },

        // Assignment Status permissions (lookup data)
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

        // Equipments permissions
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

        // Holiday management permissions (RF-700, RF-706)
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

        // Vacation management permissions (RF-701, RF-702, RF-706)
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
          // Separate from `approve` on purpose: approving decides one request,
          // while managing changes how many days a whole period is worth.
          name: "vacations:manage",
          description: "Set hire dates and override vacation day balances",
          resource: "vacations",
          action: "manage",
        },
      ];

      const permissionRecords = [];
      for (const perm of permissionsData) {
        permissionRecords.push(
          await tx.permission.upsert({
            where: { name: perm.name },
            update: {
              description: perm.description,
              resource: perm.resource || null,
              action: perm.action || null,
              routePath: perm.routePath || null,
              exact: perm.exact ?? false,
            },
            create: { ...perm, exact: perm.exact ?? false },
          }),
        );
      }
      console.log("✅ Seeded Permissions");

      // 5) Roles with permissions
      // Vacations every staff role administers for itself. A REPORTER is a
      // center account shared by whoever is on shift, not a person with days.
      const SELF_SERVICE_VACATIONS = [
        "route:vacations",
        "vacations:read",
        "vacations:create",
        "vacations:delete",
      ];

      // Universal home: every role lands on /inicio and reaches the inbox
      // and its profile from there. Spread into all seven seed roles.
      const UNIVERSAL_ROUTES = [
        "route:inicio",
        "route:notifications",
        "route:profile",
      ];

      const OPERATIONS_ROUTES = [
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
        // Reach the broadcast page through notifications:broadcast
        // (routePath /admin/notifications covers it by prefix), not through
        // the deactivated route:admin-notifications.
      ];

      const rolesData = [
        {
          name: "ROOT",
          description:
            "Superusuario: administra catálogos, roles, permisos y usuarios",
          defaultPath: "/inicio",
          isSuperuser: true,
          priority: 100,
          permissions: [
            // Everything. `isSuperuser` already bypasses each check; the rows
            // are seeded anyway so the admin UI shows ROOT holding them.
            ...permissionRecords.map((p) => p.name),
          ],
        },
        {
          name: "ADMIN_OPERACION",
          description:
            "Administra incidentes, programación, asignaciones y organización",
          defaultPath: "/inicio",
          priority: 80,
          permissions: [
            ...OPERATIONS_ROUTES,
            ...UNIVERSAL_ROUTES,
            // Diffuses to FSR / REPORTER / GUEST / ADMIN_OPERACION (targets
            // seeded in RoleBroadcastTarget below).
            "notifications:broadcast",
            ...SELF_SERVICE_VACATIONS,
            // Sees every center without being able to grant roles: this is the
            // half of the old ADMINISTRADOR that is about DATA, not power.
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
            // Reads users to pick an FSR; cannot create or edit them.
            "users:read",
            "reports:view",
            "reports:export",
            // Owns the tracking queue: every tracking action gates on
            // tracking:read/update, so without these the role's own landing
            // (/admin/tracking) denies access (Fase 3 · 3.0.1).
            "tracking:read",
            "tracking:update",
            "notifications:read",
            "notifications:update",
            "notifications:delete",
            "dashboard:view",
          ],
        },
        {
          name: "ADMIN_VACACIONES",
          description: "Administra las vacaciones de todo el personal",
          defaultPath: "/inicio",
          priority: 70,
          permissions: [
            "route:admin-panel",
            "route:admin-vacations",
            ...UNIVERSAL_ROUTES,
            // Diffuses to EMPLEADO / FSR / ADMIN_OPERACION / ADMIN_VACACIONES
            // (targets seeded in RoleBroadcastTarget below).
            "notifications:broadcast",
            ...SELF_SERVICE_VACATIONS,
            // Approving and configuring other people's vacations.
            "vacations:approve",
            "vacations:manage",
            // Holidays and accrual rules ARE vacation administration: a day off
            // that lands on a holiday is not charged, and the rules decide how
            // many days each period grants. Without these the role can approve
            // requests but not maintain what the balances are computed from.
            // `holidays:read` carries routePath /admin/holidays.
            "holidays:read",
            "holidays:create",
            "holidays:update",
            "holidays:delete",
            "route:admin-vacation-accrual",
            // Needs the roster to know whose days these are. Read only: user
            // administration stays with ROOT.
            "users:read",
            "notifications:read",
            "notifications:update",
            "notifications:delete",
            "dashboard:view",
          ],
        },
        {
          name: "FSR",
          description:
            "Field Service Representative - System user with management capabilities",
          defaultPath: "/inicio",
          priority: 50,
          permissions: [
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
        {
          name: "EMPLEADO",
          description:
            "Personal de oficina: solo su perfil y sus propias vacaciones",
          defaultPath: "/inicio",
          priority: 30,
          permissions: [
            ...UNIVERSAL_ROUTES,
            ...SELF_SERVICE_VACATIONS,
            "notifications:read",
            "notifications:update",
            "notifications:delete",
          ],
        },
        {
          name: "REPORTER",
          description: "Reporter user - Raises incidents from Client",
          defaultPath: "/inicio",
          priority: 10,
          permissions: [
            "route:reporter",
            ...UNIVERSAL_ROUTES,
            "incidents:read",
            "incidents:create",
            "incident-types:read", // Needed to select incident type when creating
            "incident-status:read", // Needed to view incident status
            "clients:read", // Needed to select Client when creating incidents
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
        {
          name: "GUEST",
          description: "Guest user - Read-only access (no create permissions)",
          defaultPath: "/inicio",
          priority: 20,
          permissions: [
            "route:guest",
            ...UNIVERSAL_ROUTES,
            // No SELF_SERVICE_VACATIONS: a read-only account holds no balance.
            // (Re-seeding never REMOVES grants — the Phase 1 data migration
            // deactivates the four vacation rows on existing databases.)
            "incidents:read",
            "incident-types:read", // Needed to view incident types
            "incident-status:read", // Needed to view incident status
            "clients:read", // Needed to view Clients
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
      ];

      const roleRecords = [];
      for (const roleData of rolesData) {
        // `code` is the stable identity (Fase 3, H-09); `name` stays an
        // editable label. Every seed role carries code == its original name.
        const roleCode = SEED_ROLE_CODES.includes(
          roleData.name as (typeof SEED_ROLE_CODES)[number],
        )
          ? roleData.name
          : null;
        const role = await tx.role.upsert({
          where: { name: roleData.name },
          update: {
            description: roleData.description,
            defaultPath: roleData.defaultPath,
            isSuperuser: roleData.isSuperuser ?? false,
            priority: roleData.priority ?? 0,
            ...(roleCode ? { code: roleCode } : {}),
          },
          create: {
            name: roleData.name,
            code: roleCode,
            description: roleData.description,
            defaultPath: roleData.defaultPath,
            isSuperuser: roleData.isSuperuser ?? false,
            priority: roleData.priority ?? 0,
          },
        });
        roleRecords.push(role);

        // Assign permissions to role
        for (const permName of roleData.permissions) {
          const permission = permissionRecords.find((p) => p.name === permName);
          if (permission) {
            await tx.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: permission.id,
                },
              },
              update: {},
              create: { roleId: role.id, permissionId: permission.id },
            });
          }
        }
      }
      console.log("✅ Seeded Roles with Permissions");

      // 5b) RoleBroadcastTarget — which roles each sender role may diffuse to.
      // A sender with no rows reaches nobody (fail closed); ROOT bypasses the
      // table. Mirrors the Phase 1 data migration so fresh databases (where the
      // migration ran before any role existed) converge to the same rows.
      const BROADCAST_TARGETS: Array<[string, string]> = [
        ["ADMIN_OPERACION", "FSR"],
        ["ADMIN_OPERACION", "REPORTER"],
        ["ADMIN_OPERACION", "GUEST"],
        ["ADMIN_OPERACION", "ADMIN_OPERACION"],
        ["ADMIN_VACACIONES", "EMPLEADO"],
        ["ADMIN_VACACIONES", "FSR"],
        ["ADMIN_VACACIONES", "ADMIN_OPERACION"],
        ["ADMIN_VACACIONES", "ADMIN_VACACIONES"],
      ];
      for (const [sourceName, targetName] of BROADCAST_TARGETS) {
        const source = roleRecords.find((r) => r.name === sourceName);
        const target = roleRecords.find((r) => r.name === targetName);
        if (!source || !target) continue;
        await tx.roleBroadcastTarget.upsert({
          where: {
            sourceRoleId_targetRoleId: {
              sourceRoleId: source.id,
              targetRoleId: target.id,
            },
          },
          update: { active: true },
          create: { sourceRoleId: source.id, targetRoleId: target.id },
        });
      }
      console.log("✅ Seeded RoleBroadcastTarget");

      // 6) Users - 3 per role for testing. FSR/REPORTER users are related to a
      // Client (one pair per Client). ADMIN and GUEST are not tied to any Client.
      const usersData: Array<{
        name: string;
        email: string;
        roleName: string;
        clientId: string | null;
      }> = [
        // ROOT (no Client)
        {
          name: "Admin User",
          email: "admin@opusinspection.com",
          roleName: "ROOT",
          clientId: null,
        },
        {
          name: "Admin User 2",
          email: "admin2@opusinspection.com",
          roleName: "ROOT",
          clientId: null,
        },
        {
          name: "Admin User 3",
          email: "admin3@opusinspection.com",
          roleName: "ROOT",
          clientId: null,
        },
        // FSR (one per Client)
        {
          name: "FSR User",
          email: "fsr@opusinspection.com",
          roleName: "FSR",
          clientId: civ.id,
        },
        {
          name: "FSR User 2",
          email: "fsr2@opusinspection.com",
          roleName: "FSR",
          clientId: civ2.id,
        },
        {
          name: "FSR User 3",
          email: "fsr3@opusinspection.com",
          roleName: "FSR",
          clientId: civ3.id,
        },
        // REPORTER — one generic account per Client, named after the center's
        // code rather than a person: it is shared by everyone working there,
        // and whoever raises an incident types their own name into it.
        {
          name: "IZ59",
          email: "reporter@opusinspection.com",
          roleName: "REPORTER",
          clientId: civ.id,
        },
        {
          name: "IT48",
          email: "reporter2@opusinspection.com",
          roleName: "REPORTER",
          clientId: civ2.id,
        },
        {
          name: "TH61",
          email: "reporter3@opusinspection.com",
          roleName: "REPORTER",
          clientId: civ3.id,
        },
        // GUEST (read-only, no Client)
        {
          name: "Guest User",
          email: "guest@opusinspection.com",
          roleName: "GUEST",
          clientId: null,
        },
        {
          name: "Guest User 2",
          email: "guest2@opusinspection.com",
          roleName: "GUEST",
          clientId: null,
        },
        {
          name: "Guest User 3",
          email: "guest3@opusinspection.com",
          roleName: "GUEST",
          clientId: null,
        },
        // EMPLEADO (office staff, no Client — self-service vacations only)
        {
          name: "Empleado User",
          email: "empleado@opusinspection.com",
          roleName: "EMPLEADO",
          clientId: null,
        },
        {
          name: "Empleado User 2",
          email: "empleado2@opusinspection.com",
          roleName: "EMPLEADO",
          clientId: null,
        },
        {
          name: "Empleado User 3",
          email: "empleado3@opusinspection.com",
          roleName: "EMPLEADO",
          clientId: null,
        },
        // Module admins (no Client — scope comes from their permissions)
        {
          name: "Admin Operacion",
          email: "admin-operacion@opusinspection.com",
          roleName: "ADMIN_OPERACION",
          clientId: null,
        },
        {
          name: "Admin Vacaciones",
          email: "admin-vacaciones@opusinspection.com",
          roleName: "ADMIN_VACACIONES",
          clientId: null,
        },
      ];

      for (const userData of usersData) {
        const role = roleRecords.find((r) => r.name === userData.roleName);
        if (!role) continue;

        const user = await tx.user.upsert({
          where: { email: userData.email },
          update: {},
          create: {
            name: userData.name,
            email: userData.email,
            password: await hashPassword("password123"),
            userRoles: { create: [{ roleId: role.id }] },
            userStatusId: userStatusActivo.id,
          },
        });

        // Create user profile
        await tx.userProfile.upsert({
          where: { userId: user.id },
          update: {},
          create: {
            userId: user.id,
            telephone: "555-000-0000",
            emergencyContact: "Emergency Contact",
            jobPosition: userData.roleName,
          },
        });

        // Create Client assignment if user has a Client
        if (userData.clientId) {
          await tx.userClientAssignment.upsert({
            where: {
              userId_clientId: {
                userId: user.id,
                clientId: userData.clientId,
              },
            },
            update: { isPrimary: true, active: true },
            create: {
              userId: user.id,
              clientId: userData.clientId,
              isPrimary: true,
            },
          });
        }
      }
      console.log("✅ Seeded Users with Profiles and Cliente Assignments");

      // 7) IncidentTypes.
      // El tipo "Desconocido" es del sistema — se usa como fallback cuando un
      // incidente se crea sin tipo. NO debe eliminarse (deleteIncidentType lo
      // blinda por nombre).
      // Priority scale: 1–10. Critical threshold: >= 8. Values are intentional
      // and override the DB default of 5 — do not remove priority from upserts.
      const incidentTypes: Array<{
        name: string;
        description: string;
        priority: number;
      }> = [
        {
          name: "Desconocido",
          description:
            "Tipo por defecto cuando no se clasifica. NO eliminar — usado como fallback del sistema.",
          priority: 3, // Explicit: unclassified stays out of critical count
        },
        {
          name: "Falla Eléctrica",
          description: "Cortocircuitos, fallas de tablero, iluminación",
          priority: 8, // Critical — electrical failures stop operations
        },
        {
          name: "Falla Mecánica",
          description: "Equipos hidráulicos, neumáticos, ejes",
          priority: 7,
        },
        {
          name: "Falla de Software",
          description: "Sistema de inspección, base de datos, integraciones",
          priority: 8, // Critical — software failure blocks all inspections
        },
        {
          name: "Falla de Cámaras",
          description: "Cámaras de inspección OCR, lectores de placa",
          priority: 6,
        },
        {
          name: "Falla de Báscula",
          description: "Sistema de pesaje",
          priority: 8, // Critical — weight system required for certification
        },
        {
          name: "Falla de Diagnóstico",
          description: "Equipos de gases, frenómetro, alineadora",
          priority: 8, // Critical — diagnostic equipment required for certification
        },
        {
          name: "Falla de Red",
          description: "Conectividad, switches, WiFi",
          priority: 7,
        },
        {
          name: "Mantenimiento Preventivo",
          description: "Mantenimiento programado",
          priority: 4,
        },
        {
          name: "Mantenimiento Correctivo",
          description: "Reparación tras falla",
          priority: 6,
        },
        {
          name: "Calibración",
          description: "Ajuste y calibración de equipos",
          priority: 5,
        },
        {
          name: "Limpieza / Acondicionamiento",
          description: "Higiene, orden, acondicionamiento del Cliente",
          priority: 2,
        },
        {
          name: "Suministro",
          description: "Faltante de consumibles o refacciones",
          priority: 4,
        },
        // MANTENIMIENTO — tipo genérico y subtipos operativos.
        {
          name: "MANTENIMIENTO",
          description: "Mantenimiento general del centro de inspección",
          priority: 4,
        },
        {
          name: "Mantenimiento Predictivo",
          description: "Monitoreo de condición para anticipar fallas",
          priority: 4,
        },
        {
          name: "Mantenimiento de Equipos de Diagnóstico",
          description:
            "Analizador de gases, frenómetro, alineadora, suspensión",
          priority: 7,
        },
        {
          name: "Mantenimiento de Báscula",
          description: "Sistema de pesaje y celdas de carga",
          priority: 6,
        },
        {
          name: "Mantenimiento de Cámaras / OCR",
          description: "Cámaras de inspección, lectores de placa OCR",
          priority: 6,
        },
        {
          name: "Mantenimiento de Red / IT",
          description: "Switches, cableado, servidores, conectividad",
          priority: 5,
        },
        {
          name: "Mantenimiento de Infraestructura",
          description: "Instalaciones eléctricas, hidráulicas y de obra civil",
          priority: 5,
        },
      ];
      for (const it of incidentTypes) {
        await tx.incidentType.upsert({
          where: { name: it.name },
          update: {
            description: it.description,
            priority: it.priority,
          },
          create: it,
        });
      }
      console.log("✅ Seeded IncidentTypes");

      // 8) IncidentStatuses — state machine:
      //     ABIERTO → ASIGNADO → VISTO → INICIADO → EN_PROGRESO → CERRADO
      //     (any non-terminal) → CANCELADA (admin terminal action)
      // System list lives in catalog/system-states.ts (Fase 3).
      for (const status of SYSTEM_INCIDENT_STATUSES) {
        await tx.incidentStatus.upsert({
          where: { name: status.code },
          update: { color: status.color, active: true, code: status.code },
          create: { name: status.code, code: status.code, color: status.color },
        });
      }
      console.log("✅ Seeded IncidentStatuses");

      // 8a) AssignmentStatuses — state machine:
      //     PENDIENTE_DE_ASIGNACION → ASIGNADO → VISTO → INICIADO ↔ EN_PROGRESO → CERRADO
      for (const status of SYSTEM_ASSIGNMENT_STATUSES) {
        await tx.assignmentStatus.upsert({
          where: { name: status.code },
          update: { color: status.color, active: true, code: status.code },
          create: { name: status.code, code: status.code, color: status.color },
        });
      }

      // Data migration: any existing rows still pointing to the legacy
      // PENDIENTE assignment status are moved to EN_PROGRESO, then the legacy
      // status row is soft-deactivated so future seeds don't reintroduce it.
      // The legacy row carries no code (it predates Fase 3), so this lookup
      // is intentionally by name; EN_PROGRESO resolves by stable code.
      const legacyPendiente = await tx.assignmentStatus.findUnique({
        where: { name: "PENDIENTE" },
        select: { id: true },
      });
      if (legacyPendiente) {
        const enProgreso = await tx.assignmentStatus.findUnique({
          where: { code: "EN_PROGRESO" },
          select: { id: true },
        });
        if (enProgreso) {
          await tx.assignment.updateMany({
            where: { statusId: legacyPendiente.id },
            data: { statusId: enProgreso.id },
          });
        }
        await tx.assignmentStatus.update({
          where: { id: legacyPendiente.id },
          data: { active: false },
        });
      }
      console.log("✅ Seeded AssignmentStatuses");

      // 8b) ScheduleStatuses - Separate from IncidentStatus for semantic clarity
      const scheduleStatuses: Array<{
        name: string;
        description: string;
        color: string;
      }> = [
        {
          name: "BORRADOR",
          description: "Schedule en edición, no confirmado",
          color: "#94A3B8",
        }, // Gray
        {
          name: "CONFIRMADO",
          description: "Schedule confirmado, listo para ejecutar",
          color: "#3B82F6",
        }, // Blue
        {
          name: "EN_CURSO",
          description: "Schedule en ejecución",
          color: "#F59E0B",
        }, // Amber
        {
          name: "COMPLETADO",
          description: "Schedule completado exitosamente",
          color: "#10B981",
        }, // Green
        {
          name: "CANCELADO",
          description: "Schedule cancelado",
          color: "#EF4444",
        }, // Red
        {
          name: "POSPUESTO",
          description: "Schedule pospuesto para otra fecha",
          color: "#8B5CF6",
        }, // Purple
      ];
      for (const status of scheduleStatuses) {
        await tx.scheduleStatus.upsert({
          where: { name: status.name },
          update: { color: status.color, description: status.description },
          create: status,
        });
      }
      console.log("✅ Seeded ScheduleStatuses");

      // 8c) VacationStatus catalog — PENDIENTE / APROBADA / RECHAZADA (RF-707).
      // System list lives in catalog/system-states.ts (Fase 3).
      for (const vs of SYSTEM_VACATION_STATUSES) {
        await tx.vacationStatus.upsert({
          where: { name: vs.code },
          update: {
            color: vs.color,
            description: vs.description,
            code: vs.code,
          },
          create: {
            name: vs.code,
            code: vs.code,
            color: vs.color,
            description: vs.description,
          },
        });
      }
      console.log("✅ Seeded VacationStatuses");

      // 8c-bis) Vacation entitlement by years of service — LFT Art. 76 as
      // amended by the 2023 "Vacaciones Dignas" reform. Seeded as data rather
      // than hardcoded so the table can be corrected from the admin UI if the
      // law changes again. The final tier is open-ended so long-tenured staff
      // always match a rule.
      const accrualRules: Array<{
        minYears: number;
        maxYears: number | null;
        days: number;
      }> = [
        { minYears: 1, maxYears: 1, days: 12 },
        { minYears: 2, maxYears: 2, days: 14 },
        { minYears: 3, maxYears: 3, days: 16 },
        { minYears: 4, maxYears: 4, days: 18 },
        { minYears: 5, maxYears: 5, days: 20 },
        { minYears: 6, maxYears: 10, days: 22 },
        { minYears: 11, maxYears: 15, days: 24 },
        { minYears: 16, maxYears: 20, days: 26 },
        { minYears: 21, maxYears: 25, days: 28 },
        { minYears: 26, maxYears: null, days: 30 },
      ];
      for (const rule of accrualRules) {
        await tx.vacationAccrualRule.upsert({
          where: { minYears: rule.minYears },
          update: { maxYears: rule.maxYears, days: rule.days },
          create: rule,
        });
      }
      console.log(`✅ Seeded VacationAccrualRules (${accrualRules.length})`);

      // 8c-ter) Grace window. The law allows six months past the accrual year
      // to take earned days; the business default here is a full year. Stored
      // as a singleton row so admins can change it without a deploy.
      await tx.vacationSetting.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, graceWindowMonths: 12 },
      });
      console.log("✅ Seeded VacationSetting (grace window)");

      // 8c-quater) Default channel policy, one row per catalog event.
      // The source of truth is the catalog itself, so the seed, the
      // migration and the dispatch can never disagree on the defaults.
      for (const policy of defaultChannelPolicies()) {
        await tx.notificationChannelPolicy.upsert({
          where: { type: policy.type },
          update: {},
          create: policy,
        });
      }
      console.log("✅ Seeded NotificationChannelPolicies");

      // 8d) Holidays — LFT Art. 74 rules (RF-700)
      // Guard: only insert if the table is empty (no natural unique key).
      const holidayCount = await tx.holiday.count();
      if (holidayCount === 0) {
        await tx.holiday.createMany({
          data: [
            // Fixed-date holidays
            {
              name: "Año Nuevo",
              month: 1,
              day: 1,
              isRecurring: true,
            },
            {
              name: "Día del Trabajo",
              month: 5,
              day: 1,
              isRecurring: true,
            },
            {
              name: "Día de la Independencia",
              month: 9,
              day: 16,
              isRecurring: true,
            },
            {
              name: "Navidad",
              month: 12,
              day: 25,
              isRecurring: true,
            },
            // N-th Monday holidays
            {
              name: "Día de la Constitución",
              month: 2,
              nthMonday: 1,
              isRecurring: true,
            },
            {
              name: "Natalicio de Benito Juárez",
              month: 3,
              nthMonday: 3,
              isRecurring: true,
            },
            {
              name: "Día de la Revolución",
              month: 11,
              nthMonday: 3,
              isRecurring: true,
            },
            // One-time sexennial event (next transfer of executive power)
            {
              name: "Transmisión del Poder Ejecutivo",
              month: 10,
              day: 1,
              isRecurring: false,
              year: 2030,
            },
          ],
        });
        console.log("✅ Seeded Holidays (LFT Art. 74 — 8 rules)");
      } else {
        console.log("⏭️  Holidays already seeded, skipping");
      }
    },
    {
      maxWait: 30000, // Maximum time to wait for a transaction slot (30 seconds)
      timeout: 180000, // Maximum time for transaction to complete (3 minutes)
    },
  );

  console.log("🎉 Seed completed successfully!");
  console.log("\n📋 Test Users:");
  console.log(
    "  Admin:  admin@opusinspection.com / password123  (Not related to Cliente)",
  );
  console.log(
    "  FSR:    fsr@opusinspection.com / password123     (Field Service Representative)",
  );
  console.log(
    "  Reporter: reporter@opusinspection.com / password123  (Raises incidents from Client)",
  );
  console.log(
    "  Guest:  guest@opusinspection.com / password123   (Read-only access)",
  );
  console.log(
    "  Empleado: empleado@opusinspection.com / password123 (Office staff, self-service vacations)",
  );
  console.log(
    "  Admin Operación: admin-operacion@opusinspection.com / password123",
  );
  console.log(
    "  Admin Vacaciones: admin-vacaciones@opusinspection.com / password123",
  );
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
