import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

/**
 * GET /api/vics
 * Obtiene todos los centros de verificación
 */
export const GET = withPermission("vics:read", async (_request, _user) => {
  try {
    const vics = await prisma.vehicleInspectionCenter.findMany({
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
      data: vics,
      count: vics.length,
    });
  } catch (error) {
    console.error("Error fetching VICs:", error);
    return NextResponse.json(
      { error: "Error al obtener centros de verificación" },
      { status: 500 },
    );
  }
});
