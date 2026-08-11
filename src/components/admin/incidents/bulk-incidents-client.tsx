"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Save,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createIncidentsFromPreview,
  type EditablePreviewRow,
  resolveBulkIncidentRows,
} from "@/lib/actions/incidents";
import { excelDateCell, excelDateToWallClock } from "@/lib/utils/datetime";

type Catalogs = {
  types: Array<{ id: number; name: string }>;
  statuses: Array<{ id: number; name: string; color: string }>;
  clientes: Array<{ id: string; name: string; code: string }>;
  schedules: Array<{
    id: string;
    title: string;
    scheduledAt: Date;
    endDate: Date | null;
    clienteIds: string[];
  }>;
  fsrs: Array<{
    id: string;
    name: string;
    email: string;
    clienteIds: string[];
  }>;
};

const TEMPLATE_HEADERS = [
  "titulo",
  "descripcion",
  "tipo",
  "fecha_inicio",
  "cliente",
] as const;
type TemplateHeader = (typeof TEMPLATE_HEADERS)[number];

const SNAPSHOT_HEADERS = [
  "rowNumber",
  "title",
  "description",
  "typeId",
  "statusId",
  "clienteId",
  "scheduleId",
  "startedAt",
  "resolvedAt",
  "assigneeIds",
] as const;

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Accent-fold + lowercase a header for forgiving matching. */
function normalizeHeader(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Convert an exceljs cell value to a plain string for downstream Zod schemas.
 * Dates → "YYYY-MM-DD HH:mm"; numbers → "123"; rich text → concatenated runs.
 *
 * Real date cells are read as the wall clock the sheet shows, so the user can
 * type dates in Excel's own date format instead of plain text.
 */
function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return excelDateToWallClock(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") return value;
  // Rich text object: { richText: [{ text: "..." }] }
  if (typeof value === "object" && value !== null) {
    const obj = value as {
      richText?: Array<{ text?: string }>;
      text?: unknown;
      result?: unknown;
    };
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => r.text ?? "").join("");
    }
    // Hyperlink cell: { text, hyperlink }
    if (typeof obj.text === "string") return obj.text;
    // Formula cell: { formula, result }
    if (obj.result != null) return cellToString(obj.result);
  }
  return String(value);
}

