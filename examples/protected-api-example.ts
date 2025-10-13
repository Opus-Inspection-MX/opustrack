// Example: Protected API Routes with Permission Checks
// Location: src/app/api/example/route.ts

import { NextRequest } from "next/server";
import {
  withAuth,
  withPermission,
  withAction,
  requireAuth,
  requirePermission,
  requireAction,
} from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

// Method 1: Using wrapper functions (Recommended)

// Basic auth wrapper
export const GET = withAuth(async (req, user) => {
  // user is authenticated
  return Response.json({
    message: "Authenticated",
    user: {
      id: user.id,
      name: user.name,
      role: user.role.name,
    },
  });
});

// Permission wrapper
export const POST = withPermission("incidents:create", async (req, user) => {
  // user has "incidents:create" permission
  const body = await req.json();

  const incident = await prisma.incident.create({
    data: {
      ...body,
      reportedById: user.id,
    },
  });

  return Response.json({ incident });
});

// Action wrapper
export const PUT = withAction("incidents", "update", async (req, user) => {
  // user can perform "update" action on "incidents" resource
  const body = await req.json();

  const incident = await prisma.incident.update({
    where: { id: body.id },
    data: body,
  });

  return Response.json({ incident });
});

// Method 2: Manual checks (Alternative)

export async function PATCH(req: NextRequest) {
  try {
    // Check authentication
    const user = await requireAuth();

    // Check specific permission
    await requirePermission("incidents:delete");

    // Or check resource action
    // await requireAction("incidents", "delete");

    const body = await req.json();

    await prisma.incident.delete({
      where: { id: body.id },
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

// Method 3: Complex authorization logic

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Custom logic: Users can only delete their own incidents (unless admin)
    const body = await req.json();
    const incident = await prisma.incident.findUnique({
      where: { id: body.id },
    });

    if (!incident) {
      return Response.json({ error: "Incident not found" }, { status: 404 });
    }

    // Check if user is admin or incident owner
    const isAdmin = user.role.name === "ADMINISTRADOR";
    const isOwner = incident.reportedById === user.id;

    if (!isAdmin && !isOwner) {
      return Response.json(
        { error: "You can only delete your own incidents" },
        { status: 403 }
      );
    }

    await prisma.incident.delete({
      where: { id: body.id },
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}
