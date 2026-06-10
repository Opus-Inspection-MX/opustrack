import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * Build an overlap filter so we return schedules whose [scheduledAt, endDate]
 * intersects [from, to]. Schedules with null endDate are treated as point-in-time.
 */
function overlapWhere(
  from: Date | null,
  to: Date | null,
): Prisma.ScheduleWhereInput {
  const conditions: Prisma.ScheduleWhereInput[] = [];
  if (to) conditions.push({ scheduledAt: { lte: to } });
  if (from) {
    conditions.push({
      OR: [
        { endDate: { gte: from } },
        { endDate: null, scheduledAt: { gte: from } },
      ],
    });
  }
  return conditions.length ? { AND: conditions } : {};
}

/**
 * GET /api/schedules
 * Obtiene programaciones con filtros. startDate/endDate (o activeFrom/activeTo)
 * usan overlap contra [scheduledAt, endDate] del schedule.
 */
export const GET = withPermission("schedules:read", async (request, _user) => {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    const search = searchParams.get("search") || "";
    const clienteId = searchParams.get("clienteId") || "";
    const statusId = searchParams.get("statusId") || "";
    const fromRaw =
      searchParams.get("activeFrom") || searchParams.get("startDate") || "";
    const toRaw =
      searchParams.get("activeTo") || searchParams.get("endDate") || "";
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;

    const where: Prisma.ScheduleWhereInput = {
      active: true,
      ...overlapWhere(from, to),
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (clienteId) {
      where.clientes = { some: { clienteId, active: true } };
    }

    if (statusId) {
      where.statusId = parseInt(statusId, 10);
    }

    const total = await prisma.schedule.count({ where });

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        clientes: {
          where: { active: true },
          include: {
            cliente: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        status: {
          select: { id: true, name: true, color: true },
        },
        _count: {
          select: { incidents: true },
        },
      },
      orderBy: { scheduledAt: "desc" },
      skip,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: schedules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json(
      { error: "Error al obtener programaciones" },
      { status: 500 },
    );
  }
});

/**
 * POST /api/schedules
 * Crea una nueva programación (acepta clienteIds: string[]).
 */
export const POST = withPermission(
  "schedules:create",
  async (request, _user) => {
    try {
      const body = await request.json();
      const { title, description, scheduledAt, endDate, statusId, clienteIds } =
        body;

      // clienteIds is optional: schedules created from "Asignación de Programación"
      // are no longer tied to a Cliente.
      const clienteIdList: string[] = Array.isArray(clienteIds)
        ? clienteIds
        : [];

      if (!title || !scheduledAt) {
        return NextResponse.json(
          {
            error: "Título y fecha programada son requeridos",
          },
          { status: 400 },
        );
      }

      const schedule = await prisma.$transaction(async (tx) => {
        const created = await tx.schedule.create({
          data: {
            title,
            description: description || null,
            scheduledAt: new Date(scheduledAt),
            endDate: endDate ? new Date(endDate) : null,
            statusId: statusId ? parseInt(statusId, 10) : null,
          },
        });
        if (clienteIdList.length > 0) {
          await tx.scheduleCliente.createMany({
            data: clienteIdList.map((clienteId) => ({
              scheduleId: created.id,
              clienteId,
            })),
            skipDuplicates: true,
          });
        }
        return tx.schedule.findUnique({
          where: { id: created.id },
          include: {
            clientes: {
              where: { active: true },
              include: {
                cliente: { select: { id: true, name: true, code: true } },
              },
            },
            status: { select: { id: true, name: true, color: true } },
          },
        });
      });

      return NextResponse.json({
        success: true,
        data: schedule,
        message: "Programación creada exitosamente",
      });
    } catch (error) {
      console.error("Error creating schedule:", error);
      return NextResponse.json(
        { error: "Error al crear programación" },
        { status: 500 },
      );
    }
  },
);
