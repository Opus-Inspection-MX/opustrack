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
    const vicId = searchParams.get("vicId") || "";
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

    if (vicId) {
      where.vics = { some: { vicId, active: true } };
    }

    if (statusId) {
      where.statusId = parseInt(statusId, 10);
    }

    const total = await prisma.schedule.count({ where });

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        vics: {
          where: { active: true },
          include: {
            vic: {
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
 * Crea una nueva programación (acepta vicIds: string[]).
 */
export const POST = withPermission(
  "schedules:create",
  async (request, _user) => {
    try {
      const body = await request.json();
      const { title, description, scheduledAt, endDate, statusId, vicIds } =
        body;

      if (
        !title ||
        !scheduledAt ||
        !Array.isArray(vicIds) ||
        vicIds.length === 0
      ) {
        return NextResponse.json(
          {
            error: "Título, fecha programada y al menos un VIC son requeridos",
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
        await tx.scheduleVic.createMany({
          data: (vicIds as string[]).map((vicId) => ({
            scheduleId: created.id,
            vicId,
          })),
          skipDuplicates: true,
        });
        return tx.schedule.findUnique({
          where: { id: created.id },
          include: {
            vics: {
              where: { active: true },
              include: {
                vic: { select: { id: true, name: true, code: true } },
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
