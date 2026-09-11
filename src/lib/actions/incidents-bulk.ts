"use server";

import type { Prisma } from "@prisma/client";
import { IncidentEventType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { canAccessClientAsync } from "@/lib/auth/filters";
import {
  getReportScope,
  scheduleScopeWhere,
  scopeIncludesClient,
} from "@/lib/auth/report-scope";
import { whereHasRole } from "@/lib/authz/user-queries";
import { ROLE } from "@/lib/authz/roles";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  resolveTypeIdOrFallback,
  syncIncidentAssignees,
} from "@/lib/incidents/shared";
import { INCIDENT_STATE } from "@/lib/state-machine";
import { logIncidentEvent, toIso } from "@/lib/state-machine/incident-events";
import { parseMxDateTime } from "@/lib/utils/datetime";
import {
  BulkIncidentSnapshotRowSchema,
  parseAssigneeIds,
} from "@/lib/validations/incidents";

/**
 * Bulk incident subsystem: CSV ingest, editable preview, and bulk assign.
 *
 * Extracted from `actions/incidents.ts`, which stays the home of the
 * single-incident actions. No repository/DTO layer: these are Server Actions
 * with the same shape as the rest of the file, only housed separately so the
 * single-incident flows stay readable. Shared row-reconciliation lives in
 * `lib/incidents/shared.ts` (plain module, Phase-1 pattern).
 */

/**
 * Catalogs needed to fill the bulk-incident CSV.
 * Filters by user's Client access (admin sees all).
 */
