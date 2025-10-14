// prisma/seed.ts
import { prisma } from "../src/lib/database/prisma.singleton";
import { hashPassword } from "../src/lib/security/hash";

async function main() {
  await prisma.$transaction(async (tx) => {
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
        })
      );
    }
    const userStatusActivo = userStatusRecords.find((u) => u.name === "ACTIVO")!;
    console.log("✅ Seeded UserStatuses");

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
        lines: 3,
      },
    });
    console.log("✅ Seeded VehicleInspectionCenter");

    // 4) Permissions - Comprehensive database-driven permissions
    const permissionsData = [
      // Route-based permissions
      { name: "route:admin", description: "Access to admin dashboard", routePath: "/admin" },
      { name: "route:fsr", description: "Access to FSR dashboard", routePath: "/fsr" },
      { name: "route:client", description: "Access to client dashboard", routePath: "/client" },
      { name: "route:guest", description: "Access to guest dashboard", routePath: "/guest" },

      // Incident permissions
      { name: "incidents:read", description: "View incidents", resource: "incidents", action: "read", routePath: "/incidents" },
      { name: "incidents:create", description: "Create incidents", resource: "incidents", action: "create" },
      { name: "incidents:update", description: "Update incidents", resource: "incidents", action: "update" },
      { name: "incidents:delete", description: "Delete incidents", resource: "incidents", action: "delete" },
      { name: "incidents:assign", description: "Assign incidents", resource: "incidents", action: "assign" },
      { name: "incidents:close", description: "Close incidents", resource: "incidents", action: "close" },

      // User management permissions
      { name: "users:read", description: "View users", resource: "users", action: "read" },
      { name: "users:create", description: "Create users", resource: "users", action: "create" },
      { name: "users:update", description: "Update users", resource: "users", action: "update" },
      { name: "users:delete", description: "Delete users", resource: "users", action: "delete" },

      // Role management permissions
      { name: "roles:read", description: "View roles", resource: "roles", action: "read" },
      { name: "roles:create", description: "Create roles", resource: "roles", action: "create" },
      { name: "roles:update", description: "Update roles", resource: "roles", action: "update" },
      { name: "roles:delete", description: "Delete roles", resource: "roles", action: "delete" },

      // Permission management
      { name: "permissions:read", description: "View permissions", resource: "permissions", action: "read" },
      { name: "permissions:manage", description: "Manage permissions", resource: "permissions", action: "manage" },

      // Work order permissions
      { name: "work-orders:read", description: "View work orders", resource: "work-orders", action: "read" },
      { name: "work-orders:create", description: "Create work orders", resource: "work-orders", action: "create" },
      { name: "work-orders:update", description: "Update work orders", resource: "work-orders", action: "update" },
      { name: "work-orders:delete", description: "Delete work orders", resource: "work-orders", action: "delete" },
      { name: "work-orders:assign", description: "Assign work orders", resource: "work-orders", action: "assign" },
      { name: "work-orders:complete", description: "Complete work orders", resource: "work-orders", action: "complete" },

      // Work activity permissions
      { name: "work-activities:read", description: "View work activities", resource: "work-activities", action: "read" },
      { name: "work-activities:create", description: "Create work activities", resource: "work-activities", action: "create" },
      { name: "work-activities:update", description: "Update work activities", resource: "work-activities", action: "update" },
      { name: "work-activities:delete", description: "Delete work activities", resource: "work-activities", action: "delete" },
      { name: "work-activities:complete", description: "Complete work activities", resource: "work-activities", action: "complete" },

      // Work part permissions
      { name: "work-parts:read", description: "View work parts", resource: "work-parts", action: "read" },
      { name: "work-parts:create", description: "Create work parts", resource: "work-parts", action: "create" },
      { name: "work-parts:update", description: "Update work parts", resource: "work-parts", action: "update" },
      { name: "work-parts:delete", description: "Delete work parts", resource: "work-parts", action: "delete" },

      // Parts/Inventory permissions
      { name: "parts:read", description: "View parts", resource: "parts", action: "read" },
      { name: "parts:create", description: "Create parts", resource: "parts", action: "create" },
      { name: "parts:update", description: "Update parts", resource: "parts", action: "update" },
      { name: "parts:delete", description: "Delete parts", resource: "parts", action: "delete" },

      // VIC management permissions
      { name: "vics:read", description: "View VICs", resource: "vics", action: "read" },
      { name: "vics:create", description: "Create VICs", resource: "vics", action: "create" },
      { name: "vics:update", description: "Update VICs", resource: "vics", action: "update" },
      { name: "vics:delete", description: "Delete VICs", resource: "vics", action: "delete" },

      // Schedule permissions
      { name: "schedules:read", description: "View schedules", resource: "schedules", action: "read" },
      { name: "schedules:create", description: "Create schedules", resource: "schedules", action: "create" },
      { name: "schedules:update", description: "Update schedules", resource: "schedules", action: "update" },
      { name: "schedules:delete", description: "Delete schedules", resource: "schedules", action: "delete" },

      // Reports permissions
      { name: "reports:view", description: "View reports", resource: "reports", action: "read" },
      { name: "reports:export", description: "Export reports", resource: "reports", action: "export" },

      // State permissions (administrative data)
      { name: "states:read", description: "View states", resource: "states", action: "read" },
      { name: "states:create", description: "Create states", resource: "states", action: "create" },
      { name: "states:update", description: "Update states", resource: "states", action: "update" },
      { name: "states:delete", description: "Delete states", resource: "states", action: "delete" },

      // User Status permissions (lookup data)
      { name: "user-status:read", description: "View user statuses", resource: "user-status", action: "read" },
      { name: "user-status:create", description: "Create user statuses", resource: "user-status", action: "create" },
      { name: "user-status:update", description: "Update user statuses", resource: "user-status", action: "update" },
      { name: "user-status:delete", description: "Delete user statuses", resource: "user-status", action: "delete" },

      // Incident Type permissions (lookup data)
      { name: "incident-types:read", description: "View incident types", resource: "incident-types", action: "read" },
      { name: "incident-types:create", description: "Create incident types", resource: "incident-types", action: "create" },
      { name: "incident-types:update", description: "Update incident types", resource: "incident-types", action: "update" },
      { name: "incident-types:delete", description: "Delete incident types", resource: "incident-types", action: "delete" },

      // Incident Status permissions (lookup data)
      { name: "incident-status:read", description: "View incident statuses", resource: "incident-status", action: "read" },
      { name: "incident-status:create", description: "Create incident statuses", resource: "incident-status", action: "create" },
      { name: "incident-status:update", description: "Update incident statuses", resource: "incident-status", action: "update" },
      { name: "incident-status:delete", description: "Delete incident statuses", resource: "incident-status", action: "delete" },
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
        })
      );
    }
    console.log("✅ Seeded Permissions");

    // 5) Roles with permissions
    const rolesData = [
      {
        name: "ADMINISTRADOR",
        description: "Administrator with full system access (not related to VIC)",
        defaultPath: "/admin",
        permissions: [
          // All permissions (admin has full access)
          ...permissionRecords.map(p => p.name)
        ],
      },
      {
        name: "FSR",
        description: "Field Service Representative - System user with management capabilities",
        defaultPath: "/fsr",
        permissions: [
          "route:fsr",
          "incidents:read", "incidents:update",
          "work-orders:read", "work-orders:update", "work-orders:complete",
          "work-activities:read", "work-activities:create", "work-activities:update", "work-activities:complete",
          "work-parts:read", "work-parts:create", "work-parts:update",
          "parts:read",
          "schedules:read",
          "users:read",
          "vics:read",
          "reports:view", "reports:export",
        ],
      },
      {
        name: "CLIENT",
        description: "Client user - Raises incidents from VIC",
        defaultPath: "/client",
        permissions: [
          "route:client",
          "incidents:read", "incidents:create",
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
        const permission = permissionRecords.find(p => p.name === permName);
        if (permission) {
          await tx.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: role.id, permissionId: permission.id },
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
      const role = roleRecords.find(r => r.name === userData.roleName);
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
    }
    console.log("✅ Seeded Users with Profiles");

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
        })
      );
    }
    console.log("✅ Seeded IncidentTypes");

    // 8) IncidentStatuses
    const incidentStatuses = ["ABIERTO", "PENDIENTE", "EN_PROGRESO", "CERRADO"];
    const incidentStatusRecords = [];
    for (const name of incidentStatuses) {
      incidentStatusRecords.push(
        await tx.incidentStatus.upsert({
          where: { name },
          update: {},
          create: { name },
        })
      );
    }
    console.log("✅ Seeded IncidentStatuses");

    // 9) Part - Only one for testing
    await tx.part.upsert({
      where: { name_vicId: { name: "Filtro de Aire", vicId: vic.id } },
      update: {
        description: "Filtro de aire para sistema de ventilación",
        price: 150.00,
        stock: 10,
      },
      create: {
        name: "Filtro de Aire",
        description: "Filtro de aire para sistema de ventilación",
        price: 150.00,
        stock: 10,
        vicId: vic.id,
      },
    });
    console.log("✅ Seeded Part");

    // 10) Sample Schedule
    const schedule = await tx.schedule.upsert({
      where: { id: "schedule-sample-1" },
      update: {},
      create: {
        id: "schedule-sample-1",
        title: "Mantenimiento Semanal",
        description: "Mantenimiento programado semanal",
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        vicId: vic.id,
      },
    });
    console.log("✅ Seeded Schedule");

    // 11) Sample Incident
    const adminUser = await tx.user.findUnique({
      where: { email: "admin@opusinspection.com" },
    });

    if (adminUser) {
      await tx.incident.upsert({
        where: { id: 1 },
        update: {},
        create: {
          title: "Falla en línea de verificación 2",
          description: "La línea 2 presenta problemas con el sistema de medición de emisiones",
          priority: 8,
          sla: 24,
          typeId: incidentTypeRecords[0].id,
          statusId: incidentStatusRecords[0].id,
          vicId: vic.id,
          reportedById: adminUser.id,
          scheduleId: schedule.id,
        },
      });
      console.log("✅ Seeded Sample Incident");
    }
  });

  console.log("🎉 Seed completed successfully!");
  console.log("\n📋 Test Users:");
  console.log("  Admin:  admin@opusinspection.com / password123  (Not related to VIC)");
  console.log("  FSR:    fsr@opusinspection.com / password123     (Field Service Representative)");
  console.log("  Client: client@opusinspection.com / password123  (Raises incidents from VIC)");
  console.log("  Guest:  guest@opusinspection.com / password123   (Read-only access)");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