async function buildTemplateWorkbook(opts: {
  catalogs: Catalogs;
  defaultClienteCode: string | null;
}): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "OpusTrack";
  wb.created = new Date();

  // Sheet 1: Incidencias
  const ws = wb.addWorksheet("Incidencias", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const HEADER_LABELS: Record<TemplateHeader, string> = {
    titulo: "titulo",
    descripcion: "descripcion",
    tipo: "tipo",
    fecha_inicio: "fecha_inicio",
    cliente: "cliente",
  };
  ws.columns = TEMPLATE_HEADERS.map((h) => ({
    header: HEADER_LABELS[h],
    key: h,
    width:
      h === "descripcion"
        ? 50
        : h === "titulo"
          ? 30
          : h === "fecha_inicio"
            ? 22
            : h === "tipo"
              ? 22
              : 14,
  }));
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 22;

  // Sample row
  const sampleType = opts.catalogs.types[0]?.name ?? "Mantenimiento";
  ws.addRow({
    titulo: "Falla en cámara de inspección",
    descripcion: "Cámara 3 no enciende en el turno matutino, requiere revisión",
    tipo: sampleType,
    // Built from UTC components so Excel displays 09:00 no matter which
    // timezone generated the template — see excelDateCell.
    fecha_inicio: excelDateCell(2026, 1, 15, 9, 0),
    cliente: opts.defaultClienteCode ?? opts.catalogs.clientes[0]?.code ?? "",
  });

  // Format the fecha_inicio column as date
  ws.getColumn("fecha_inicio").numFmt = "yyyy-mm-dd hh:mm";

  // Data validations apply to a fixed range of rows (header in row 1, data 2..501).
  // Columns: A=titulo, B=descripcion, C=tipo, D=fecha_inicio, E=cliente
  const DATA_RANGE_END = 501;
  // Tipo dropdown (from Catálogos!$A$2:$A$N)
  const tipoEnd = 1 + opts.catalogs.types.length;
  const tipoFormula = `=Catálogos!$A$2:$A$${Math.max(tipoEnd, 2)}`;
  for (let r = 2; r <= DATA_RANGE_END; r++) {
    ws.getCell(`C${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [tipoFormula],
      showErrorMessage: false, // soft: server falls back to "Desconocido"
    };
  }
  // Cliente dropdown (from Catálogos!$C$2:$C$N)
  const clienteEnd = 1 + opts.catalogs.clientes.length;
  const clienteFormula = `=Catálogos!$C$2:$C$${Math.max(clienteEnd, 2)}`;
  for (let r = 2; r <= DATA_RANGE_END; r++) {
    ws.getCell(`E${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [clienteFormula],
      showErrorMessage: true,
      errorTitle: "Cliente inválido",
      error: "Selecciona un código del catálogo.",
    };
  }

  // Sheet 2: Instrucciones
  const instr = wb.addWorksheet("Instrucciones");
  instr.columns = [
    { header: "Columna", key: "col", width: 18 },
    { header: "Descripción", key: "desc", width: 80 },
  ];
  instr.getRow(1).font = { bold: true };
  instr.addRows([
    {
      col: "titulo",
      desc: "Título corto (3–200 caracteres). Requerido.",
    },
    {
      col: "descripcion",
      desc: "Descripción detallada de la incidencia. Requerido.",
    },
    {
      col: "tipo",
      desc: 'Nombre exacto de un tipo (ver hoja "Catálogos"). Si lo dejas vacío o no coincide, se asigna "Desconocido".',
    },
    {
      col: "fecha_inicio",
      desc: "Celda de fecha: escríbela como fecha de Excel (el formato yyyy-mm-dd hh:mm ya viene aplicado) o como texto yyyy-mm-dd hh:mm. Si omites la hora se toma 00:00. Opcional: vacío = la incidencia se registra como abierta sin fecha de inicio.",
    },
    {
      col: "cliente",
      desc: 'Código del Centro de Verificación Vehicular (ver hoja "Catálogos"). Requerido para guardar.',
    },
  ]);
  instr.getColumn("desc").alignment = { wrapText: true, vertical: "top" };

  // Sheet 3: Catálogos
  const cat = wb.addWorksheet("Catálogos");
  cat.columns = [
    { header: "tipo", key: "tipo", width: 24 },
    { header: "", key: "sep1", width: 4 },
    { header: "vic_codigo", key: "cliente", width: 14 },
    { header: "vic_nombre", key: "clienteName", width: 36 },
  ];
  cat.getRow(1).font = { bold: true };
  const maxRows = Math.max(
    opts.catalogs.types.length,
    opts.catalogs.clientes.length,
  );
  for (let i = 0; i < maxRows; i++) {
    cat.addRow({
      tipo: opts.catalogs.types[i]?.name ?? "",
      cliente: opts.catalogs.clientes[i]?.code ?? "",
      clienteName: opts.catalogs.clientes[i]?.name ?? "",
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME });
}

async function buildSnapshotWorkbook(
  rows: EditablePreviewRow[],
  scheduleId: string | null,
  statusIds: { open: number; closed: number },
): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "OpusTrack";
  wb.created = new Date();
  const ws = wb.addWorksheet("Snapshot");
  ws.columns = SNAPSHOT_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: 18,
  }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      rowNumber: r.rowNumber,
      title: r.title,
      description: r.description,
      typeId: r.typeId ?? "",
      statusId: r.resolvedAt ? statusIds.closed : statusIds.open,
      clienteId: r.clienteId ?? "",
      scheduleId: scheduleId ?? "",
      startedAt: r.startedAt ?? "",
      resolvedAt: r.resolvedAt ?? "",
      assigneeIds: r.assigneeIds.join(","),
    });
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME });
}

type ParseExcelResult =
  | {
      ok: true;
      mode: "template" | "snapshot";
      rows: Array<Record<string, string>>;
    }
  | { ok: false; error: string };

/**
 * Read an .xlsx file and emit string-keyed row objects matching the canonical
 * header names ("titulo"/"cliente" for template, "title"/"clienteId" for snapshot).
 * Tolerates preamble rows above the header and accent-insensitive headers.
 */