export async function getBulkIncidentCatalogs() {
  const user = await requirePermission("incidents:create");
  const scope = await getReportScope(user);

  // Same rule as the incident form: linked schedules plus global ones, and a
  // fail-closed scope matches nothing.
  const scheduleWhere: Prisma.ScheduleWhereInput = {
    active: true,
    ...scheduleScopeWhere(scope),
  };

  const [types, statuses, clients, schedules, fsrs] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.incidentStatus.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.client.findMany({
      where: {
        active: true,
        ...(scope.clientIds === null ? {} : { id: { in: scope.clientIds } }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.schedule.findMany({
      where: scheduleWhere,
      orderBy: { scheduledAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        endDate: true,
        clients: {
          where: { active: true },
          select: { clientId: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true, ...whereHasRole(ROLE.FSR) },
      select: {
        id: true,
        name: true,
        email: true,
        clientAssignments: {
          where: { active: true },
          select: { clientId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const fsrUsers = fsrs.map((f) => ({
    id: f.id,
    name: f.name,
    email: f.email,
    clientIds: f.clientAssignments.map((va) => va.clientId),
  }));

  const schedulesWithClientIds = schedules.map((s) => ({
    id: s.id,
    title: s.title,
    scheduledAt: s.scheduledAt,
    endDate: s.endDate,
    clientIds: s.clients.map((v) => v.clientId),
  }));

  return {
    types,
    statuses,
    clients,
    schedules: schedulesWithClientIds,
    fsrs: fsrUsers,
  };
}

export type BulkIncidentError = {
  row: number;
  field?: string;
  message: string;
};

export type BulkIncidentResult =
  | { ok: true; created: number }
  | { ok: false; errors: BulkIncidentError[] };

const MAX_BULK_ROWS = 500;

/**
 * One row in the editable preview UI. Dates are ISO strings to survive the
 * client/server boundary cleanly. FK references carry both the raw text from
 * the CSV (for display when unresolved) and the resolved id (when found).
 */
export type EditablePreviewRow = {
  rowNumber: number;
  title: string;
  description: string;
  startedAt: string | null;
  resolvedAt: string | null;
  clientId: string | null;
  clientCodeRaw: string | null;
  clientResolved: boolean;
  typeId: number | null;
  typeNameRaw: string | null;
  typeResolved: boolean;
  assigneeIds: string[];
  fieldErrors: Record<string, string>;
  warnings?: Record<string, string>;
};

/**
 * Accent-fold + lowercase a string for forgiving lookup.
 * "Cénac" → "cenac", "Mantenimiento" → "mantenimiento".
 */
function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/") // normalize spacing around "/"
    .replace(/\s+/g, " ") // collapse repeated whitespace
    .trim();
}

export type ResolveBulkResult =
  | { ok: true; rows: EditablePreviewRow[] }
  | { ok: false; errors: BulkIncidentError[] };

function toIsoOrNull(d: Date | undefined | null): string | null {
  if (!d) return null;
  return d.toISOString();
}

/**
 * Validate + resolve raw CSV rows into editable preview rows.
 * Accepts either the legible "template" format (Spanish headers, client code, type name)
 * or the machine "snapshot" format (English headers, IDs). Does NOT write to DB.
 */
export async function resolveBulkIncidentRows(
  rawRows: unknown[],
  scheduleId: string | null,
  mode: "template" | "snapshot",
): Promise<ResolveBulkResult> {
  const user = await requirePermission("incidents:create");

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, message: "No hay filas para procesar" }],
    };
  }
  if (rawRows.length > MAX_BULK_ROWS) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message: `Máximo ${MAX_BULK_ROWS} filas por carga (recibidas: ${rawRows.length})`,
        },
      ],
    };
  }

  // Validate schedule access early. Caller must have access to at least one
  // of the schedule's Clients.
  const scope = await getReportScope(user);
  if (scheduleId) {
    const sched = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
      select: {
        id: true,
        clients: {
          where: { active: true },
          select: { clientId: true },
        },
      },
    });
    if (!sched) {
      return {
        ok: false,
        errors: [
          {
            row: 0,
            message: `Programación ${scheduleId} no existe o está inactiva`,
          },
        ],
      };
    }
    const accessible = sched.clients.some((v) =>
      scopeIncludesClient(scope, v.clientId),
    );
    if (!accessible) {
      return {
        ok: false,
        errors: [
          { row: 0, message: "Sin acceso a la programación seleccionada" },
        ],
      };
    }
  }

  // Catalogs for resolution.
  const [allTypes, allClients, allFsrs] = await Promise.all([
    prisma.incidentType.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
    prisma.client.findMany({
      where: {
        active: true,
        ...(scope.clientIds === null ? {} : { id: { in: scope.clientIds } }),
      },
      select: { id: true, code: true },
    }),
    prisma.user.findMany({
      where: { active: true, ...whereHasRole(ROLE.FSR) },
      select: { id: true },
    }),
  ]);

  const typesByName = new Map(
    allTypes.map((t) => [normalizeForMatch(t.name), t.id] as const),
  );
  const typesById = new Map(allTypes.map((t) => [t.id, t.name] as const));
  const clientsByCode = new Map(
    allClients.map((v) => [normalizeForMatch(v.code), v.id] as const),
  );
  const clientsById = new Set(allClients.map((v) => v.id));
  const validFsrIds = new Set(allFsrs.map((u) => u.id));

  const errors: BulkIncidentError[] = [];
  const resolved: EditablePreviewRow[] = [];

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const fieldErrors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    if (mode === "template") {
      // Tolerant per-field parsing: invalid/missing values do NOT discard the
      // row. They land in the preview marked with fieldErrors so the user can
      // fix them inline before saving.
      const obj = (raw ?? {}) as Record<string, unknown>;
      const getStr = (k: string): string => {
        const v = obj[k];
        return v == null ? "" : String(v).trim();
      };

      const title = getStr("titulo");
      const description = getStr("descripcion");
      const tipoRaw = getStr("tipo");
      const fechaInicioRaw = getStr("fecha_inicio");
      // Dual header: `client` (new) wins over legacy `cliente`. Both resolve
      // accent/case-insensitively through clientsByCode.
      const clientRawNew = getStr("client");
      const clientRawLegacy = getStr("cliente");
      const clientRaw = clientRawNew || clientRawLegacy;
      const clientField = clientRawNew ? "client" : "cliente";

      // Skip rows that look completely empty (typical trailing rows in Excel).
      if (
        title === "" &&
        description === "" &&
        tipoRaw === "" &&
        fechaInicioRaw === "" &&
        clientRaw === ""
      ) {
        return;
      }

      if (title.length < 3) {
        fieldErrors.titulo = "Título debe tener al menos 3 caracteres";
      }
      if (description.length < 1) {
        fieldErrors.descripcion = "Descripción es requerida";
      }

      let startedAt: Date | null = null;
      if (fechaInicioRaw) {
        const d = parseMxDateTime(fechaInicioRaw);
        if (!d) {
          fieldErrors.fecha_inicio = `Fecha inválida: "${fechaInicioRaw}"`;
        } else {
          startedAt = d;
        }
      }

      const clientCodeRaw = clientRaw || null;
      const clientId = clientCodeRaw
        ? (clientsByCode.get(normalizeForMatch(clientCodeRaw)) ?? null)
        : null;
      if (clientCodeRaw && !clientId) {
        fieldErrors[clientField] =
          `Cliente "${clientCodeRaw}" no encontrado — selecciona uno`;
      }

      // tipo vacío es válido (fallback a "Desconocido"). Un tipo NO vacío que
      // no existe en el catálogo es un ERROR visible: la fila no se puede
      // guardar hasta que el usuario seleccione el tipo correcto en el preview.
      const typeNameRaw = tipoRaw || null;
      const typeId = typeNameRaw
        ? (typesByName.get(normalizeForMatch(typeNameRaw)) ?? null)
        : null;
      const typeResolved = !typeNameRaw || typeId !== null;
      if (typeNameRaw && !typeId) {
        fieldErrors.tipo = `Tipo "${typeNameRaw}" no existe en el catálogo — selecciónalo`;
      }

      resolved.push({
        rowNumber,
        title,
        description,
        startedAt: toIsoOrNull(startedAt),
        resolvedAt: null,
        clientId,
        clientCodeRaw,
        clientResolved: clientId !== null,
        typeId,
        typeNameRaw,
        typeResolved,
        assigneeIds: [],
        fieldErrors,
        warnings: Object.keys(warnings).length > 0 ? warnings : undefined,
      });
      return;
    }

    // Snapshot mode — strict integrity check. Any per-field issue is
    // collected in `errors` and the row is dropped from `resolved`. The
    // caller short-circuits on first error so the user sees every problem
    // before anything is loaded into the preview.
    const parsed = BulkIncidentSnapshotRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".") || "_row";
        errors.push({ row: rowNumber, field, message: issue.message });
      }
      return;
    }
    const data = parsed.data;
    let rowOk = true;
    const clientId = data.clientId ?? null;
    if (!clientId) {
      errors.push({
        row: rowNumber,
        field: "clientId",
        message: "clientId requerido en snapshot",
      });
      rowOk = false;
    } else if (!clientsById.has(clientId)) {
      errors.push({
        row: rowNumber,
        field: "clientId",
        message: `Cliente ${clientId} no existe o no accesible`,
      });
      rowOk = false;
    }
    const typeId = data.typeId ?? null;
    if (typeId !== null && !typesById.has(typeId)) {
      errors.push({
        row: rowNumber,
        field: "typeId",
        message: `Tipo ${typeId} no existe`,
      });
      rowOk = false;
    }
    const assigneeIds = parseAssigneeIds(data.assigneeIds);
    for (const fsrId of assigneeIds) {
      if (!validFsrIds.has(fsrId)) {
        errors.push({
          row: rowNumber,
          field: "assigneeIds",
          message: `FSR ${fsrId} no existe o sin rol FSR`,
        });
        rowOk = false;
      }
    }
    if (data.startedAt && data.resolvedAt) {
      if (data.resolvedAt.getTime() < data.startedAt.getTime()) {
        errors.push({
          row: rowNumber,
          field: "resolvedAt",
          message: "resolvedAt no puede ser anterior a startedAt",
        });
        rowOk = false;
      }
    }
    if (rowOk) {
      resolved.push({
        rowNumber,
        title: data.title,
        description: data.description,
        startedAt: toIsoOrNull(data.startedAt),
        resolvedAt: toIsoOrNull(data.resolvedAt),
        clientId,
        clientCodeRaw: null,
        clientResolved: true,
        typeId,
        typeNameRaw: null,
        typeResolved: true,
        assigneeIds,
        fieldErrors,
      });
    }
  });

  // Snapshot is strict: any error blocks the preview entirely.
  if (mode === "snapshot" && errors.length > 0) {
    return { ok: false, errors };
  }
  if (errors.length > 0 && resolved.length === 0) {
    return { ok: false, errors };
  }
  return { ok: true, rows: resolved };
}

