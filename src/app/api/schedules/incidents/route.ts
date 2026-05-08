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
 * - vicId: opcional, filtrar por VIC específico
 */
export const GET = withPermission("schedules:read", async (request, _user) => {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const vicIdParam = searchParams.get("vicId");

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

    // Construir filtro
    const where: Prisma.IncidentWhereInput = {
      active: true,
      schedule: {
        scheduledAt: {
          gte: start,
          lte: end,
        },
        active: true,
      },
    };

    // Filtrar por VIC si se proporciona
    if (vicIdParam) {
      where.vicId = vicIdParam;
    }

    // Obtener incidentes con schedules en el rango
    const incidents = await prisma.incident.findMany({
      where,
      include: {
        type: true,
        status: true,
        vic: {
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
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            status: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
      orderBy: {
        schedule: {
          scheduledAt: "asc",
        },
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
