import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { createIncident } from "@/lib/actions/incidents";
import { BusinessRuleError } from "@/lib/actions/result";
import { assertBelongsToClient } from "@/lib/auth/access";
import { withPermission } from "@/lib/auth/auth";
import {
  getReportScope,
  incidentScopeWhere,
  withScope,
} from "@/lib/auth/report-scope";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";
import { intIdSchema } from "@/lib/validations/common";
import { IncidentCreateSchema } from "@/lib/validations/incidents";

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
        clientId,
        scheduleId,
        lineId,
        equipmentId,
      } = body;

      const payload = IncidentCreateSchema.extend({
        lineId: intIdSchema.nullable().optional(),
        equipmentId: intIdSchema.nullable().optional(),
      }).safeParse({
        ...body,
        title,
        description,
        typeId: typeId == null || typeId === "" ? undefined : Number(typeId),
        lineId: lineId == null || lineId === "" ? undefined : Number(lineId),
        equipmentId:
          equipmentId == null || equipmentId === ""
            ? undefined
            : Number(equipmentId),
        reportedById: undefined,
      });
      if (!payload.success) {
        return NextResponse.json(
          {
            error: payload.error.issues
              .map((issue) => issue.message)
              .join("; "),
          },
          { status: 400 },
        );
      }

      // Tenant boundary, same as GET: a caller cannot file an incident under
      // a Client outside their scope (the form only offers in-scope
      // Clients, but the endpoint must not trust that).
      if (clientId) {
        const scope = await getReportScope(user);
        if (scope.clientIds !== null && !scope.clientIds.includes(clientId)) {
          return NextResponse.json(
            { error: "Sin acceso al Cliente solicitado" },
            { status: 403 },
          );
        }
      }

      // Cross-references arrive from the client: the line, equipment and
      // schedule must belong to the incident's Client (H-04). A mismatch
      // answers 404 so it never confirms another Client's rows exist.
      await assertBelongsToClient(
        {
          lineId: lineId ? parseInt(lineId, 10) : null,
          equipmentId: equipmentId ? parseInt(equipmentId, 10) : null,
          scheduleId: scheduleId || null,
        },
        clientId || null,
      );
      const result = await createIncident(payload.data);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        data: result.data,
        message: "Incidente creado exitosamente",
      });
    } catch (error) {
      if (error instanceof BusinessRuleError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      logger.error("Error creating incident:", error);
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
export const GET = withPermission("incidents:read", async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    const baseWhere: Prisma.IncidentWhereInput = {
      active: true,
    };

    // Tenant boundary (cross-cutting rule #4). A requested Client outside
    // the caller's scope is rejected instead of silently returning rows the
    // caller must never see — or an empty list that hides the denial.
    // The scope composes via AND, never Object.assign: a later spread would
    // let a duplicate key replace the scope (or vice versa).
    const scope = await getReportScope(user);
    let where = baseWhere;
    if (clientId) {
      if (scope.clientIds !== null && !scope.clientIds.includes(clientId)) {
        return NextResponse.json(
          { error: "Sin acceso al Cliente solicitado" },
          { status: 403 },
        );
      }
      where = { ...baseWhere, clientId };
    } else {
      where = withScope(baseWhere, incidentScopeWhere(scope));
    }

    const incidents = await prisma.incident.findMany({
      where,
      include: {
        type: true,
        status: true,
        client: {
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
    logger.error("Error fetching incidents:", error);
    return NextResponse.json(
      { error: "Error al obtener incidentes" },
      { status: 500 },
    );
  }
});
