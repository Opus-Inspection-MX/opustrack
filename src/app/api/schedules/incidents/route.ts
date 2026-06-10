import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * GET /api/schedules/incidents
 * Obtiene incidentes con fecha de inicio (scheduleId) en un rango de fechas
 * Query params:
 * - start: fecha de inicio (ISO string)
 * - end: fecha de fin (ISO string)
 * - clienteId: opcional, filtrar por Cliente específico
 */
export const GET = withPermission("schedules:read", async (request, _user) => {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const clienteIdParam = searchParams.get("clienteId");

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: "Los parámetros 'start' y 'end' son requeridos" },
        { status: 400 },
      );
    }

    const start = new Date(startParam);
    const end = new Date(endParam);

    // Validar fechas
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Formato de fecha inválido. Use ISO 8601 (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    // Construir filtro: incidencias cuyo schedule se solapa con el rango
    // (scheduledAt <= end AND (endDate ?? scheduledAt) >= start), OR
    // incidencias sin programación reportadas dentro del rango.
    const where: Prisma.IncidentWhereInput = {
      active: true,
      OR: [
        {
          schedule: {
            active: true,
            scheduledAt: { lte: end },
            OR: [
              { endDate: { gte: start } },
              { endDate: null, scheduledAt: { gte: start } },
            ],
          },
        },
        {
          scheduleId: null,
          reportedAt: { gte: start, lte: end },
        },
      ],
    };

    // Filtrar por Cliente si se proporciona
    if (clienteIdParam) {
      where.clienteId = clienteIdParam;
    }

    // Obtener incidentes con schedules en el rango
    const incidents = await prisma.incident.findMany({
      where,
      include: {
        type: true,
        status: true,
        cliente: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        schedule: {
          select: {
            id: true,
            title: true,
            description: true,
            scheduledAt: true,
            endDate: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        line: {
          select: {
            id: true,
            name: true,
          },
        },
        equipment: {
          select: {
            id: true,
            name: true,
          },
        },
        assignments: {
          where: {
            active: true,
          },
          select: {
            id: true,
            folio: true,
            assignees: {
              where: { active: true },
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            status: true,
            startedAt: true,
            finishedAt: true,
          },
        },
        assignees: {
          where: { active: true },
          select: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: {
            assignees: { where: { active: true } },
          },
        },
      },
      orderBy: {
        reportedAt: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      data: incidents,
      count: incidents.length,
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching scheduled incidents:", error);
    return NextResponse.json(
      { error: "Error al obtener incidentes programados" },
      { status: 500 },
    );
  }
});
