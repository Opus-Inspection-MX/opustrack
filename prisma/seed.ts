// prisma/seed.ts
import { prisma } from "../src/lib/database/prisma.singleton";
import { hashPassword } from "../src/lib/security/hash";

async function main() {
  await prisma.$transaction(
    async (tx) => {
      console.log("🌱 Starting database seed...");

      // 1) UserStatus
      const userStatuses = ["ACTIVO", "INACTIVO", "SUSPENDIDO"];
      const userStatusRecords = [];
      for (const name of userStatuses) {
        userStatusRecords.push(
          await tx.userStatus.upsert({
            where: { name },
            update: {},
            create: { name },
          }),
        );
      }
      const userStatusActivo = userStatusRecords.find(
        (u) => u.name === "ACTIVO",
      );
      if (!userStatusActivo) throw new Error("UserStatus ACTIVO not found");
      console.log("✅ Seeded UserStatuses");

      // 1b) LineStatus
      const lineStatuses = ["ACTIVO", "MANTENIMIENTO", "INACTIVO"];
      for (const name of lineStatuses) {
        await tx.lineStatus.upsert({
          where: { name },
          update: {},
          create: { name },
        });
      }
      console.log("✅ Seeded LineStatuses");

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

      // 1d) VehicleStatus
      const vehicleStatuses = [
        "AVAILABLE",
        "IN_USE",
        "MAINTENANCE",
        "INACTIVE",
      ];
      for (const name of vehicleStatuses) {
        await tx.vehicleStatus.upsert({
          where: { name },
          update: {},
          create: { name },
        });
      }
      console.log("✅ Seeded VehicleStatuses");

      // 1e) VehicleTripStatus
      const vehicleTripStatuses = ["IN_PROGRESS", "COMPLETED", "CANCELLED"];
      for (const name of vehicleTripStatuses) {
        await tx.vehicleTripStatus.upsert({
          where: { name },
          update: {},
          create: { name },
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

      // 3) Clientes
      // "SIN CENTRO": placeholder usado SOLO como fallback visual; los incidentes
      // sin cliente dejan clienteId = null (no se asignan a este registro).
      await tx.cliente.upsert({
        where: { code: "SIN-CENTRO" },
        update: { name: "SIN CENTRO" },
        create: {
          code: "SIN-CENTRO",
          name: "SIN CENTRO",
          companyName: "OpusInspection",
          stateId: cdmx.id,
        },
      });

      const clienteByCode = new Map<string, { id: string }>();
      // PUEBLA: CVV01..CVV09
      for (let n = 1; n <= 9; n++) {
        const code = `CVV0${n}`;
        const rec = await tx.cliente.upsert({
          where: { code },
          update: {},
          create: {
            code,
            name: `Centro de Verificación Puebla ${code}`,
            companyName: "OpusInspection Puebla",
            stateId: puebla.id,
          },
        });
        clienteByCode.set(code, rec);
      }
      // CDMX: IZ59, IT48, TH61
      for (const code of ["IZ59", "IT48", "TH61"]) {
        const rec = await tx.cliente.upsert({
          where: { code },
          update: {},
          create: {
            code,
            name: `Centro de Verificación CDMX ${code}`,
            companyName: "OpusInspection CDMX",
            stateId: cdmx.id,
          },
        });
        clienteByCode.set(code, rec);
      }
      // Test users below are related to these CDMX clientes.
      const civ = clienteByCode.get("IZ59");
      const civ2 = clienteByCode.get("IT48");
      const civ3 = clienteByCode.get("TH61");
      if (!civ || !civ2 || !civ3) throw new Error("Clientes base no creados");
      console.log(
        "✅ Seeded Clientes (SIN CENTRO, PUEBLA CVV01-09, CDMX IZ59/IT48/TH61)",
      );

      // 4) Permissions - Comprehensive database-driven permissions
      const permissionsData = [
        // Route-based permissions
        {
          name: "route:admin",
          description: "Access to admin dashboard",
          routePath: "/admin",
        },
        {
          name: "route:fsr",
          description: "Access to FSR dashboard",
          routePath: "/fsr",
        },
        {
          name: "route:client",
          description: "Access to client dashboard",
          routePath: "/client",
        },
        {
          name: "route:guest",
          description: "Access to guest dashboard",
          routePath: "/guest",
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
        {
          name: "work-parts:read",
          description: "View work parts",
          resource: "work-parts",
          action: "read",
        },
        {
          name: "work-parts:create",
          description: "Create work parts",
          resource: "work-parts",
          action: "create",
        },
        {
          name: "work-parts:update",
          description: "Update work parts",
          resource: "work-parts",
          action: "update",
        },
        {
          name: "work-parts:delete",
          description: "Delete work parts",
          resource: "work-parts",
          action: "delete",
        },

        // Parts/Inventory permissions
        {
          name: "parts:read",
          description: "View parts",
          resource: "parts",
          action: "read",
        },
        {
          name: "parts:create",
          description: "Create parts",
          resource: "parts",
          action: "create",
        },
        {
          name: "parts:update",
          description: "Update parts",
          resource: "parts",
          action: "update",
        },
        {
          name: "parts:delete",
          description: "Delete parts",
          resource: "parts",
          action: "delete",
        },

        // Cliente management permissions
        {
          name: "clientes:read",
          description: "View Clientes",
          resource: "clientes",
          action: "read",
        },
        {
          name: "clientes:create",
          description: "Create Clientes",
          resource: "clientes",
          action: "create",
        },
        {
          name: "clientes:update",
          description: "Update Clientes",
          resource: "clientes",
          action: "update",
        },
        {
          name: "clientes:delete",
          description: "Delete Clientes",
          resource: "clientes",
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
          routePath: "/admin/vacations",
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
            },
            create: perm,
          }),
        );
      }
      console.log("✅ Seeded Permissions");

      // 5) Roles with permissions
      const rolesData = [
        {
          name: "ADMINISTRADOR",
          description:
            "Administrator with full system access (not related to Cliente)",
          defaultPath: "/admin",
          permissions: [
            // All permissions (admin has full access)
            ...permissionRecords.map((p) => p.name),
          ],
        },
        {
          name: "FSR",
          description:
            "Field Service Representative - System user with management capabilities",
          defaultPath: "/fsr",
          permissions: [
            "route:fsr",
            "incidents:read",
            "incidents:update",
            "assignments:read",
            "assignments:update",
            "assignments:complete",
            "assignment-activities:read",
            "assignment-activities:create",
            "assignment-activities:update",
            "assignment-activities:complete",
            "work-parts:read",
            "work-parts:create",
            "work-parts:update",
            "parts:read",
            "schedules:read",
            "users:read",
            "clientes:read",
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
            // Vacation permissions for FSR (RF-706): can manage own vacations
            "vacations:read",
            "vacations:create",
            "vacations:delete",
          ],
        },
        {
          name: "CLIENT",
          description: "Client user - Raises incidents from Cliente",
          defaultPath: "/client",
          permissions: [
            "route:client",
            "incidents:read",
            "incidents:create",
            "incident-types:read", // Needed to select incident type when creating
            "incident-status:read", // Needed to view incident status
            "clientes:read", // Needed to select Cliente when creating incidents
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
          defaultPath: "/guest",
          permissions: [
            "route:guest",
            "incidents:read",
            "incident-types:read", // Needed to view incident types
            "incident-status:read", // Needed to view incident status
            "clientes:read", // Needed to view Clientes
            "assignments:read",
            "parts:read",
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
        const role = await tx.role.upsert({
          where: { name: roleData.name },
          update: {
            description: roleData.description,
            defaultPath: roleData.defaultPath,
          },
          create: {
            name: roleData.name,
            description: roleData.description,
            defaultPath: roleData.defaultPath,
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

      // 6) Users - 3 per role for testing. FSR/CLIENT users are related to a
      // Cliente (one pair per Cliente). ADMIN and GUEST are not tied to any Cliente.
      const usersData: Array<{
        name: string;
        email: string;
        roleName: string;
        clienteId: string | null;
      }> = [
        // ADMINISTRADOR (no Cliente)
        {
          name: "Admin User",
          email: "admin@opusinspection.com",
          roleName: "ADMINISTRADOR",
          clienteId: null,
        },
        {
          name: "Admin User 2",
          email: "admin2@opusinspection.com",
          roleName: "ADMINISTRADOR",
          clienteId: null,
        },
        {
          name: "Admin User 3",
          email: "admin3@opusinspection.com",
          roleName: "ADMINISTRADOR",
          clienteId: null,
        },
        // FSR (one per Cliente)
        {
          name: "FSR User",
          email: "fsr@opusinspection.com",
          roleName: "FSR",
          clienteId: civ.id,
        },
        {
          name: "FSR User 2",
          email: "fsr2@opusinspection.com",
          roleName: "FSR",
          clienteId: civ2.id,
        },
        {
          name: "FSR User 3",
          email: "fsr3@opusinspection.com",
          roleName: "FSR",
          clienteId: civ3.id,
        },
        // CLIENT (one per Cliente — raises incidents from their Cliente)
        {
          name: "Client User",
          email: "client@opusinspection.com",
          roleName: "CLIENT",
          clienteId: civ.id,
        },
        {
          name: "Client User 2",
          email: "client2@opusinspection.com",
          roleName: "CLIENT",
          clienteId: civ2.id,
        },
        {
          name: "Client User 3",
          email: "client3@opusinspection.com",
          roleName: "CLIENT",
          clienteId: civ3.id,
        },
        // GUEST (read-only, no Cliente)
        {
          name: "Guest User",
          email: "guest@opusinspection.com",
          roleName: "GUEST",
          clienteId: null,
        },
        {
          name: "Guest User 2",
          email: "guest2@opusinspection.com",
          roleName: "GUEST",
          clienteId: null,
        },
        {
          name: "Guest User 3",
          email: "guest3@opusinspection.com",
          roleName: "GUEST",
          clienteId: null,
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
            roleId: role.id,
            userStatusId: userStatusActivo.id,
            clienteId: userData.clienteId,
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

        // Create Cliente assignment if user has a Cliente
        if (userData.clienteId) {
          await tx.userClienteAssignment.upsert({
            where: {
              userId_clienteId: {
                userId: user.id,
                clienteId: userData.clienteId,
              },
            },
            update: { isPrimary: true, active: true },
            create: {
              userId: user.id,
              clienteId: userData.clienteId,
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
      const incidentStatuses = [
        { name: "ABIERTO", color: "#94A3B8" }, // Slate - newly reported
        { name: "ASIGNADO", color: "#8B5CF6" }, // Purple - has at least one assignment
        { name: "VISTO", color: "#06B6D4" }, // Cyan - any assignment acknowledged
        { name: "INICIADO", color: "#3B82F6" }, // Blue - work started on site
        { name: "EN_PROGRESO", color: "#F59E0B" }, // Amber - work paused / continuing
        { name: "CERRADO", color: "#10B981" }, // Green - all assignments closed
        { name: "CANCELADA", color: "#EF4444" }, // Red - admin cancelled without ODT
      ];
      for (const status of incidentStatuses) {
        await tx.incidentStatus.upsert({
          where: { name: status.name },
          update: { color: status.color, active: true },
          create: { name: status.name, color: status.color },
        });
      }
      console.log("✅ Seeded IncidentStatuses");

      // 8a) AssignmentStatuses — state machine:
      //     PENDIENTE_DE_ASIGNACION → ASIGNADO → VISTO → INICIADO ↔ EN_PROGRESO → CERRADO
      const assignmentStatuses = [
        { name: "PENDIENTE_DE_ASIGNACION", color: "#94A3B8" }, // Slate - created without assignees
        { name: "ASIGNADO", color: "#8B5CF6" }, // Purple - has assignee(s)
        { name: "VISTO", color: "#06B6D4" }, // Cyan - FSR acknowledged
        { name: "INICIADO", color: "#3B82F6" }, // Blue - on-site work in progress
        { name: "EN_PROGRESO", color: "#F59E0B" }, // Amber - paused / continuing on-site
        { name: "CERRADO", color: "#10B981" }, // Green - work finished
      ];
      for (const status of assignmentStatuses) {
        await tx.assignmentStatus.upsert({
          where: { name: status.name },
          update: { color: status.color, active: true },
          create: { name: status.name, color: status.color },
        });
      }

      // Data migration: any existing rows still pointing to the legacy
      // PENDIENTE assignment status are moved to EN_PROGRESO, then the legacy
      // status row is soft-deactivated so future seeds don't reintroduce it.
      const legacyPendiente = await tx.assignmentStatus.findUnique({
        where: { name: "PENDIENTE" },
        select: { id: true },
      });
      if (legacyPendiente) {
        const enProgreso = await tx.assignmentStatus.findUnique({
          where: { name: "EN_PROGRESO" },
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

      // 8c) VacationStatus catalog — PENDIENTE / APROBADA / RECHAZADA (RF-707)
      const vacationStatuses: Array<{
        name: string;
        description: string;
        color: string;
      }> = [
        {
          name: "PENDIENTE",
          description: "Vacation request pending admin review",
          color: "#F59E0B",
        },
        {
          name: "APROBADA",
          description: "Vacation request approved",
          color: "#10B981",
        },
        {
          name: "RECHAZADA",
          description: "Vacation request rejected",
          color: "#EF4444",
        },
      ];
      for (const vs of vacationStatuses) {
        await tx.vacationStatus.upsert({
          where: { name: vs.name },
          update: { color: vs.color, description: vs.description },
          create: vs,
        });
      }
      console.log("✅ Seeded VacationStatuses");

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
    "  Client: client@opusinspection.com / password123  (Raises incidents from Cliente)",
  );
  console.log(
    "  Guest:  guest@opusinspection.com / password123   (Read-only access)",
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
