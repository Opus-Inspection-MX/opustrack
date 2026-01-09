import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * GET /api/schedules
 * Obtiene todas las programaciones con paginación, búsqueda y filtros
 */
export const GET = withPermission("schedules:read", async (request, _user) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parámetros de paginación
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // Parámetros de búsqueda y filtros
    const search = searchParams.get("search") || "";
    const vicId = searchParams.get("vicId") || "";
    const statusId = searchParams.get("statusId") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    // Construir el where clause
    const where: any = {
      active: true,
    };

    // Búsqueda por título o descripción
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filtro por VIC
    if (vicId) {
      where.vicId = vicId;
    }

    // Filtro por status
    if (statusId) {
      where.statusId = parseInt(statusId, 10);
    }

    // Filtro por rango de fechas
    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) {
        where.scheduledAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.scheduledAt.lte = new Date(endDate);
      }
    }

    // Obtener total de registros
    const total = await prisma.schedule.count({ where });

    // Obtener registros paginados
    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        vic: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        status: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            incidents: true,
          },
        },
      },
      orderBy: {
        scheduledAt: "desc",
      },
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
 * Crea una nueva programación
 */
export const POST = withPermission(
  "schedules:create",
  async (request, _user) => {
    try {
      const body = await request.json();
      const { title, description, scheduledAt, endDate, statusId, vicId } =
        body;

      // Validaciones
      if (!title || !scheduledAt || !vicId) {
        return NextResponse.json(
          { error: "Título, fecha programada y VIC son requeridos" },
          { status: 400 },
        );
      }

      // Crear schedule
      const schedule = await prisma.schedule.create({
        data: {
          title,
          description: description || null,
          scheduledAt: new Date(scheduledAt),
          endDate: endDate ? new Date(endDate) : null,
          statusId: statusId ? parseInt(statusId, 10) : null,
          vicId,
        },
        include: {
          vic: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          status: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
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