/**
 * Persist the edited preview rows. Each row is validated again server-side.
 * scheduleId comes from the page-level selector — applied to every row.
 * Rows with resolvedAt populated are created as CERRADO (historical import);
 * otherwise ABIERTO (state machine default).
 */
export async function createIncidentsFromPreview(
  rows: EditablePreviewRow[],
  scheduleId: string | null,
): Promise<BulkIncidentResult> {
  const user = await requirePermission("incidents:create");

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, message: "No hay filas para guardar" }],
    };
  }
  if (rows.length > MAX_BULK_ROWS) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message: `Máximo ${MAX_BULK_ROWS} filas (recibidas: ${rows.length})`,
        },
      ],
    };
  }

  // Resolve open/closed status IDs once.
  const [openStatus, closedStatus] = await Promise.all([
    prisma.incidentStatus.findUnique({
      where: { name: INCIDENT_STATE.ABIERTO },
      select: { id: true },
    }),
    prisma.incidentStatus.findUnique({
      where: { name: INCIDENT_STATE.CERRADO },
      select: { id: true },
    }),
  ]);
  if (!openStatus || !closedStatus) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message: "Estados ABIERTO/CERRADO no existen en el catálogo",
        },
      ],
    };
  }

  // Validate schedule + collect its Clients for per-row cross-check.
  const scope = await getReportScope(user);
  let scheduleClientIds: Set<string> | null = null;
  if (scheduleId) {
    const sched = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
      select: {
        id: true,
        clients: {
          where: { active: true },
          select: { clientId: true },
        },
      },
    });
    if (!sched) {
      return {
        ok: false,
        errors: [
          {
            row: 0,
            message: `Programación ${scheduleId} no existe o está inactiva`,
          },
        ],
      };
    }
    // A schedule without any active Clients is considered global (no Client
    // restriction). Only check access when there is at least one Client linked.
    const hasClients = sched.clients.length > 0;
    const accessible =
      !hasClients ||
      sched.clients.some((v) => scopeIncludesClient(scope, v.clientId));
    if (!accessible) {
      return {
        ok: false,
        errors: [
          { row: 0, message: "Sin acceso a la programación seleccionada" },
        ],
      };
    }
    scheduleClientIds = hasClients
      ? new Set(sched.clients.map((v) => v.clientId))
      : null;
  }

  // Catalogs for re-validation.
  const clientIds = [
    ...new Set(rows.map((r) => r.clientId).filter((v): v is string => !!v)),
  ];
  const typeIds = [
    ...new Set(
      rows.map((r) => r.typeId).filter((v): v is number => v !== null),
    ),
  ];
  const assigneeIds = [...new Set(rows.flatMap((r) => r.assigneeIds))];

  const [clientsExisting, typesExisting, fsrsExisting] = await Promise.all([
    clientIds.length
      ? prisma.client.findMany({
          where: { id: { in: clientIds }, active: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    typeIds.length
      ? prisma.incidentType.findMany({
          where: { id: { in: typeIds }, active: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    assigneeIds.length
      ? prisma.user.findMany({
          where: {
            id: { in: assigneeIds },
            active: true,
            ...whereHasRole(ROLE.FSR),
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);
  const validClients = new Set(clientsExisting.map((v) => v.id));
  const validTypes = new Set(typesExisting.map((t) => t.id));
  const validFsrs = new Set(fsrsExisting.map((u) => u.id));

  const errors: BulkIncidentError[] = [];
  rows.forEach((row) => {
    if (row.title.trim().length < 3) {
      errors.push({
        row: row.rowNumber,
        field: "title",
        message: "Título debe tener al menos 3 caracteres",
      });
    }
    if (row.description.trim().length < 1) {
      errors.push({
        row: row.rowNumber,
        field: "description",
        message: "Descripción es requerida",
      });
    }
    if (!row.clientId) {
      errors.push({
        row: row.rowNumber,
        field: "clientId",
        message: "Selecciona un Cliente para esta fila",
      });
    } else if (!validClients.has(row.clientId)) {
      errors.push({
        row: row.rowNumber,
        field: "clientId",
        message: `Cliente ${row.clientId} no existe o inactivo`,
      });
    } else if (!scopeIncludesClient(scope, row.clientId)) {
      errors.push({
        row: row.rowNumber,
        field: "clientId",
        message: "Sin acceso al Cliente seleccionado",
      });
    } else if (scheduleClientIds && !scheduleClientIds.has(row.clientId)) {
      errors.push({
        row: row.rowNumber,
        field: "clientId",
        message:
          "El Cliente de esta fila no está incluido en los Clientes de la programación seleccionada",
      });
    }
    if (row.typeId !== null && !validTypes.has(row.typeId)) {
      errors.push({
        row: row.rowNumber,
        field: "typeId",
        message: `Tipo ${row.typeId} no existe o inactivo`,
      });
    }
    for (const fsrId of row.assigneeIds) {
      if (!validFsrs.has(fsrId)) {
        errors.push({
          row: row.rowNumber,
          field: "assigneeIds",
          message: `FSR ${fsrId} no existe o sin rol FSR`,
        });
      }
    }
    if (row.startedAt && row.resolvedAt) {
      const start = new Date(row.startedAt).getTime();
      const end = new Date(row.resolvedAt).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
        errors.push({
          row: row.rowNumber,
          field: "resolvedAt",
          message:
            "Fecha de resolución no puede ser anterior a fecha de inicio",
        });
      }
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Pre-resuelve el typeId fallback una sola vez para todas las filas sin tipo.
  const fallbackTypeId = await resolveTypeIdOrFallback(null);

  // Rows with pre-selected FSRs get a real Assignment after the transaction
  // commits (see ensureFsrsAssignedToIncident) — skipped for historical
  // resolvedAt/CERRADO rows, which shouldn't be reopened into ASIGNADO.
  const pendingAssignments: Array<{
    incidentId: number;
    assigneeIds: string[];
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const incident = await tx.incident.create({
        data: {
          title: row.title.trim(),
          description: row.description.trim(),
          typeId: row.typeId ?? fallbackTypeId,
          statusId: row.resolvedAt ? closedStatus.id : openStatus.id,
          clientId: row.clientId,
          scheduleId,
          reportedById: user.id,
          startedAt: row.startedAt ? new Date(row.startedAt) : null,
          resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : null,
        },
      });
      if (row.assigneeIds.length > 0) {
        await tx.incidentAssignee.createMany({
          data: row.assigneeIds.map((userId) => ({
            incidentId: incident.id,
            userId,
          })),
          skipDuplicates: true,
        });
        if (!row.resolvedAt) {
          pendingAssignments.push({
            incidentId: incident.id,
            assigneeIds: row.assigneeIds,
          });
        }
      }
      // RF-219: one event per persisted row, in the same transaction. The
      // initial status + resolvedAt ride in the payload, so a historical
      // CERRADO row is recognizable to the silent-reopen guard. Assignee
      // grants ride along here instead of fanning out into ADDED events.
      await logIncidentEvent(tx, {
        incidentId: incident.id,
        eventType: IncidentEventType.BULK_IMPORTED,
        actorId: user.id,
        toStatus: row.resolvedAt
          ? INCIDENT_STATE.CERRADO
          : INCIDENT_STATE.ABIERTO,
        payload: {
          rowNumber: row.rowNumber,
          initialStatus: row.resolvedAt
            ? INCIDENT_STATE.CERRADO
            : INCIDENT_STATE.ABIERTO,
          resolvedAt: toIso(row.resolvedAt),
          assigneeIds: row.assigneeIds,
        },
      });
    }
  });

  if (pendingAssignments.length > 0) {
    const { ensureFsrsAssignedToIncident } = await import(
      "@/lib/assignments/ensure-fsrs"
    );
    for (const { incidentId, assigneeIds } of pendingAssignments) {
      await ensureFsrsAssignedToIncident(incidentId, assigneeIds);
    }
  }

  revalidatePath("/admin/incidents");
  revalidatePath("/reporter/incidents");
  return { ok: true, created: rows.length };
}

export type BulkAssignChanges = {
  /** undefined = no tocar; null = quitar la programación */
  scheduleId?: string | null;
  /** undefined = no tocar */
  clientId?: string;
  /** undefined = no tocar */
  fsrIds?: { ids: string[]; mode: "replace" | "append" };
};

export type BulkAssignResult =
  | { ok: true; updated: number }
  | {
      ok: false;
      errors: Array<{ incidentId: number; message: string }>;
    };

/**
 * Bulk-update a set of incidents in one call. Each change field is optional;
 * pass only what you want to modify. Validates everything per-row and rejects
 * the whole batch (transaction) if any row fails.
 */
export async function bulkAssignIncidents(
  incidentIds: number[],
  changes: BulkAssignChanges,
): Promise<BulkAssignResult> {
  const user = await requirePermission("incidents:update");

  if (!Array.isArray(incidentIds) || incidentIds.length === 0) {
    return {
      ok: false,
      errors: [{ incidentId: 0, message: "No hay incidentes seleccionados" }],
    };
  }
  if (
    changes.scheduleId === undefined &&
    changes.clientId === undefined &&
    changes.fsrIds === undefined
  ) {
    return {
      ok: false,
      errors: [{ incidentId: 0, message: "Nada que modificar" }],
    };
  }

  const incidents = await prisma.incident.findMany({
    where: { id: { in: incidentIds }, active: true },
    select: { id: true, clientId: true },
  });
  const found = new Set(incidents.map((i) => i.id));
  const errors: Array<{ incidentId: number; message: string }> = [];

  for (const id of incidentIds) {
    if (!found.has(id)) {
      errors.push({ incidentId: id, message: "Incidente no encontrado" });
    }
  }

  // Per-incident access check based on current Client.
  for (const inc of incidents) {
    if (!(await canAccessClientAsync(user, inc.clientId))) {
      errors.push({
        incidentId: inc.id,
        message: "Sin acceso al Cliente actual del incidente",
      });
    }
  }

  // Validate target Client (single value, applies to all selected).
  if (changes.clientId !== undefined) {
    const targetClient = await prisma.client.findFirst({
      where: { id: changes.clientId, active: true },
      select: { id: true },
    });
    if (!targetClient) {
      return {
        ok: false,
        errors: [
          { incidentId: 0, message: `Cliente ${changes.clientId} no existe` },
        ],
      };
    }
    if (!(await canAccessClientAsync(user, changes.clientId))) {
      return {
        ok: false,
        errors: [{ incidentId: 0, message: "Sin acceso al Cliente destino" }],
      };
    }
  }

  // Validate target schedule and its Clients.
  let scheduleClientIds: Set<string> | null = null;
  if (changes.scheduleId !== undefined && changes.scheduleId !== null) {
    const sched = await prisma.schedule.findFirst({
      where: { id: changes.scheduleId, active: true },
      select: {
        id: true,
        clients: { where: { active: true }, select: { clientId: true } },
      },
    });
    if (!sched) {
      return {
        ok: false,
        errors: [
          {
            incidentId: 0,
            message: `Programación ${changes.scheduleId} no existe`,
          },
        ],
      };
    }
    // Global schedules (no active Clients) impose no client restriction:
    // keep scheduleClientIds null so the truthy guard below skips the check.
    scheduleClientIds =
      sched.clients.length > 0
        ? new Set(sched.clients.map((v) => v.clientId))
        : null;
  }

  // Validate FSRs if any.
  if (changes.fsrIds && changes.fsrIds.ids.length > 0) {
    const fsrs = await prisma.user.findMany({
      where: {
        id: { in: changes.fsrIds.ids },
        active: true,
        ...whereHasRole(ROLE.FSR),
      },
      select: { id: true },
    });
    if (fsrs.length !== new Set(changes.fsrIds.ids).size) {
      return {
        ok: false,
        errors: [
          { incidentId: 0, message: "Uno o más FSR no existen o no son FSR" },
        ],
      };
    }
  }

  // Per-incident validation: schedule↔Client consistency.
  for (const inc of incidents) {
    const effectiveClient = changes.clientId ?? inc.clientId;
    if (
      scheduleClientIds &&
      effectiveClient &&
      !scheduleClientIds.has(effectiveClient)
    ) {
      errors.push({
        incidentId: inc.id,
        message:
          "El Cliente del incidente no está incluido en la programación seleccionada",
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Apply changes in a single transaction.
  await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (changes.scheduleId !== undefined) {
      updateData.scheduleId = changes.scheduleId;
    }
    if (changes.clientId !== undefined) {
      updateData.clientId = changes.clientId;
    }
    if (Object.keys(updateData).length > 0) {
      await tx.incident.updateMany({
        where: { id: { in: [...found] } },
        data: updateData,
      });
    }
  });

  // FSR sync runs outside the transaction to keep behavior identical to
  // updateIncident (and to surface per-incident retire-blocked errors).
  if (changes.fsrIds) {
    const { ensureFsrsAssignedToIncident } = await import(
      "@/lib/assignments/ensure-fsrs"
    );
    const failures: Array<{ incidentId: number; message: string }> = [];
    for (const id of found) {
      try {
        let toAdd: string[];
        if (changes.fsrIds.mode === "replace") {
          ({ toAdd } = await syncIncidentAssignees(id, changes.fsrIds.ids, {
            actorId: user.id,
          }));
        } else {
          const current = await prisma.incidentAssignee.findMany({
            where: { incidentId: id, active: true },
            select: { userId: true },
          });
          const merged = new Set([
            ...current.map((c) => c.userId),
            ...changes.fsrIds.ids,
          ]);
          ({ toAdd } = await syncIncidentAssignees(id, [...merged], {
            actorId: user.id,
          }));
        }
        // Give newly-enabled FSRs a real Assignment they can see (see
        // ensureFsrsAssignedToIncident) instead of eligibility-only + notification.
        if (toAdd.length > 0) {
          await ensureFsrsAssignedToIncident(id, toAdd);
        }
      } catch (e) {
        failures.push({
          incidentId: id,
          message: e instanceof Error ? e.message : "Error al actualizar FSRs",
        });
      }
    }
    if (failures.length > 0) {
      return { ok: false, errors: failures };
    }
  }

  revalidatePath("/admin/incidents");
  revalidatePath("/admin/programacion");
  return { ok: true, updated: found.size };
}