async function parseExcelFile(file: File): Promise<ParseExcelResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  try {
    const buf = await file.arrayBuffer();
    await wb.xlsx.load(buf);
  } catch (err) {
    return {
      ok: false,
      error: `Error al leer el archivo Excel: ${(err as Error).message ?? "desconocido"}`,
    };
  }
  // Prefer a worksheet named "Incidencias" / "Snapshot", else the first one.
  const ws =
    wb.getWorksheet("Incidencias") ??
    wb.getWorksheet("Snapshot") ??
    wb.worksheets[0];
  if (!ws) {
    return { ok: false, error: "El archivo Excel no contiene hojas." };
  }

  const TEMPLATE_SET = new Set<string>(
    TEMPLATE_HEADERS.map((h) => normalizeHeader(h)),
  );
  const SNAPSHOT_SET = new Set<string>(
    SNAPSHOT_HEADERS.map((h) => normalizeHeader(h)),
  );

  // Find the header row: first row within the first 20 rows where at least 3
  // cells normalize to known canonical headers.
  const MAX_SCAN = 20;
  let headerRowNumber = -1;
  let mode: "template" | "snapshot" | null = null;
  let headerMap: Record<string, number> = {}; // canonical → column number

  for (let r = 1; r <= Math.min(ws.rowCount, MAX_SCAN); r++) {
    const row = ws.getRow(r);
    const matchesTemplate: Record<string, number> = {};
    const matchesSnapshot: Record<string, number> = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const norm = normalizeHeader(cellToString(cell.value));
      if (!norm) return;
      if (TEMPLATE_SET.has(norm)) matchesTemplate[norm] = col;
      if (SNAPSHOT_SET.has(norm)) matchesSnapshot[norm] = col;
    });
    if (Object.keys(matchesTemplate).length >= 3) {
      headerRowNumber = r;
      mode = "template";
      headerMap = matchesTemplate;
      break;
    }
    if (Object.keys(matchesSnapshot).length >= 3) {
      headerRowNumber = r;
      mode = "snapshot";
      headerMap = matchesSnapshot;
      break;
    }
  }

  if (headerRowNumber < 0 || !mode) {
    return {
      ok: false,
      error:
        "No se encontró una fila de encabezados válida. Descarga la plantilla desde esta página y úsala como base.",
    };
  }

  // Read data rows below the header.
  const rows: Array<Record<string, string>> = [];
  for (let r = headerRowNumber + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, string> = {};
    for (const [canonical, colNumber] of Object.entries(headerMap)) {
      const cell = row.getCell(colNumber);
      obj[canonical] = cellToString(cell.value).trim();
    }
    rows.push(obj);
  }

  return { ok: true, mode, rows };
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function CollapsibleCard({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left w-full"
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <CardTitle className="text-base">
            {title}{" "}
            <Badge variant="secondary" className="ml-1">
              {count}
            </Badge>
          </CardTitle>
        </button>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}

function rowIsValid(row: EditablePreviewRow): boolean {
  if (row.title.trim().length < 3) return false;
  if (row.description.trim().length < 1) return false;
  if (!row.clienteId) return false;
  // A non-empty type that didn't resolve must be fixed before saving.
  if (!row.typeResolved) return false;
  return true;
}

export function BulkIncidentsClient({ catalogs }: { catalogs: Catalogs }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scheduleId, setScheduleId] = useState<string>("");
  const [previewRows, setPreviewRows] = useState<EditablePreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);
  const [rowErrorsByRowNumber, setRowErrorsByRowNumber] = useState<
    Map<number, Map<string, string>>
  >(new Map());
  const [created, setCreated] = useState<number | null>(null);
  const [defaultFsrIds, setDefaultFsrIds] = useState<string[]>([]);
  const [defaultClienteId, setDefaultClienteId] = useState<string>("");

  const selectedSchedule = useMemo(
    () => catalogs.schedules.find((s) => s.id === scheduleId) ?? null,
    [catalogs.schedules, scheduleId],
  );
  const scheduleClienteOptions = useMemo(() => {
    if (!selectedSchedule) return [];
    const byId = new Map(catalogs.clientes.map((v) => [v.id, v] as const));
    return selectedSchedule.clienteIds
      .map((id) => byId.get(id))
      .filter((v): v is { id: string; code: string; name: string } => !!v);
  }, [selectedSchedule, catalogs.clientes]);
  const defaultCliente = useMemo(
    () =>
      defaultClienteId
        ? (catalogs.clientes.find((v) => v.id === defaultClienteId) ?? null)
        : null,
    [catalogs.clientes, defaultClienteId],
  );

  // Resolve open/closed status IDs from catalog for snapshot generation.
  const statusIds = useMemo(() => {
    const open = catalogs.statuses.find((s) => s.name === "ABIERTO")?.id ?? 0;
    const closed = catalogs.statuses.find((s) => s.name === "CERRADO")?.id ?? 0;
    return { open, closed };
  }, [catalogs.statuses]);

  const validCount = previewRows.filter(rowIsValid).length;
  const invalidCount = previewRows.length - validCount;
  const canSubmit = previewRows.length > 0 && invalidCount === 0 && !submitting;

  const handleScheduleChange = (newId: string) => {
    setScheduleId(newId);
    // Reset default Cliente since the new schedule may have a different Cliente set.
    setDefaultClienteId("");
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await buildTemplateWorkbook({
        catalogs,
        defaultClienteCode: defaultCliente?.code ?? null,
      });
      downloadBlob("incidentes-plantilla.xlsx", blob);
    } catch (err) {
      setParseError(
        `Error al generar la plantilla: ${(err as Error).message ?? "desconocido"}`,
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setGeneralErrors([]);
    setRowErrorsByRowNumber(new Map());
    setCreated(null);

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx")) {
      setParseError(
        "Sólo se acepta Excel (.xlsx). Si tienes un archivo .csv o .xls, ábrelo y guárdalo como .xlsx.",
      );
      setPreviewRows([]);
      return;
    }

    const parsed = await parseExcelFile(file);
    if (!parsed.ok) {
      setParseError(parsed.error);
      setPreviewRows([]);
      return;
    }

    const result = await resolveBulkIncidentRows(
      parsed.rows,
      scheduleId || null,
      parsed.mode,
    );
    if (!result.ok) {
      setGeneralErrors(
        result.errors.map((er) => {
          if (er.row > 0) {
            const where = er.field
              ? `Fila ${er.row}, columna ${er.field}`
              : `Fila ${er.row}`;
            return `${where}: ${er.message}`;
          }
          return er.message;
        }),
      );
      setPreviewRows([]);
      return;
    }
    // Seed defaults from the page-level controls: Cliente into rows without one,
    // FSRs into rows without any.
    const defaultClienteCode = defaultClienteId
      ? (catalogs.clientes.find((v) => v.id === defaultClienteId)?.code ?? null)
      : null;
    const seeded = result.rows.map((r) => {
      let next = r;
      if (!r.clienteId && defaultClienteId) {
        next = {
          ...next,
          clienteId: defaultClienteId,
          clienteCodeRaw: r.clienteCodeRaw ?? defaultClienteCode,
          clienteResolved: true,
        };
      }
      if (next.assigneeIds.length === 0 && defaultFsrIds.length > 0) {
        next = { ...next, assigneeIds: [...defaultFsrIds] };
      }
      return next;
    });
    setPreviewRows(seeded);
  };

  const updateRow = (rowNumber: number, patch: Partial<EditablePreviewRow>) => {
    setPreviewRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, ...patch } : r)),
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setGeneralErrors([]);
    setRowErrorsByRowNumber(new Map());
    setCreated(null);
    try {
      const result = await createIncidentsFromPreview(
        previewRows,
        scheduleId || null,
      );
      if (result.ok) {
        setCreated(result.created);
        setPreviewRows([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        const general: string[] = [];
        const byRow = new Map<number, Map<string, string>>();
        for (const e of result.errors) {
          if (e.row === 0 || !e.field) {
            general.push(e.message);
            continue;
          }
          if (!byRow.has(e.row)) byRow.set(e.row, new Map());
          byRow.get(e.row)?.set(e.field, e.message);
        }
        setGeneralErrors(general);
        setRowErrorsByRowNumber(byRow);
      }
    } catch (err) {
      setGeneralErrors([
        (err as Error).message ?? "Error desconocido al guardar",
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSnapshot = async () => {
    try {
      const blob = await buildSnapshotWorkbook(
        previewRows,
        scheduleId || null,
        statusIds,
      );
      downloadBlob(
        `incidentes-snapshot-${new Date().toISOString().slice(0, 10)}.xlsx`,
        blob,
      );
    } catch (err) {
      setParseError(
        `Error al exportar snapshot: ${(err as Error).message ?? "desconocido"}`,
      );
    }
  };

  const applyDefaultFsrsToAll = () => {
    setPreviewRows((prev) =>
      prev.map((r) => ({ ...r, assigneeIds: [...defaultFsrIds] })),
    );
  };

  // Schedule options for the SearchableSelect.
  const scheduleOptions = useMemo(() => {
    const fmt = (d: Date) => new Date(d).toLocaleDateString("es-MX");
    return [
      { value: "", label: "— Sin programación —" },
      ...catalogs.schedules.map((s) => ({
        value: s.id,
        label: `${s.title} · ${fmt(s.scheduledAt)}${s.endDate ? ` → ${fmt(s.endDate)}` : ""}`,
      })),
    ];
  }, [catalogs.schedules]);

  const typeOptions = useMemo(
    () => [
      { value: "", label: "— Sin tipo —" },
      ...catalogs.types.map((t) => ({
        value: String(t.id),
        label: t.name,
      })),
    ],
    [catalogs.types],
  );

  const clienteOptions = useMemo(
    () =>
      catalogs.clientes.map((v) => ({
        value: v.id,
        label: `${v.code} — ${v.name}`,
      })),
    [catalogs.clientes],
  );

  const buildFsrOptions = (rowClienteId: string | null) =>
    catalogs.fsrs.map((f) => ({
      value: f.id,
      label: f.name,
      sublabel: f.email,
      badge:
        rowClienteId && f.clienteIds.includes(rowClienteId)
          ? "Cliente asignado"
          : undefined,
    }));

  return (
    <div className="space-y-6">
      {/* Step 1: schedule */}
      <Card>
        <CardHeader>
          <CardTitle>1. Programación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Asocia los incidentes a una programación (opcional). El Cliente
            asociado se preselecciona en la plantilla.
          </p>
          <SearchableSelect
            options={scheduleOptions}
            value={scheduleId}
            onValueChange={handleScheduleChange}
            placeholder="Selecciona una programación o ninguna"
            searchPlaceholder="Buscar programación..."
            emptyMessage="Sin programaciones"
          />
          {selectedSchedule && scheduleClienteOptions.length > 0 && (
            <div className="pt-2 space-y-2 border-t">
              <p className="text-sm font-medium">
                Cliente por defecto (opcional)
              </p>
              <p className="text-xs text-muted-foreground">
                Se asigna a cada fila que llegue sin Cliente y se usa para la
                plantilla descargada. Solo Clientes que pertenecen a esta
                programación.
              </p>
              <SearchableSelect
                options={[
                  { value: "", label: "— Sin Cliente por defecto —" },
                  ...scheduleClienteOptions.map((v) => ({
                    value: v.id,
                    label: `${v.code} — ${v.name}`,
                  })),
                ]}
                value={defaultClienteId}
                onValueChange={setDefaultClienteId}
                placeholder="Elige Cliente por defecto"
                searchPlaceholder="Buscar Cliente..."
                emptyMessage="Sin Clientes en esta programación"
              />
            </div>
          )}

          <div className="pt-2 space-y-2 border-t">
            <p className="text-sm font-medium">FSRs por defecto (opcional)</p>
            <p className="text-xs text-muted-foreground">
              Se asignan automáticamente a cada fila al subir el archivo.
              También puedes aplicarlos retroactivamente a todas las filas con
              el botón.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <MultiSelect
                  options={buildFsrOptions(defaultClienteId || null)}
                  value={defaultFsrIds}
                  onValueChange={setDefaultFsrIds}
                  placeholder="Selecciona FSRs"
                  searchPlaceholder="Buscar FSR por nombre o email..."
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={applyDefaultFsrsToAll}
                disabled={previewRows.length === 0}
              >
                Aplicar a todas las filas ({previewRows.length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: download template */}
      <Card>
        <CardHeader>
          <CardTitle>2. Descarga la plantilla</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            La plantilla viene con tres hojas: <strong>Incidencias</strong>{" "}
            (encabezados y celdas con validación),{" "}
            <strong>Instrucciones</strong> (descripción de cada columna) y{" "}
            <strong>Catálogos</strong> (tipos y Clientes válidos). Las columnas{" "}
            <code className="text-xs">tipo</code> y{" "}
            <code className="text-xs">cliente</code> son listas desplegables;{" "}
            <code className="text-xs">fecha_inicio</code> es una celda de fecha.
            Si dejas <code className="text-xs">tipo</code> vacío o no coincide,
            el sistema asigna <code className="text-xs">Desconocido</code>.
          </p>
          <Button onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Descargar plantilla Excel
          </Button>
        </CardContent>
      </Card>

      {/* Catálogos de referencia */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Catálogos de referencia</h2>
          <p className="text-sm text-muted-foreground">
            Usa estas listas para llenar las columnas{" "}
            <code className="text-xs">tipo</code> y{" "}
            <code className="text-xs">cliente</code> en tu archivo.
          </p>
        </div>

        <CollapsibleCard
          title="Tipos de incidente"
          count={catalogs.types.length}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre (escribir en columna tipo)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleCard>

        <CollapsibleCard
          title="Clientes (Cliente)"
          count={catalogs.clientes.length}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código (escribir en columna cliente)</TableHead>
                <TableHead>Nombre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.clientes.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono">{v.code}</TableCell>
                  <TableCell>{v.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleCard>

        <CollapsibleCard
          title="Programaciones"
          count={catalogs.schedules.length}
        >
          {catalogs.schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay programaciones disponibles.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Fecha inicio</TableHead>
                  <TableHead>Fecha fin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalogs.schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.scheduledAt).toLocaleDateString("es-MX")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.endDate
                        ? new Date(s.endDate).toLocaleDateString("es-MX")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CollapsibleCard>

        <CollapsibleCard title="FSRs" count={catalogs.fsrs.length}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.fsrs.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.email}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleCard>
      </div>

      {/* Step 3: upload */}
      <Card>
        <CardHeader>
          <CardTitle>3. Subir archivo Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            Sólo archivos .xlsx. Acepta la plantilla descargada o un snapshot
            previamente exportado.
          </p>
          {parseError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {parseError}
            </div>
          )}
          {generalErrors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive mb-1">Errores:</p>
              <ul className="list-disc pl-5 space-y-1">
                {generalErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 4: editable preview */}
      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                4. Previsualización ({previewRows.length} filas)
              </CardTitle>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-emerald-600">
                  <CheckCircle2 className="inline h-4 w-4 mr-1" />
                  {validCount} válidas
                </span>
                {invalidCount > 0 && (
                  <span className="text-destructive">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    {invalidCount} con pendientes
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-24">Estado</TableHead>
                    <TableHead className="min-w-[180px]">Título</TableHead>
                    <TableHead className="min-w-[240px]">Descripción</TableHead>
                    <TableHead className="min-w-[180px]">Tipo</TableHead>
                    <TableHead className="min-w-[200px]">Cliente</TableHead>
                    <TableHead className="min-w-[220px]">FSRs</TableHead>
                    <TableHead className="min-w-[180px]">
                      Fecha inicio
                    </TableHead>
                    <TableHead className="min-w-[180px]">
                      Fecha resolución
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row) => {
                    const ok = rowIsValid(row);
                    const serverErrs = rowErrorsByRowNumber.get(row.rowNumber);
                    const allErrs = new Map<string, string>();
                    for (const [k, v] of Object.entries(row.fieldErrors))
                      allErrs.set(k, v);
                    if (serverErrs)
                      for (const [k, v] of serverErrs) allErrs.set(k, v);
                    return (
                      <TableRow
                        key={row.rowNumber}
                        className={!ok ? "bg-destructive/5" : ""}
                      >
                        <TableCell className="text-xs text-muted-foreground align-top pt-3">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell className="align-top pt-3">
                          {ok ? (
                            <Badge variant="default" className="bg-emerald-600">
                              OK
                            </Badge>
                          ) : !row.clienteId ? (
                            <Badge variant="destructive">
                              Cliente pendiente
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            value={row.title}
                            onChange={(e) =>
                              updateRow(row.rowNumber, {
                                title: e.target.value,
                              })
                            }
                            className={
                              allErrs.has("title") || allErrs.has("titulo")
                                ? "border-destructive"
                                : ""
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Textarea
                            value={row.description}
                            onChange={(e) =>
                              updateRow(row.rowNumber, {
                                description: e.target.value,
                              })
                            }
                            rows={2}
                            className={
                              allErrs.has("description") ||
                              allErrs.has("descripcion")
                                ? "border-destructive"
                                : ""
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          {allErrs.has("tipo") && (
                            <div
                              className="text-[10px] text-destructive mb-1"
                              title={allErrs.get("tipo")}
                            >
                              ✖ {allErrs.get("tipo")}
                            </div>
                          )}
                          <div
                            className={
                              allErrs.has("tipo")
                                ? "ring-1 ring-destructive rounded-md"
                                : ""
                            }
                          >
                            <SearchableSelect
                              options={typeOptions}
                              value={row.typeId ? String(row.typeId) : ""}
                              onValueChange={(v) => {
                                const nextErrors = Object.fromEntries(
                                  Object.entries(row.fieldErrors).filter(
                                    ([k]) => k !== "tipo",
                                  ),
                                );
                                updateRow(row.rowNumber, {
                                  typeId: v ? Number(v) : null,
                                  typeResolved: true,
                                  typeNameRaw: null,
                                  fieldErrors: nextErrors,
                                });
                              }}
                              placeholder="Sin tipo"
                              searchPlaceholder="Buscar tipo..."
                            />
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          {row.clienteCodeRaw && !row.clienteResolved && (
                            <div className="text-[10px] text-destructive mb-1">
                              CSV: "{row.clienteCodeRaw}" (no encontrado)
                            </div>
                          )}
                          <SearchableSelect
                            options={clienteOptions}
                            value={row.clienteId ?? ""}
                            onValueChange={(v) =>
                              updateRow(row.rowNumber, {
                                clienteId: v || null,
                                clienteResolved: !!v,
                                clienteCodeRaw: null,
                              })
                            }
                            placeholder="Selecciona Cliente"
                            searchPlaceholder="Buscar Cliente..."
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <MultiSelect
                            options={buildFsrOptions(row.clienteId)}
                            value={row.assigneeIds}
                            onValueChange={(v) =>
                              updateRow(row.rowNumber, { assigneeIds: v })
                            }
                            placeholder="Selecciona FSRs"
                            searchPlaceholder="Buscar FSR..."
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="datetime-local"
                            value={toLocalDatetimeInput(row.startedAt)}
                            onChange={(e) =>
                              updateRow(row.rowNumber, {
                                startedAt: fromLocalDatetimeInput(
                                  e.target.value,
                                ),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="datetime-local"
                            value={toLocalDatetimeInput(row.resolvedAt)}
                            onChange={(e) =>
                              updateRow(row.rowNumber, {
                                resolvedAt: fromLocalDatetimeInput(
                                  e.target.value,
                                ),
                              })
                            }
                            className={
                              allErrs.has("resolvedAt")
                                ? "border-destructive"
                                : ""
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={handleDownloadSnapshot}
                disabled={previewRows.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar copia editada
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit} size="lg">
                {submitting ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-pulse" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar {previewRows.length} incidente
                    {previewRows.length === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </div>
            {invalidCount > 0 && (
              <p className="text-sm text-muted-foreground text-right">
                Resuelve las filas pendientes antes de guardar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {created !== null && (
        <Card className="border-emerald-500/50 bg-emerald-500/5">
          <CardContent className="py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-medium">
                  Se crearon {created} incidente{created === 1 ? "" : "s"}{" "}
                  correctamente.
                </p>
                <p className="text-sm text-muted-foreground">
                  Puedes verlos en el listado de incidentes.
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin/incidents">Ir a incidentes</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
