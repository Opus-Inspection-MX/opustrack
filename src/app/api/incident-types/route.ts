import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * GET /api/incident-types
 * Obtiene todos los tipos de incidentes con paginación y búsqueda
 */
export const GET = withPermission(
  "incident-types:read",
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

      // Búsqueda por nombre o descripción
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      // Obtener total de registros
      const total = await prisma.incidentType.count({ where });

      // Obtener registros paginados
      const incidentTypes = await prisma.incidentType.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          name: "asc",
        },
        skip,
        take: limit,
      });

      return NextResponse.json({
        success: true,
        data: incidentTypes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching incident types:", error);
      return NextResponse.json(
        { error: "Error al obtener tipos de incidentes" },
        { status: 500 },
      );
    }
  },
);
