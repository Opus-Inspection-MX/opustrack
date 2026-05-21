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

      // 2) State - Only one for testing
      const state = await tx.state.upsert({
        where: { code: "CDMX" },
        update: {},
        create: { name: "Ciudad de México", code: "CDMX" },
      });
      console.log("✅ Seeded State");

      // 3) VehicleInspectionCenter - Only one for testing
      const vic = await tx.vehicleInspectionCenter.upsert({
        where: { code: "VIC001" },
        update: {},
        create: {
          code: "VIC001",
          name: "Centro de Verificación CDMX Principal",
          address: "Av. Principal 123, CDMX",
          phone: "555-123-4567",
          contact: "Juan Pérez",
          rfc: "VICCDMX123456",
          companyName: "OpusInspection CDMX",
          stateId: state.id,
        },
      });
      console.log("✅ Seeded VehicleInspectionCenter");

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

        // VIC management permissions
        {
          name: "vics:read",
          description: "View VICs",
          resource: "vics",
          action: "read",
        },
        {
          name: "vics:create",
          description: "Create VICs",
          resource: "vics",
          action: "create",
        },
        {
          name: "vics:update",
          description: "Update VICs",
          resource: "vics",
          action: "update",
        },
        {
          name: "vics:delete",
          description: "Delete VICs",
          resource: "vics",
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
            "Administrator with full system access (not related to VIC)",
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
            "vics:read",
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
          name: "CLIENT",
          description: "Client user - Raises incidents from VIC",
          defaultPath: "/client",
          permissions: [
            "route:client",
            "incidents:read",
            "incidents:create",
            "incident-types:read", // Needed to select incident type when creating
            "incident-status:read", // Needed to view incident status
            "vics:read", // Needed to select VIC when creating incidents
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
            "vics:read", // Needed to view VICs
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

      // 6) Users - One per role
      const usersData = [
        {
          name: "Admin User",
          email: "admin@opusinspection.com",
          roleName: "ADMINISTRADOR",
          vicId: null, // Admin is not related to a VIC
        },
        {
          name: "FSR User",
          email: "fsr@opusinspection.com",
          roleName: "FSR",
          vicId: vic.id,
        },
        {
          name: "Client User",
          email: "client@opusinspection.com",
          roleName: "CLIENT",
          vicId: vic.id, // Client raises incidents from VIC
        },
        {
          name: "Guest User",
          email: "guest@opusinspection.com",
          roleName: "GUEST",
          vicId: null, // Guest has read-only access, no VIC association
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
            vicId: userData.vicId,
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

        // Create VIC assignment if user has a VIC
        if (userData.vicId) {
          await tx.userVicAssignment.upsert({
            where: {
              userId_vicId: { userId: user.id, vicId: userData.vicId },
            },
            update: { isPrimary: true, active: true },
            create: {
              userId: user.id,
              vicId: userData.vicId,
              isPrimary: true,
            },
          });
        }
      }
      console.log("✅ Seeded Users with Profiles and VIC Assignments");

      // 7) IncidentTypes (con SLA por tipo).
      // El tipo "Desconocido" es del sistema — se usa como fallback cuando un
      // incidente se crea sin tipo. NO debe eliminarse (deleteIncidentType lo
      // blinda por nombre).
      const incidentTypes: Array<{
        name: string;
        description: string;
        sla: number | null;
      }> = [
        {
          name: "Desconocido",
          description:
            "Tipo por defecto cuando no se clasifica. NO eliminar — usado como fallback del sistema.",
          sla: null,
        },
        {
          name: "Falla Eléctrica",
          description: "Cortocircuitos, fallas de tablero, iluminación",
          sla: 4,
        },
        {
          name: "Falla Mecánica",
          description: "Equipos hidráulicos, neumáticos, ejes",
          sla: 8,
        },
        {
          name: "Falla de Software",
          description: "Sistema de inspección, base de datos, integraciones",
          sla: 12,
        },
        {
          name: "Falla de Cámaras",
          description: "Cámaras de inspección OCR, lectores de placa",
          sla: 6,
        },
        {
          name: "Falla de Báscula",
          description: "Sistema de pesaje",
          sla: 8,
        },
        {
          name: "Falla de Diagnóstico",
          description: "Equipos de gases, frenómetro, alineadora",
          sla: 8,
        },
        {
          name: "Falla de Red",
          description: "Conectividad, switches, WiFi",
          sla: 4,
        },
        {
          name: "Mantenimiento Preventivo",
          description: "Mantenimiento programado",
          sla: 48,
        },
        {
          name: "Mantenimiento Correctivo",
          description: "Reparación tras falla",
          sla: 24,
        },
        {
          name: "Calibración",
          description: "Ajuste y calibración de equipos",
          sla: 48,
        },
        {
          name: "Limpieza / Acondicionamiento",
          description: "Higiene, orden, acondicionamiento del CVV",
          sla: 72,
        },
        {
          name: "Suministro",
          description: "Faltante de consumibles o refacciones",
          sla: 24,
        },
      ];
      for (const it of incidentTypes) {
        await tx.incidentType.upsert({
          where: { name: it.name },
          update: {
            description: it.description,
            sla: it.sla,
          },
          create: it,
        });
      }
      console.log("✅ Seeded IncidentTypes");

      // 8) IncidentStatuses — state machine: ABIERTO → ASIGNADO → VISTO → INICIADO → CERRADO
      const incidentStatuses = [
        { name: "ABIERTO", color: "#94A3B8" }, // Slate - newly reported
        { name: "ASIGNADO", color: "#8B5CF6" }, // Purple - has at least one assignment
        { name: "VISTO", color: "#06B6D4" }, // Cyan - any assignment acknowledged
        { name: "INICIADO", color: "#3B82F6" }, // Blue - work started on site
        { name: "CERRADO", color: "#10B981" }, // Green - all assignments closed
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
      //     PENDIENTE_DE_ASIGNACION → ASIGNADO → VISTO → INICIADO → { PENDIENTE | CERRADO }
      const assignmentStatuses = [
        { name: "PENDIENTE_DE_ASIGNACION", color: "#94A3B8" }, // Slate - created without assignees
        { name: "ASIGNADO", color: "#8B5CF6" }, // Purple - has assignee(s)
        { name: "VISTO", color: "#06B6D4" }, // Cyan - FSR acknowledged
        { name: "INICIADO", color: "#3B82F6" }, // Blue - on-site work in progress
        { name: "PENDIENTE", color: "#F59E0B" }, // Amber - partial / awaiting validation
        { name: "CERRADO", color: "#10B981" }, // Green - work finished
      ];
      for (const status of assignmentStatuses) {
        await tx.assignmentStatus.upsert({
          where: { name: status.name },
          update: { color: status.color, active: true },
          create: { name: status.name, color: status.color },
        });
      }
      console.log("✅ Seeded AssignmentStatuses");

      // 8b) ScheduleStatuses - Separate from IncidentStatus for semantic clarity
      const scheduleStatuses = [
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
    },
    {
      maxWait: 20000, // Maximum time to wait for a transaction slot (20 seconds)
      timeout: 60000, // Maximum time for transaction to complete (60 seconds)
    },
  );

  console.log("🎉 Seed completed successfully!");
  console.log("\n📋 Test Users:");
  console.log(
    "  Admin:  admin@opusinspection.com / password123  (Not related to VIC)",
  );
  console.log(
    "  FSR:    fsr@opusinspection.com / password123     (Field Service Representative)",
  );
  console.log(
    "  Client: client@opusinspection.com / password123  (Raises incidents from VIC)",
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
