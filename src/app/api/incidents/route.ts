import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { BusinessRuleError } from "@/lib/actions/result";
import { assertBelongsToClient } from "@/lib/auth/access";
import { withPermission } from "@/lib/auth/auth";
import {
  getReportScope,
  incidentScopeWhere,
  withScope,
} from "@/lib/auth/report-scope";
import { FALLBACK_INCIDENT_TYPE_NAME } from "@/lib/constants/incident-type";
import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";
import { INCIDENT_STATE } from "@/lib/state-machine/incident-machine";

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

      // Validaciones
      if (!title || !description) {
        return NextResponse.json(
          { error: "Título y descripción son requeridos" },
          { status: 400 },
        );
      }

      // typeId NOT NULL — fallback al tipo "Desconocido" si no viene.
      let resolvedTypeId: number | null = typeId ? parseInt(typeId, 10) : null;
      if (!resolvedTypeId) {
        const fallback = await prisma.incidentType.findUnique({
          where: { name: FALLBACK_INCIDENT_TYPE_NAME },
          select: { id: true },
        });
        if (!fallback) {
          return NextResponse.json(
            { error: "Falta tipo 'Desconocido' en el catálogo" },
            { status: 500 },
          );
        }
        resolvedTypeId = fallback.id;
      }

      // State machine: every new incident starts at ABIERTO.
      // Any caller-provided statusId is ignored so the flow can't be skipped.
      const initialStatus = await prisma.incidentStatus.findUnique({
        where: { code: INCIDENT_STATE.ABIERTO },
        select: { id: true },
      });
      if (!initialStatus) {
        return NextResponse.json(
          {
            error: `Falta estado '${INCIDENT_STATE.ABIERTO}' en el catálogo`,
          },
          { status: 500 },
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
      try {
        await assertBelongsToClient(
          {
            lineId: lineId ? parseInt(lineId, 10) : null,
            equipmentId: equipmentId ? parseInt(equipmentId, 10) : null,
            scheduleId: scheduleId || null,
          },
          clientId || null,
        );
      } catch (error) {
        if (error instanceof BusinessRuleError) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        throw error;
      }

      // Crear incidente
      const incident = await prisma.incident.create({
        data: {
          title,
          description,
          typeId: resolvedTypeId,
          statusId: initialStatus.id,
          clientId: clientId || null,
          scheduleId: scheduleId || null,
          lineId: lineId ? parseInt(lineId, 10) : null,
          equipmentId: equipmentId ? parseInt(equipmentId, 10) : null,
          reportedById: user.id,
        },
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
      });

      return NextResponse.json({
        success: true,
        data: incident,
        message: "Incidente creado exitosamente",
      });
    } catch (error) {
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
