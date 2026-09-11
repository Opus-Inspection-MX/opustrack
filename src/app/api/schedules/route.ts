import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { getReportScope, scheduleScopeWhere } from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";

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
export const GET = withPermission("schedules:read", async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    const search = searchParams.get("search") || "";
    const clientId = searchParams.get("clientId") || "";
    const statusId = searchParams.get("statusId") || "";
    const fromRaw =
      searchParams.get("activeFrom") || searchParams.get("startDate") || "";
    const toRaw =
      searchParams.get("activeTo") || searchParams.get("endDate") || "";
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;

    const where: Prisma.ScheduleWhereInput = {
      active: true,
    };

    // Every filter rides its own AND branch next to the tenant scope (never
    // merged into a shared OR): spreading them into one object lets a
    // duplicate `OR` key silently replace the search or the scope.
    const and: Prisma.ScheduleWhereInput[] = [];
    const overlap = overlapWhere(from, to);
    if (overlap.AND) {
      and.push(...(Array.isArray(overlap.AND) ? overlap.AND : [overlap.AND]));
    }

    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // Tenant boundary (cross-cutting rule #4). A requested Client outside
    // the caller's scope is a 403, not an empty list.
    const scope = await getReportScope(user);
    if (clientId) {
      if (scope.clientIds !== null && !scope.clientIds.includes(clientId)) {
        return NextResponse.json(
          { error: "Sin acceso al Cliente solicitado" },
          { status: 403 },
        );
      }
      and.push({ clients: { some: { clientId, active: true } } });
    } else {
      const scopeWhere = scheduleScopeWhere(scope);
      if (Object.keys(scopeWhere).length > 0) and.push(scopeWhere);
    }

    if (statusId) {
      and.push({ statusId: parseInt(statusId, 10) });
    }
    if (and.length > 0) where.AND = and;

    const total = await prisma.schedule.count({ where });

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        clients: {
          where: { active: true },
          include: {
            client: {
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
    logger.error("Error fetching schedules:", error);
    return NextResponse.json(
      { error: "Error al obtener programaciones" },
      { status: 500 },
    );
  }
});

/**
 * POST /api/schedules
 * Crea una nueva programación (acepta clientIds: string[]).
 */
export const POST = withPermission(
  "schedules:create",
  async (request, _user) => {
    try {
      const body = await request.json();
      const { title, description, scheduledAt, endDate, statusId, clientIds } =
        body;

      // clientIds is optional: schedules created from "Asignación de Programación"
      // are no longer tied to a Client.
      const clientIdList: string[] = Array.isArray(clientIds) ? clientIds : [];

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
        if (clientIdList.length > 0) {
          await tx.scheduleClient.createMany({
            data: clientIdList.map((clientId) => ({
              scheduleId: created.id,
              clientId,
            })),
            skipDuplicates: true,
          });
        }
        return tx.schedule.findUnique({
          where: { id: created.id },
          include: {
            clients: {
              where: { active: true },
              include: {
                client: { select: { id: true, name: true, code: true } },
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
      logger.error("Error creating schedule:", error);
      return NextResponse.json(
        { error: "Error al crear programación" },
        { status: 500 },
      );
    }
  },
);
