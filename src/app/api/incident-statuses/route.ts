import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * GET /api/incident-statuses
 * Obtiene todos los estados de incidentes con paginación y búsqueda
 */
export const GET = withPermission(
  "incident-status:read",
  async (request, _user) => {
    try {
      const { searchParams } = new URL(request.url);

      // Parámetros de paginación
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(searchParams.get("limit") || "10", 10);
      const skip = (page - 1) * limit;

      // Parámetros de búsqueda
      const search = searchParams.get("search") || "";

      // Construir el where clause
      const where: any = {
        active: true,
      };

      // Búsqueda por nombre
      if (search) {
        where.name = { contains: search, mode: "insensitive" };
      }

      // Obtener total de registros
      const total = await prisma.incidentStatus.count({ where });

      // Obtener registros paginados
      const incidentStatuses = await prisma.incidentStatus.findMany({
        where,
        select: {
          id: true,
          name: true,
          color: true,
          active: true,
        },
        orderBy: {
          name: "asc",
        },
        skip,
        take: limit,
      });

      return NextResponse.json({
        success: true,
        data: incidentStatuses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching incident statuses:", error);
      return NextResponse.json(
        { error: "Error al obtener estados de incidentes" },
        { status: 500 },
      );
    }
  },
);
