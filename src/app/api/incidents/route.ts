import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { FALLBACK_INCIDENT_TYPE_NAME } from "@/lib/constants/incident-type";
import { prisma } from "@/lib/database/prisma.singleton";
import { INCIDENT_STATE } from "@/lib/state-machine/incident-machine";

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
        typeId,
        clienteId,
        scheduleId,
        lineId,
        equipmentId,
      } = body;

      // Validaciones
      if (!title || !description) {
        return NextResponse.json(
          { error: "Título y descripción son requeridos" },
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

      // State machine: every new incident starts at ABIERTO.
      // Any caller-provided statusId is ignored so the flow can't be skipped.
      const initialStatus = await prisma.incidentStatus.findUnique({
        where: { name: INCIDENT_STATE.ABIERTO },
        select: { id: true },
      });
      if (!initialStatus) {
        return NextResponse.json(
          {
            error: `Falta estado '${INCIDENT_STATE.ABIERTO}' en el catálogo`,
          },
          { status: 500 },
        );
      }

      // Crear incidente
      const incident = await prisma.incident.create({
        data: {
          title,
          description,
          typeId: resolvedTypeId,
          statusId: initialStatus.id,
          clienteId: clienteId || null,
          scheduleId: scheduleId || null,
          lineId: lineId ? parseInt(lineId, 10) : null,
          equipmentId: equipmentId ? parseInt(equipmentId, 10) : null,
          reportedById: user.id,
        },
        include: {
          type: true,
          status: true,
          cliente: {
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
    const clienteId = searchParams.get("clienteId");

    const where: Prisma.IncidentWhereInput = {
      active: true,
    };

    if (clienteId) {
      where.clienteId = clienteId;
    }

    const incidents = await prisma.incident.findMany({
      where,
      include: {
        type: true,
        status: true,
        cliente: {
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
