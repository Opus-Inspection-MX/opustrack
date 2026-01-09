import { NextResponse } from "next/server";
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
        sla,
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

      // Crear incidente
      const incident = await prisma.incident.create({
        data: {
          title,
          description,
          priority: parseInt(priority, 10),
          sla: sla ? parseInt(sla, 10) : 24,
          typeId: typeId ? parseInt(typeId, 10) : null,
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

    const where: any = {
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
