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
      const lineStatusRecords = [];
      for (const name of lineStatuses) {
        lineStatusRecords.push(
          await tx.lineStatus.upsert({
            where: { name },
            update: {},
            create: { name },
          }),
        );
      }
      const lineStatusActivo = lineStatusRecords.find(
        (s) => s.name === "ACTIVO",
      );
      if (!lineStatusActivo) throw new Error("LineStatus ACTIVO not found");
      const lineStatusMantenimiento = lineStatusRecords.find(
        (s) => s.name === "MANTENIMIENTO",
      );
      if (!lineStatusMantenimiento)
        throw new Error("LineStatus MANTENIMIENTO not found");
      console.log("✅ Seeded LineStatuses");

      // 1c) EquipmentStatus
      const equipmentStatuses = ["OPERATIVO", "MANTENIMIENTO", "INACTIVO"];
      const equipmentStatusRecords = [];
      for (const name of equipmentStatuses) {
        equipmentStatusRecords.push(
          await tx.equipmentStatus.upsert({
            where: { name },
            update: {},
            create: { name },
          }),
        );
      }
      const equipmentStatusOperativo = equipmentStatusRecords.find(
        (s) => s.name === "OPERATIVO",
      );
      if (!equipmentStatusOperativo)
        throw new Error("EquipmentStatus OPERATIVO not found");
      const equipmentStatusMantenimiento = equipmentStatusRecords.find(
        (s) => s.name === "MANTENIMIENTO",
      );
      if (!equipmentStatusMantenimiento)
        throw new Error("EquipmentStatus MANTENIMIENTO not found");
      console.log("✅ Seeded EquipmentStatuses");

      // 1d) VehicleStatus
      const vehicleStatuses = [
        "AVAILABLE",
        "IN_USE",
        "MAINTENANCE",
        "INACTIVE",
      ];
      const vehicleStatusRecords = [];
      for (const name of vehicleStatuses) {
        vehicleStatusRecords.push(
          await tx.vehicleStatus.upsert({
            where: { name },
            update: {},
            create: { name },
          }),
        );
      }
      const vehicleStatusAvailable = vehicleStatusRecords.find(
        (s) => s.name === "AVAILABLE",
      );
      if (!vehicleStatusAvailable)
        throw new Error("VehicleStatus AVAILABLE not found");
      console.log("✅ Seeded VehicleStatuses");

      // 1e) VehicleTripStatus
      const vehicleTripStatuses = ["IN_PROGRESS", "COMPLETED", "CANCELLED"];
      const vehicleTripStatusRecords = [];
      for (const name of vehicleTripStatuses) {
        vehicleTripStatusRecords.push(
          await tx.vehicleTripStatus.upsert({
            where: { name },
            update: {},
            create: { name },
          }),
        );
      }
      const _vehicleTripStatusInProgress = vehicleTripStatusRecords.find(
        (s) => s.name === "IN_PROGRESS",
      );
      if (!_vehicleTripStatusInProgress)
        throw new Error("VehicleTripStatus IN_PROGRESS not found");
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

        // Work order permissions
        {
          name: "work-orders:read",
          description: "View work orders",
          resource: "work-orders",
          action: "read",
        },
        {
          name: "work-orders:create",
          description: "Create work orders",
          resource: "work-orders",
          action: "create",
        },
        {
          name: "work-orders:update",
          description: "Update work orders",
          resource: "work-orders",
          action: "update",
        },
        {
          name: "work-orders:delete",
          description: "Delete work orders",
          resource: "work-orders",
          action: "delete",
        },
        {
          name: "work-orders:assign",
          description: "Assign work orders",
          resource: "work-orders",
          action: "assign",
        },
        {
          name: "work-orders:complete",
          description: "Complete work orders",
          resource: "work-orders",
          action: "complete",
        },

        // Work activity permissions
        {
          name: "work-activities:read",
          description: "View work activities",
          resource: "work-activities",
          action: "read",
        },
        {
          name: "work-activities:create",
          description: "Create work activities",
          resource: "work-activities",
          action: "create",
        },
        {
          name: "work-activities:update",
          description: "Update work activities",
          resource: "work-activities",
          action: "update",
        },
        {
          name: "work-activities:delete",
          description: "Delete work activities",
          resource: "work-activities",
          action: "delete",
        },
        {
          name: "work-activities:complete",
          description: "Complete work activities",
          resource: "work-activities",
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
            "work-orders:read",
            "work-orders:update",
            "work-orders:complete",
            "work-activities:read",
            "work-activities:create",
            "work-activities:update",
            "work-activities:complete",
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
            "work-orders:read",
            "schedules:read",
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
            "work-orders:read",
            "parts:read",
            "schedules:read",
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

      // 7) IncidentTypes
      const incidentTypes = [
        { name: "REPARACION", description: "Incident requiring repair" },
        { name: "MANTENIMIENTO", description: "Maintenance incident" },
        { name: "OTROS", description: "Other type of incident" },
      ];
      const incidentTypeRecords = [];
      for (const it of incidentTypes) {
        incidentTypeRecords.push(
          await tx.incidentType.upsert({
            where: { name: it.name },
            update: {},
            create: it,
          }),
        );
      }
      console.log("✅ Seeded IncidentTypes");

      // 8) IncidentStatuses
      const incidentStatuses = [
        { name: "ABIERTO", color: "#EF4444" }, // Red - requires immediate attention
        { name: "PENDIENTE", color: "#F59E0B" }, // Amber - waiting/pending
        { name: "EN_PROGRESO", color: "#3B82F6" }, // Blue - actively being worked on
        { name: "CERRADO", color: "#10B981" }, // Green - completed
      ];
      const incidentStatusRecords = [];
      for (const status of incidentStatuses) {
        incidentStatusRecords.push(
          await tx.incidentStatus.upsert({
            where: { name: status.name },
            update: { color: status.color },
            create: { name: status.name, color: status.color },
          }),
        );
      }
      console.log("✅ Seeded IncidentStatuses");

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
      const scheduleStatusRecords = [];
      for (const status of scheduleStatuses) {
        scheduleStatusRecords.push(
          await tx.scheduleStatus.upsert({
            where: { name: status.name },
            update: { color: status.color, description: status.description },
            create: status,
          }),
        );
      }
      const scheduleStatusConfirmado = scheduleStatusRecords.find(
        (s) => s.name === "CONFIRMADO",
      );
      if (!scheduleStatusConfirmado)
        throw new Error("ScheduleStatus CONFIRMADO not found");
      console.log("✅ Seeded ScheduleStatuses");

      // 9) Parts - Multiple parts for testing inventory management
      const partsData = [
        {
          name: "Filtro de Aire",
          description: "Filtro de aire para sistema de ventilación",
          price: 150.0,
          stock: 10,
        },
        {
          name: "Aceite de Motor",
          description: "Aceite sintético para motores",
          price: 250.0,
          stock: 15,
        },
        {
          name: "Bujías",
          description: "Juego de bujías",
          price: 80.0,
          stock: 20,
        },
        {
          name: "Pastillas de Freno",
          description: "Pastillas de freno delanteras",
          price: 400.0,
          stock: 8,
        },
        {
          name: "Batería 12V",
          description: "Batería de 12V 60Ah",
          price: 1200.0,
          stock: 5,
        },
      ];

      const partRecords = [];
      for (const partData of partsData) {
        partRecords.push(
          await tx.part.upsert({
            where: { name_vicId: { name: partData.name, vicId: vic.id } },
            update: {
              description: partData.description,
              price: partData.price,
              stock: partData.stock,
            },
            create: {
              ...partData,
              vicId: vic.id,
            },
          }),
        );
      }
      console.log("✅ Seeded Parts");

      // 9b) Lines - Sample verification lines
      const linesData = [
        {
          name: "Línea 1",
          description: "Línea de verificación principal",
          statusId: lineStatusActivo.id,
        },
        {
          name: "Línea 2",
          description: "Línea de verificación secundaria",
          statusId: lineStatusActivo.id,
        },
        {
          name: "Línea 3",
          description: "Línea de verificación terciaria",
          statusId: lineStatusMantenimiento.id,
        },
      ];

      const lineRecords = [];
      for (const lineData of linesData) {
        lineRecords.push(
          await tx.line.upsert({
            where: { name_vicId: { name: lineData.name, vicId: vic.id } },
            update: {
              description: lineData.description,
              statusId: lineData.statusId,
            },
            create: {
              ...lineData,
              vicId: vic.id,
            },
          }),
        );
      }
      console.log("✅ Seeded Lines");

      // 9c) Equipment - Sample equipment for lines
      const equipmentData = [
        {
          name: "Analizador de Gases L1",
          description: "Analizador de gases para línea 1",
          model: "AG-2000",
          serialNumber: "AG2000-001",
          lineId: lineRecords[0].id,
          statusId: equipmentStatusOperativo.id,
        },
        {
          name: "Analizador de Gases L2",
          description: "Analizador de gases para línea 2",
          model: "AG-2000",
          serialNumber: "AG2000-002",
          lineId: lineRecords[1].id,
          statusId: equipmentStatusOperativo.id,
        },
        {
          name: "Opacímetro L1",
          description: "Opacímetro para línea 1",
          model: "OP-500",
          serialNumber: "OP500-001",
          lineId: lineRecords[0].id,
          statusId: equipmentStatusOperativo.id,
        },
        {
          name: "Dinamómetro L3",
          description: "Dinamómetro para línea 3",
          model: "DIN-3000",
          serialNumber: "DIN3000-001",
          lineId: lineRecords[2].id,
          statusId: equipmentStatusMantenimiento.id,
        },
      ];

      const equipmentRecords = [];
      for (const equipData of equipmentData) {
        // Try to find existing equipment by name and lineId
        const existing = await tx.equipment.findFirst({
          where: {
            name: equipData.name,
            lineId: equipData.lineId,
          },
        });

        if (existing) {
          equipmentRecords.push(
            await tx.equipment.update({
              where: { id: existing.id },
              data: {
                description: equipData.description,
                model: equipData.model,
                serialNumber: equipData.serialNumber,
                statusId: equipData.statusId,
              },
            }),
          );
        } else {
          equipmentRecords.push(
            await tx.equipment.create({
              data: equipData,
            }),
          );
        }
      }
      console.log("✅ Seeded Equipment");

      // 9d) Vehicles - Sample company vehicles for trip tracking
      const vehiclesData = [
        {
          make: "Toyota",
          model: "Hilux",
          year: 2022,
          licensePlate: "ABC-123-XYZ",
          vin: "JTMZK3DV5N5123456",
          color: "Blanco",
          statusId: vehicleStatusAvailable.id,
          notes: "Camioneta para trabajo de campo",
        },
        {
          make: "Ford",
          model: "Ranger",
          year: 2021,
          licensePlate: "DEF-456-UVW",
          vin: "8AFRZZED5N1234567",
          color: "Gris",
          statusId: vehicleStatusAvailable.id,
          notes: "Vehículo de supervisión",
        },
        {
          make: "Nissan",
          model: "NP300",
          year: 2023,
          licensePlate: "GHI-789-RST",
          vin: "3N6AD31Z5N1234568",
          color: "Azul",
          statusId: vehicleStatusAvailable.id,
          notes: "Vehículo de servicio",
        },
      ];

      const vehicleRecords = [];
      for (const vehicleData of vehiclesData) {
        vehicleRecords.push(
          await tx.vehicle.upsert({
            where: { licensePlate: vehicleData.licensePlate },
            update: {
              make: vehicleData.make,
              model: vehicleData.model,
              year: vehicleData.year,
              color: vehicleData.color,
              statusId: vehicleData.statusId,
              notes: vehicleData.notes,
            },
            create: vehicleData,
          }),
        );
      }
      console.log("✅ Seeded Vehicles");

      // 10) Sample Schedules - múltiples fechas para testing del calendario
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const schedules = [
        {
          id: "schedule-sample-1",
          title: "Mantenimiento Semanal",
          description: "Mantenimiento programado semanal",
          scheduledAt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // +7 días
        },
        {
          id: "schedule-sample-2",
          title: "Calibración de Equipos",
          description: "Calibración mensual de equipos de medición",
          scheduledAt: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // +2 días a las 9:00
        },
        {
          id: "schedule-sample-3",
          title: "Inspección de Seguridad",
          description: "Inspección general de seguridad del centro",
          scheduledAt: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // +5 días a las 14:00
        },
        {
          id: "schedule-sample-4",
          title: "Revisión de Líneas",
          description: "Revisión de todas las líneas de verificación",
          scheduledAt: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), // +10 días
        },
        {
          id: "schedule-sample-5",
          title: "Actualización de Software",
          description: "Actualización de software de sistemas",
          scheduledAt: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // +1 día
        },
      ];

      // Ajustar horarios
      schedules[1].scheduledAt.setHours(9, 0, 0, 0);
      schedules[2].scheduledAt.setHours(14, 0, 0, 0);
      schedules[3].scheduledAt.setHours(10, 30, 0, 0);
      schedules[4].scheduledAt.setHours(8, 0, 0, 0);

      const scheduleRecords = [];
      for (const scheduleData of schedules) {
        const schedule = await tx.schedule.upsert({
          where: { id: scheduleData.id },
          update: { statusId: scheduleStatusConfirmado.id },
          create: {
            ...scheduleData,
            vicId: vic.id,
            statusId: scheduleStatusConfirmado.id,
          },
        });
        scheduleRecords.push(schedule);
      }
      console.log("✅ Seeded Schedules");

      // Usar el primer schedule para el incidente de ejemplo
      const _schedule = scheduleRecords[0];

      // 11) Sample Incidents - múltiples incidentes programados
      const adminUser = await tx.user.findUnique({
        where: { email: "admin@opusinspection.com" },
      });

      if (adminUser) {
        const sampleIncidents = [
          {
            id: 1,
            title: "Falla en línea de verificación 2",
            description:
              "La línea 2 presenta problemas con el sistema de medición de emisiones",
            priority: 8,
            scheduleId: scheduleRecords[0].id,
          },
          {
            id: 2,
            title: "Calibración de analizador de gases",
            description:
              "Requiere calibración del analizador de gases de la línea 1",
            priority: 6,
            scheduleId: scheduleRecords[1].id,
          },
          {
            id: 3,
            title: "Revisión de sistema de frenado",
            description: "Inspección del sistema de frenado en línea 3",
            priority: 7,
            scheduleId: scheduleRecords[2].id,
          },
          {
            id: 4,
            title: "Mantenimiento preventivo general",
            description: "Mantenimiento preventivo de todas las líneas",
            priority: 5,
            scheduleId: scheduleRecords[3].id,
          },
          {
            id: 5,
            title: "Actualización de firmware",
            description: "Actualización de firmware en equipos de diagnóstico",
            priority: 4,
            scheduleId: scheduleRecords[4].id,
          },
        ];

        for (const incidentData of sampleIncidents) {
          await tx.incident.upsert({
            where: { id: incidentData.id },
            update: {},
            create: {
              ...incidentData,
              sla: 24,
              typeId: incidentTypeRecords[0].id,
              statusId: incidentStatusRecords[0].id,
              vicId: vic.id,
              reportedById: adminUser.id,
            },
          });
        }
        console.log("✅ Seeded Sample Incidents");
      }
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
