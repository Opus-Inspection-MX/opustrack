import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { getReportScope } from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * GET /api/clientes
 * Obtiene todos los centros de verificación
 *
 * Scoped to the caller's Clientes (cross-cutting rule #4): anyone without
 * the cross-Cliente permission only sees their own centers. Fail closed — a
 * user with no assignments gets an empty list, not the whole catalog.
 */
export const GET = withPermission("clientes:read", async (_request, user) => {
  try {
    const scope = await getReportScope(user);

    const clientes = await prisma.cliente.findMany({
      where: {
        active: true,
        ...(scope.clienteIds === null ? {} : { id: { in: scope.clienteIds } }),
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
