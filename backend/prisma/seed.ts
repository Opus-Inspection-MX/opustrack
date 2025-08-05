import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/libs/auth/hash';
const prisma = new PrismaClient();

async function main() {
  // Seed states with the states of Mexico
  const states = [
    { name: 'Aguascalientes', code: 'AGU' },
    { name: 'Baja California', code: 'BCN' },
    { name: 'Baja California Sur', code: 'BCS' },
    { name: 'Campeche', code: 'CAM' },
    { name: 'Chiapas', code: 'CHP' },
    { name: 'Chihuahua', code: 'CHH' },
    { name: 'Coahuila', code: 'COA' },
    { name: 'Colima', code: 'COL' },
    { name: 'Durango', code: 'DUR' },
    { name: 'Guanajuato', code: 'GUA' },
    { name: 'Guerrero', code: 'GRO' },
    { name: 'Hidalgo', code: 'HID' },
    { name: 'Jalisco', code: 'JAL' },
    { name: 'Mexico', code: 'MEX' },
    { name: 'Michoacán', code: 'MIC' },
    { name: 'Morelos', code: 'MOR' },
    { name: 'Nayarit', code: 'NAY' },
    { name: 'Nuevo León', code: 'NLE' },
    { name: 'Oaxaca', code: 'OAX' },
    { name: 'Puebla', code: 'PUE' },
    { name: 'Querétaro', code: 'QUE' },
    { name: 'Quintana Roo', code: 'ROO' },
    { name: 'San Luis Potosí', code: 'SLP' },
    { name: 'Sinaloa', code: 'SIN' },
    { name: 'Sonora', code: 'SON' },
    { name: 'Tabasco', code: 'TAB' },
    { name: 'Tamaulipas', code: 'TAM' },
    { name: 'Tlaxcala', code: 'TLA' },
    { name: 'Veracruz', code: 'VER' },
    { name: 'Yucatán', code: 'YUC' },
    { name: 'Zacatecas', code: 'ZAC' },
  ];
  const stateRecords: Awaited<ReturnType<typeof prisma.state.upsert>>[] = [];
  for (const state of states) {
    const stateRecord = await prisma.state.upsert({
      where: { name: state.name },
      update: {},
      create: { name: state.name, code: state.code },
    });
    stateRecords.push(stateRecord);
  }
  console.log('✅ Seeded States');

  // Seed UserStatus
  const userStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  const userStatusRecords: Awaited<
    ReturnType<typeof prisma.userStatus.upsert>
  >[] = [];
  for (const status of userStatuses) {
    const userStatus = await prisma.userStatus.upsert({
      where: { name: status },
      update: {},
      create: { name: status },
    });
    userStatusRecords.push(userStatus);
  }
  console.log('✅ Seeded UserStatuses');

  // Seed UserTypes
  const userTypes = [
    'USER_GUEST',
    'USER',
    'USER_WORKER',
    'USER_SYSTEM',
    'USER_ADMIN',
  ];

  const userTypeRecords: Awaited<ReturnType<typeof prisma.role.upsert>>[] = [];
  for (const name of userTypes) {
    const roles = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    userTypeRecords.push(roles);
  }
  console.log('✅ Seeded Roles');

  // Seed VehicleInspectionCenters
  for (const state of stateRecords) {
    await prisma.vehicleInspectionCenter.upsert({
      where: { code: `VIC${state.code}` },
      update: {},
      create: {
        code: `VIC${state.code}`,
        name: `Centro de Verificación ${state.name}`,
        address: `Dirección de ${state.name}`,
        phone: '555-000-0000',
        contact: 'Contacto General',
        rfc: 'RFC123456789',
        companyName: `Empresa ${state.name}`,
        stateId: state.id,
      },
    });
  }
  console.log('✅ Seeded VehicleInspectionCenters');

  // Seed Roles
  const roles = [
    'USER_GUEST',
    'USER',
    'USER_WORKER',
    'USER_SYSTEM',
    'USER_ADMIN',
  ];

  const roleRecords: Awaited<ReturnType<typeof prisma.role.upsert>>[] = [];
  for (const name of roles) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleRecords.push(role);
  }
  console.log('✅ Seeded Roles');

  // Seed Users for each Role
  for (const role of roleRecords) {
    let vicId: string | undefined = undefined;
    if (role.name === 'USER' || role.name === 'USER_GUEST') {
      const vic = await prisma.vehicleInspectionCenter.findFirst();
      vicId = vic?.id;
    }

    await prisma.user.upsert({
      where: { email: `${role.name.toLowerCase()}@opusinspection.com` },
      update: {},
      create: {
        name: `${role.name} User`,
        email: `${role.name.toLowerCase()}@opusinspection.com`,
        password: await hashPassword('password123'),
        roleId: role.id,
        userStatusId: userStatusRecords[0].id,
        ...(vicId ? { vicId } : {}),
      },
    });
  }
  console.log('✅ Seeded Users for each Role');

  // Seed IncidentTypes
  const incidentTypes = [
    { name: 'REPAIR', description: 'Repair incident' },
    { name: 'MAINTENANCE', description: 'Maintenance incident' },
    { name: 'OTHER', description: 'Other type of incident' },
  ];
  const incidentTypeRecords: Awaited<
    ReturnType<typeof prisma.incidentType.upsert>
  >[] = [];
  for (const type of incidentTypes) {
    const record = await prisma.incidentType.upsert({
      where: { name: type.name },
      update: {},
      create: type,
    });
    incidentTypeRecords.push(record);
  }
  console.log('✅ Seeded IncidentTypes');

  // Seed IncidentStatuses
  const incidentStatuses = ['OPEN', 'PENDING', 'IN_PROGRESS', 'CLOSED'];
  const incidentStatusRecords: Awaited<
    ReturnType<typeof prisma.incidentStatus.upsert>
  >[] = [];
  for (const name of incidentStatuses) {
    const record = await prisma.incidentStatus.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    incidentStatusRecords.push(record);
  }
  console.log('✅ Seeded IncidentStatuses');

  // Seed Parts for each VIC
  const vicRecords = await prisma.vehicleInspectionCenter.findMany();
  for (const vic of vicRecords) {
    for (let i = 1; i <= 3; i++) {
      await prisma.part.create({
        data: {
          name: `Part${i}-VIC${vic.code}`,
          description: `Part ${i} for ${vic.name}`,
          price: 100 * i,
          stock: 10 * i,
          vicId: vic.id,
        },
      });
    }
  }
  console.log('✅ Seeded Parts for each VIC');

  // Optionally, seed a sample Incident for each VIC
  for (const vic of vicRecords) {
    const reporter = await prisma.user.findFirst({ where: { vicId: vic.id } });
    if (!reporter) continue;
    await prisma.incident.upsert({
      where: { id: `incident-${vic.id}` },
      update: {},
      create: {
        id: `incident-${vic.id}`,
        title: `Sample Incident for ${vic.name}`,
        description: 'This is a seeded incident.',
        priority: 'HIGH',
        sla: 24,
        typeId: incidentTypeRecords[0].id,
        statusId: incidentStatusRecords[0].id,
        reportedAt: new Date(),
        vicId: vic.id,
        reportedById: reporter.id,
      },
    });
  }
  console.log('✅ Seeded Incidents for each VIC');

  // Seed Permissions
  const permissions = [
    { name: 'view_incident', description: 'Ver incidentes' },
    { name: 'create_incident', description: 'Crear incidentes' },
    { name: 'assign_incident', description: 'Asignar incidentes a técnicos' },
    { name: 'close_incident', description: 'Cerrar incidentes' },
    { name: 'view_users', description: 'Ver usuarios' },
    { name: 'edit_users', description: 'Editar usuarios' },
  ];
  const permissionRecords: Awaited<
    ReturnType<typeof prisma.permission.upsert>
  >[] = [];
  for (const perm of permissions) {
    const record = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
    permissionRecords.push(record);
  }
  console.log('✅ Seeded Permissions');
  const userPermissions = [
    'view_user',
    'create_user',
    'edit_user',
    'delete_user',
  ];
  const incidentPermissions = [
    'view_incident',
    'create_incident',
    'edit_incident',
    'delete_incident',
    'assign_incident',
    'close_incident',
  ];
  // Map permissions to roles
  const rolePermissionMap: Record<string, string[]> = {
    USER_GUEST: [],
    USER: ['view_incident', 'create_incident'],
    USER_WORKER: ['view_incident', 'close_incident', 'edit_incident'],
    USER_SYSTEM: [...incidentPermissions],
    USER_ADMIN: [...userPermissions, ...incidentPermissions],
  };

  for (const role of roleRecords) {
    const perms = rolePermissionMap[role.name] || [];
    for (const permName of perms) {
      const perm = permissionRecords.find((p) => p.name === permName);
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: perm.id,
        },
      });
    }
  }
  console.log('✅ Mapped Permissions to Roles');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
