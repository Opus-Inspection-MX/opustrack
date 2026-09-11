// prisma/seed.ts

import {
  PERMISSION_LIST,
  resolveSeedGrants,
} from "../src/lib/authz/permission-catalog";
import { prisma } from "../src/lib/database/prisma.singleton";
import { defaultChannelPolicies } from "../src/lib/notifications/catalog";
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
      const vehicleTripStatuses = ["EN_CURSO", "COMPLETADO", "CANCELADO"];
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
      // 4) Permissions live in src/lib/authz/permission-catalog.ts (Fase 4).
      // Both seeds upsert exactly PERMISSIONS, so fresh databases converge.

      const permissionRecords = [];
      for (const perm of PERMISSION_LIST) {
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

      const rolesData = [
        {
          name: "ROOT",
          description:
            "Superusuario: administra catálogos, roles, permisos y usuarios",
          defaultPath: "/inicio",
          isSuperuser: true,
          priority: 100,
          permissions: resolveSeedGrants("ROOT"),
        },
        {
          name: "ADMIN_OPERACION",
          description:
            "Administra incidentes, programación, asignaciones y organización",
          defaultPath: "/inicio",
          priority: 80,
          permissions: resolveSeedGrants("ADMIN_OPERACION"),
        },
        {
          name: "ADMIN_VACACIONES",
          description: "Administra las vacaciones de todo el personal",
          defaultPath: "/inicio",
          priority: 70,
          permissions: resolveSeedGrants("ADMIN_VACACIONES"),
        },
        {
          name: "FSR",
          description:
            "Field Service Representative - System user with management capabilities",
          defaultPath: "/inicio",
          priority: 50,
          permissions: resolveSeedGrants("FSR"),
        },
        {
          name: "EMPLEADO",
          description:
            "Personal de oficina: solo su perfil y sus propias vacaciones",
          defaultPath: "/inicio",
          priority: 30,
          permissions: resolveSeedGrants("EMPLEADO"),
        },
        {
          name: "REPORTER",
          description: "Reporter user - Raises incidents from Client",
          defaultPath: "/inicio",
          priority: 10,
          permissions: resolveSeedGrants("REPORTER"),
        },
        {
          name: "GUEST",
          description: "Guest user - Read-only access (no create permissions)",
          defaultPath: "/inicio",
          priority: 20,
          permissions: resolveSeedGrants("GUEST"),
        },
      ];

      const roleRecords = [];
      for (const roleData of rolesData) {
        const role = await tx.role.upsert({
          where: { name: roleData.name },
          update: {
            description: roleData.description,
            defaultPath: roleData.defaultPath,
            isSuperuser: roleData.isSuperuser ?? false,
            priority: roleData.priority ?? 0,
          },
          create: {
            name: roleData.name,
            description: roleData.description,
            defaultPath: roleData.defaultPath,
            isSuperuser: roleData.isSuperuser ?? false,
            priority: roleData.priority ?? 0,
          },
        });
        roleRecords.push(role);

        // Assign permissions to role. Unknown names fail fast (H-20):
        // resolveSeedGrants already validated the list, so a miss here is a
        // defect, not a typo to skip.
        for (const permName of roleData.permissions) {
          const permission = permissionRecords.find((p) => p.name === permName);
          if (!permission) {
            throw new Error(
              `Unknown permission "${permName}" for role "${roleData.name}". Re-run the seed from the permission catalog.`,
            );
          }
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
