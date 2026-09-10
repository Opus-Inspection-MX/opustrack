import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { getReportScope, incidentScopeWhere } from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * GET /api/schedules/incidents
 * Obtiene incidentes con fecha de inicio (scheduleId) en un rango de fechas
 * Query params:
 * - start: fecha de inicio (ISO string)
 * - end: fecha de fin (ISO string)
 * - clienteId: opcional, filtrar por Cliente específico
 */
export const GET = withPermission("schedules:read", async (request, user) => {
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

    // Tenant boundary (cross-cutting rule #4). A requested Cliente outside
    // the caller's scope is a 403, not an empty calendar.
    const scope = await getReportScope(user);
    if (clienteIdParam) {
      if (
        scope.clienteIds !== null &&
        !scope.clienteIds.includes(clienteIdParam)
      ) {
        return NextResponse.json(
          { error: "Sin acceso al Cliente solicitado" },
          { status: 403 },
        );
      }
      where.clienteId = clienteIdParam;
    } else {
      Object.assign(where, incidentScopeWhere(scope));
    }

    // `?signature=1` responde "¿cambió algo?" sin traer las filas: cuatro
    // agregados en lugar del findMany anidado completo. La pantalla lo consulta
    // cada 30 s y solo recarga de verdad cuando la respuesta cambia.
    //
    // Vive dentro de esta ruta a propósito: comparte el mismo `where` que la
    // consulta real, así la firma no puede quedar hablando de otro conjunto de
    // filas que el que se muestra.
    if (searchParams.get("signature") === "1") {
      const [incidents, assignments] = await Promise.all([
        prisma.incident.aggregate({
          where,
          _count: { _all: true },
          _max: { updatedAt: true },
        }),
        // Asignar un FSR o cerrar el trabajo toca la Asignación, nunca la fila
        // del Incidente: sin esta mitad la firma se quedaría quieta justo en
        // los cambios que importan.
        prisma.assignment.aggregate({
          where: { active: true, incident: where },
          _count: { _all: true },
          _max: { updatedAt: true },
        }),
      ]);

      return NextResponse.json({
        success: true,
        signature: [
          incidents._count._all,
          incidents._max.updatedAt?.getTime() ?? 0,
          assignments._count._all,
          assignments._max.updatedAt?.getTime() ?? 0,
        ].join(":"),
      });
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
