import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { getReportScope } from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";

/**
 * GET /api/clients
 * Obtiene todos los centros de verificación
 *
 * Scoped to the caller's Clients (cross-cutting rule #4): anyone without
 * the cross-Client permission only sees their own centers. Fail closed — a
 * user with no assignments gets an empty list, not the whole catalog.
 */
export const GET = withPermission("clients:read", async (_request, user) => {
  try {
    const scope = await getReportScope(user);

    const clients = await prisma.client.findMany({
      where: {
        active: true,
        ...(scope.clientIds === null ? {} : { id: { in: scope.clientIds } }),
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
      data: clients,
      count: clients.length,
    });
  } catch (error) {
    logger.error("Error fetching Clientes:", error);
    return NextResponse.json(
      { error: "Error al obtener centros de verificación" },
      { status: 500 },
    );
  }
});
