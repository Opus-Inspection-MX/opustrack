// prisma/seed.ts
import { prisma } from "../src/lib/database/prisma.singleton";
import { hashPassword } from "../src/lib/security/hash";
import { ROLE_DEFS, ROLES, PERMISSIONS } from "../src/lib/authz/authz";

async function main() {
  await prisma.$transaction(async (tx) => {
    // 1) Estados de México
    const states = [
      { name: "Aguascalientes", code: "AGU" },
      { name: "Baja California", code: "BCN" },
      { name: "Baja California Sur", code: "BCS" },
      { name: "Campeche", code: "CAM" },
      { name: "Chiapas", code: "CHP" },
      { name: "Chihuahua", code: "CHH" },
      { name: "Coahuila", code: "COA" },
      { name: "Colima", code: "COL" },
      { name: "Durango", code: "DUR" },
      { name: "Guanajuato", code: "GUA" },
      { name: "Guerrero", code: "GRO" },
      { name: "Hidalgo", code: "HID" },
      { name: "Jalisco", code: "JAL" },
      { name: "Mexico", code: "MEX" },
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

    const stateRecords = [];
    for (const s of states) {
      stateRecords.push(
        await tx.state.upsert({
          where: { name: s.name },
          update: {},
          create: { name: s.name, code: s.code },
        })
      );
    }
    console.log("✅ Seeded States");

    // 2) UserStatus
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
    const userStatusActivo = userStatusRecords.find(
      (u) => u.name === "ACTIVO"
    )!;
    console.log("✅ Seeded UserStatuses");

    // 3) Roles (desde ROLE_DEFS) -> guarda defaultPath
    const roleRecords = await Promise.all(
      (ROLES as string[]).map((name) =>
        tx.role.upsert({
          where: { name },
          update: {},
          create: {
            name,
            defaultPath: ROLE_DEFS[name as keyof typeof ROLE_DEFS].defaultPath,
          },
        })
      )
    );
    const byRoleName = new Map(roleRecords.map((r) => [r.name, r]));
    console.log("✅ Seeded Roles (con defaultPath)");

    // 4) VehicleInspectionCenters (uno por estado)
    for (const st of stateRecords) {
      await tx.vehicleInspectionCenter.upsert({
        where: { code: `VIC${st.code}` },
        update: {},
        create: {
          code: `VIC${st.code}`,
          name: `Centro de Verificación ${st.name}`,
          address: `Dirección de ${st.name}`,
          phone: "555-000-0000",
          contact: "Contacto General",
          rfc: "RFC123456789",
          companyName: `Empresa ${st.name}`,
          stateId: st.id,
        },
      });
    }
    console.log("✅ Seeded VehicleInspectionCenters");

    // 5) IncidentTypes
    const incidentTypes = [
      { name: "REPARACION", description: "Incidente de reparacion" },
      { name: "MANTENIMIENTO", description: "Incidente de mantenimiento" },
      { name: "OTROS", description: "Otro tipo de incidente" },
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

    // 6) IncidentStatuses
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
    const incidentTypeDefault = incidentTypeRecords[0];
    const incidentStatusDefault = incidentStatusRecords[0];
    console.log("✅ Seeded IncidentStatuses");

    // 7) Parts por VIC (requiere @@unique([name, vicId]) en Part)
    const vics = await tx.vehicleInspectionCenter.findMany();
    for (const vic of vics) {
      for (let i = 1; i <= 3; i++) {
        const name = `Part${i}-${vic.code}`; // vic.code ya incluye "VIC"
        await tx.part.upsert({
          where: { name_vicId: { name, vicId: vic.id } },
          update: {
            description: `Part ${i} for ${vic.name}`,
            price: 100 * i,
            stock: 10 * i,
          },
          create: {
            name,
            description: `Part ${i} for ${vic.name}`,
            price: 100 * i,
            stock: 10 * i,
            vicId: vic.id,
          },
        });
      }
    }
    console.log("✅ Seeded Parts for each VIC");

    // 8) Usuarios por rol (crea uno por cada rol)
    const firstVic = vics[0] ?? null;
    for (const role of roleRecords) {
      const needsVic = role.name === "USUARIO_PERSONAL"; // ejemplo: personal asignado a un VIC
      await tx.user.upsert({
        where: { email: `${role.name.toLowerCase()}@opusinspection.com` },
        update: {},
        create: {
          name: `${role.name} User`,
          email: `${role.name.toLowerCase()}@opusinspection.com`,
          password: await hashPassword("password123"),
          roleId: role.id,
          userStatusId: userStatusActivo.id,
          ...(needsVic && firstVic ? { vicId: firstVic.id } : {}),
        },
      });
    }
    console.log("✅ Seeded Users per role");

    // 9) Incidentes de ejemplo (uno por VIC)
    for (const vic of vics) {
      const reporter = await tx.user.findFirst({ where: { vicId: vic.id } });
      if (!reporter) continue;

      const exists = await tx.incident.findFirst({
        where: { title: `Sample Incident for ${vic.name}`, vicId: vic.id },
        select: { id: true },
      });

      if (!exists) {
        await tx.incident.create({
          data: {
            title: `Sample Incident for ${vic.name}`,
            description: "This is a seeded incident.",
            priority: 5,
            sla: 24,
            typeId: incidentTypeDefault.id,
            statusId: incidentStatusDefault.id,
            reportedAt: new Date(),
            vicId: vic.id,
            reportedById: reporter.id,
          },
        });
      }
    }
    console.log("✅ Seeded Incidents for each VIC");

    // 10) Permisos únicos (derivados de ROLE_DEFS)
    const permissionRecords = await Promise.all(
      (PERMISSIONS as string[]).map((name) =>
        tx.permission.upsert({
          where: { name },
          update: {},
          create: { name, description: name },
        })
      )
    );
    const byPermName = new Map(permissionRecords.map((p) => [p.name, p]));
    console.log("✅ Seeded Permissions (derivados de ROLE_DEFS)");

    // 11) Mapeo permisos → roles (desde ROLE_DEFS)
    for (const roleName of ROLES) {
      const role = byRoleName.get(roleName);
      if (!role) continue;

      const permNames = ROLE_DEFS[roleName].permissions as readonly string[];
      for (const permName of permNames) {
        const perm = byPermName.get(permName);
        if (!perm) continue;

        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: perm.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
    console.log("✅ Mapped Permissions → Roles (ROLE_DEFS)");

    // 12) UserProfiles (uno por usuario; upsert por unique userId)
    const users = await tx.user.findMany();
    for (const user of users) {
      await tx.userProfile.upsert({
        where: { userId: user.id },
        update: { jobPosition: "Empleado" },
        create: {
          userId: user.id,
          telephone: "555-123-4567",
          emergencyContact: "Contacto de emergencia",
          jobPosition: "Empleado",
        },
      });
    }
    console.log("✅ Seeded UserProfiles");

    // 13) Schedules: 2 por VIC
    for (const vic of vics) {
      for (let i = 1; i <= 2; i++) {
        const scheduledAt = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        const title = `Horario ${i} para ${vic.name}`;

        const exists = await tx.schedule.findFirst({
          where: { vicId: vic.id, title, scheduledAt },
          select: { id: true },
        });

        if (!exists) {
          await tx.schedule.create({
            data: {
              title,
              description: `Descripción del horario ${i}`,
              scheduledAt,
              vicId: vic.id,
            },
          });
        }
      }
    }
    console.log("✅ Seeded Schedules");

    // 14) WorkOrders: 1 por incidente
    const incidents = await tx.incident.findMany({ include: { vic: true } });
    for (const inc of incidents) {
      const existingWO = await tx.workOrder.findFirst({
        where: { incidentId: inc.id },
        select: { id: true },
      });
      const assignee = users[0]; // puedes mejorar lógica de asignación
      if (!existingWO && assignee) {
        await tx.workOrder.create({
          data: {
            incidentId: inc.id,
            assignedToId: assignee.id,
            status: "PENDIENTE",
            notes: "Orden de trabajo generada automáticamente",
          },
        });
      }
    }
    console.log("✅ Seeded WorkOrders");

    // 15) WorkActivities: 2 por WorkOrder
    const workOrders = await tx.workOrder.findMany();
    for (const wo of workOrders) {
      for (let i = 1; i <= 2; i++) {
        const description = `Actividad ${i} de la orden ${wo.id}`;
        const exists = await tx.workActivity.findFirst({
          where: { workOrderId: wo.id, description },
          select: { id: true },
        });

        if (!exists) {
          await tx.workActivity.create({
            data: { workOrderId: wo.id, description },
          });
        }
      }
    }
    console.log("✅ Seeded WorkActivities");

    // 16) WorkOrderAttachments: 1 por WorkOrder
    for (const wo of workOrders) {
      const filename = "ejemplo.txt";
      const exists = await tx.workOrderAttachment.findFirst({
        where: { workOrderId: wo.id, filename },
        select: { id: true },
      });

      if (!exists) {
        await tx.workOrderAttachment.create({
          data: {
            workOrderId: wo.id,
            filename,
            filepath: "/uploads/ejemplo.txt",
            mimetype: "text/plain",
            size: 1234,
            description: "Archivo de prueba",
          },
        });
      }
    }
    console.log("✅ Seeded WorkOrderAttachments");

    // 17) WorkParts: 1 por WorkOrder
    const allParts = await tx.part.findMany();
    for (const wo of workOrders) {
      const existing = await tx.workPart.findFirst({
        where: { workOrderId: wo.id },
        select: { id: true },
      });
      if (existing) continue;

      const part = allParts[0];
      if (!part) continue;

      await tx.workPart.create({
        data: {
          partId: part.id,
          workOrderId: wo.id,
          quantity: 2,
          description: "Uso de refacción en orden (seed)",
          price: part.price,
        },
      });
    }
    console.log("✅ Seeded WorkParts");
  });

  console.log("🎉 Seed completado (transacción OK)");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
