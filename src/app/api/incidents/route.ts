import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { FALLBACK_INCIDENT_TYPE_NAME } from "@/lib/constants/incident-type";
import { withPermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * POST /api/incidents
 * Crea un nuevo incidente
 */
export const POST = withPermission(
  "incidents:create",
  async (request, user) => {
    try {
      const body = await request.json();
      const {
        title,
        description,
        priority,
        typeId,
        statusId,
        vicId,
        scheduleId,
        lineId,
        equipmentId,
      } = body;

      // Validaciones
      if (!title || !description || priority === undefined) {
        return NextResponse.json(
          { error: "Título, descripción y prioridad son requeridos" },
          { status: 400 },
        );
      }

      // typeId NOT NULL — fallback al tipo "Desconocido" si no viene.
      let resolvedTypeId: number | null = typeId ? parseInt(typeId, 10) : null;
      if (!resolvedTypeId) {
        const fallback = await prisma.incidentType.findUnique({
          where: { name: FALLBACK_INCIDENT_TYPE_NAME },
          select: { id: true },
        });
        if (!fallback) {
          return NextResponse.json(
            { error: "Falta tipo 'Desconocido' en el catálogo" },
            { status: 500 },
          );
        }
        resolvedTypeId = fallback.id;
      }

      // Crear incidente
      const incident = await prisma.incident.create({
        data: {
          title,
          description,
          priority: parseInt(priority, 10),
          typeId: resolvedTypeId,
          statusId: statusId ? parseInt(statusId, 10) : null,
          vicId: vicId || null,
          scheduleId: scheduleId || null,
          lineId: lineId ? parseInt(lineId, 10) : null,
          equipmentId: equipmentId ? parseInt(equipmentId, 10) : null,
          reportedById: user.id,
        },
        include: {
          type: true,
          status: true,
          vic: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          schedule: {
            select: {
              id: true,
              title: true,
              scheduledAt: true,
            },
          },
          reportedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: incident,
        message: "Incidente creado exitosamente",
      });
    } catch (error) {
      console.error("Error creating incident:", error);
      return NextResponse.json(
        { error: "Error al crear incidente" },
        { status: 500 },
      );
    }
  },
);

/**
 * GET /api/incidents
 * Obtiene todos los incidentes
 */
export const GET = withPermission("incidents:read", async (request, _user) => {
  try {
    const { searchParams } = new URL(request.url);
    const vicId = searchParams.get("vicId");

    const where: Prisma.IncidentWhereInput = {
      active: true,
    };

    if (vicId) {
      where.vicId = vicId;
    }

    const incidents = await prisma.incident.findMany({
      where,
      include: {
        type: true,
        status: true,
        vic: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        schedule: {
          select: {
            id: true,
            title: true,
            scheduledAt: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        reportedAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: incidents,
      count: incidents.length,
    });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return NextResponse.json(
      { error: "Error al obtener incidentes" },
      { status: 500 },
    );
  }
});
