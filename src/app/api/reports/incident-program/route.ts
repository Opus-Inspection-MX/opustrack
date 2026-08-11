import type { NextRequest } from "next/server";
import { getIncidentProgramReport } from "@/lib/actions/incident-program";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  renderIncidentProgramWorkbook,
  workbookFileName,
} from "@/lib/reports/incident-program/excel";

/** ExcelJS needs the Node runtime; it is not Edge-compatible. */
export const runtime = "nodejs";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a positive integer query param; returns undefined when absent/invalid. */
function parseIdParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Plaza name used to label the download. Read directly rather than through
 * `getStatesForSelect` so exporting does not additionally require
 * `states:read` — the caller is already gated on `reports:export`.
 */
async function getStateNameForFileName(
  stateId: number,
): Promise<string | null> {
  const state = await prisma.state.findUnique({
    where: { id: stateId },
    select: { name: true },
  });
  return state?.name ?? null;
}

/**
 * GET /api/reports/incident-program
 *   ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *   [&scheduleIds=a,b,c][&stateId=...][&clienteId=...]
 *
 * Streams the incident workbook for the requested range, using the operation's
 * pre-existing Excel layout.
 */
export async function GET(request: NextRequest) {
  await requirePermission("reports:export");

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (
    !startDate ||
    !endDate ||
    !DATE_PATTERN.test(startDate) ||
    !DATE_PATTERN.test(endDate)
  ) {
    return Response.json(
      {
        error:
          "Los parámetros 'startDate' y 'endDate' son requeridos con formato YYYY-MM-DD.",
      },
      { status: 400 },
    );
  }

  if (startDate > endDate) {
    return Response.json(
      { error: "'startDate' no puede ser posterior a 'endDate'." },
      { status: 400 },
    );
  }

  const clienteId = searchParams.get("clienteId") || undefined;
  const stateId = parseIdParam(searchParams.get("stateId"));
  const scheduleIds =
    searchParams
      .get("scheduleIds")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? undefined;

  const [report, plaza] = await Promise.all([
    getIncidentProgramReport({
      startDate,
      endDate,
      scheduleIds,
      stateId,
      clienteId,
    }),
    stateId ? getStateNameForFileName(stateId) : Promise.resolve(null),
  ]);

  const buffer = await renderIncidentProgramWorkbook(report);
  const filename = workbookFileName(startDate, endDate, plaza);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
