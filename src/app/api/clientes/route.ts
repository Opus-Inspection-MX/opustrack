import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * GET /api/clientes
 * Obtiene todos los centros de verificación
 */
export const GET = withPermission("clientes:read", async (_request, _user) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        contact: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      data: clientes,
      count: clientes.length,
    });
  } catch (error) {
    console.error("Error fetching Clientes:", error);
    return NextResponse.json(
      { error: "Error al obtener centros de verificación" },
      { status: 500 },
    );
  }
});
