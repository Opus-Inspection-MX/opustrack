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
import Papa from "papaparse";
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

type Catalogs = {
  types: Array<{ id: number; name: string }>;
  statuses: Array<{ id: number; name: string; color: string }>;
  vics: Array<{ id: string; name: string; code: string }>;
  schedules: Array<{
    id: string;
    title: string;
    scheduledAt: Date;
    endDate: Date | null;
    vicIds: string[];
  }>;
  fsrs: Array<{
    id: string;
    name: string;
    email: string;
    vicIds: string[];
  }>;
};

const TEMPLATE_HEADERS = [
  "titulo",
  "descripcion",
  "prioridad",
  "sla",
  "tipo",
  "fecha_inicio",
  "vic",
] as const;

const SNAPSHOT_HEADERS = [
  "rowNumber",
  "title",
  "description",
  "priority",
  "sla",
  "typeId",
  "statusId",
  "vicId",
  "scheduleId",
  "startedAt",
  "resolvedAt",
  "assigneeIds",
] as const;

const UTF8_BOM = "﻿";

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([UTF8_BOM + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatSampleDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildLegibleTemplateCsv(opts: {
  vicCode?: string;
  typeNames: string[];
}): string {
  const sampleType = opts.typeNames[0] ?? "Mantenimiento";
  const sample = [
    "Falla en cámara de inspección",
    "Cámara 3 no enciende en el turno matutino, requiere revisión",
    "7",
    "24",
    sampleType,
    formatSampleDate(new Date()),
    opts.vicCode ?? "",
  ];
  return Papa.unparse(
    { fields: [...TEMPLATE_HEADERS], data: [sample] },
    { quotes: true, newline: "\r\n" },
  );
}

function buildSnapshotCsv(
  rows: EditablePreviewRow[],
  scheduleId: string | null,
  statusIds: { open: number; closed: number },
): string {
  const data = rows.map((r) => [
    r.rowNumber,
    r.title,
    r.description,
    r.priority,
    r.sla,
    r.typeId ?? "",
    r.resolvedAt ? statusIds.closed : statusIds.open,
    r.vicId ?? "",
    scheduleId ?? "",
    r.startedAt ?? "",
    r.resolvedAt ?? "",
    r.assigneeIds.join(","),
  ]);
  return Papa.unparse(
    { fields: [...SNAPSHOT_HEADERS], data },
    { quotes: true, newline: "\r\n" },
  );
}

function detectMode(headers: string[]): "template" | "snapshot" | "unknown" {
  const lower = headers.map((h) => h.trim().toLowerCase());
  if (lower.includes("titulo") && lower.includes("vic")) return "template";
  if (lower.includes("title") && lower.includes("vicid")) return "snapshot";
  return "unknown";
}

/**
 * Trim arbitrary preamble lines (filenames, titles, notes) before the real
 * CSV header row. Returns the text starting from the first plausible header,
 * or null if no header is found in the first 20 lines.
 */
function stripLeadingNonHeaderLines(text: string): string | null {
  // Drop UTF-8 BOM if present.
  const noBom = text.replace(/^﻿/, "");
  const lines = noBom.split(/\r?\n/);
  const MAX_SCAN = 20;
  for (let i = 0; i < Math.min(lines.length, MAX_SCAN); i++) {
    const lower = lines[i].toLowerCase();
    const looksLikeTemplate =
      lower.includes("titulo") &&
      lower.includes("descripcion") &&
      lower.includes("vic");
    const looksLikeSnapshot =
      lower.includes("title") &&
      lower.includes("description") &&
      lower.includes("vicid");
    if (looksLikeTemplate || looksLikeSnapshot) {
      return lines.slice(i).join("\n");
    }
  }
  return null;
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
  if (row.priority < 1 || row.priority > 10) return false;
  if (row.sla <= 0) return false;
  if (!row.vicId) return false;
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
  const [defaultVicId, setDefaultVicId] = useState<string>("");

  const selectedSchedule = useMemo(
    () => catalogs.schedules.find((s) => s.id === scheduleId) ?? null,
    [catalogs.schedules, scheduleId],
  );
  const scheduleVicOptions = useMemo(() => {
    if (!selectedSchedule) return [];
    const byId = new Map(catalogs.vics.map((v) => [v.id, v] as const));
    return selectedSchedule.vicIds
      .map((id) => byId.get(id))
      .filter((v): v is { id: string; code: string; name: string } => !!v);
  }, [selectedSchedule, catalogs.vics]);
  const defaultVic = useMemo(
    () =>
      defaultVicId
        ? (catalogs.vics.find((v) => v.id === defaultVicId) ?? null)
        : null,
    [catalogs.vics, defaultVicId],
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
    // Reset default VIC since the new schedule may have a different VIC set.
    setDefaultVicId("");
  };

  const handleDownloadTemplate = () => {
    downloadCsv(
      "incidentes-plantilla.csv",
      buildLegibleTemplateCsv({
        vicCode: defaultVic?.code,
        typeNames: catalogs.types.map((t) => t.name),
      }),
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setGeneralErrors([]);
    setRowErrorsByRowNumber(new Map());
    setCreated(null);

    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      setParseError(`Error al leer el archivo: ${(err as Error).message}`);
      setPreviewRows([]);
      return;
    }

    // Strip leading garbage lines (filenames, titles, notes) before the
    // real header row. Find the first line that looks like our header.
    const cleaned = stripLeadingNonHeaderLines(text);
    if (!cleaned) {
      setParseError(
        "No se encontró una fila de encabezados válida. Usa la plantilla descargada (encabezados: titulo, descripcion, prioridad, sla, tipo, fecha_inicio, vic) o un snapshot previamente descargado.",
      );
      setPreviewRows([]);
      return;
    }

    const res = Papa.parse<Record<string, string>>(cleaned, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      comments: "#",
    });

    if (res.errors.length > 0) {
      setParseError(
        `Error al parsear CSV: ${res.errors[0].message} (fila ${res.errors[0].row ?? "?"})`,
      );
      setPreviewRows([]);
      return;
    }
    const headers = res.meta.fields ?? [];
    const mode = detectMode(headers);
    if (mode === "unknown") {
      setParseError(
        "Formato no reconocido. Usa la plantilla legible (encabezados en español) o un snapshot previamente descargado.",
      );
      setPreviewRows([]);
      return;
    }

    const result = await resolveBulkIncidentRows(
      res.data,
      scheduleId || null,
      mode,
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
    // Seed defaults from the page-level controls: VIC into rows without one,
    // FSRs into rows without any.
    const defaultVicCode = defaultVicId
      ? (catalogs.vics.find((v) => v.id === defaultVicId)?.code ?? null)
      : null;
    const seeded = result.rows.map((r) => {
      let next = r;
      if (!r.vicId && defaultVicId) {
        next = {
          ...next,
          vicId: defaultVicId,
          vicCodeRaw: r.vicCodeRaw ?? defaultVicCode,
          vicResolved: true,
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

  const handleDownloadSnapshot = () => {
    downloadCsv(
      `incidentes-snapshot-${new Date().toISOString().slice(0, 10)}.csv`,
      buildSnapshotCsv(previewRows, scheduleId || null, statusIds),
    );
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

  const vicOptions = useMemo(
    () =>
      catalogs.vics.map((v) => ({
        value: v.id,
        label: `${v.code} — ${v.name}`,
      })),
    [catalogs.vics],
  );

  const buildFsrOptions = (rowVicId: string | null) =>
    catalogs.fsrs.map((f) => ({
      value: f.id,
      label: f.name,
      sublabel: f.email,
      badge:
        rowVicId && f.vicIds.includes(rowVicId) ? "VIC asignado" : undefined,
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
            Asocia los incidentes a una programación (opcional). El VIC asociado
            se preselecciona en la plantilla.
          </p>
          <SearchableSelect
            options={scheduleOptions}
            value={scheduleId}
            onValueChange={handleScheduleChange}
            placeholder="Selecciona una programación o ninguna"
            searchPlaceholder="Buscar programación..."
            emptyMessage="Sin programaciones"
          />
          {selectedSchedule && scheduleVicOptions.length > 0 && (
            <div className="pt-2 space-y-2 border-t">
              <p className="text-sm font-medium">VIC por defecto (opcional)</p>
              <p className="text-xs text-muted-foreground">
                Se asigna a cada fila que llegue sin VIC y se usa para la
                plantilla descargada. Solo VICs que pertenecen a esta
                programación.
              </p>
              <SearchableSelect
                options={[
                  { value: "", label: "— Sin VIC por defecto —" },
                  ...scheduleVicOptions.map((v) => ({
                    value: v.id,
                    label: `${v.code} — ${v.name}`,
                  })),
                ]}
                value={defaultVicId}
                onValueChange={setDefaultVicId}
                placeholder="Elige VIC por defecto"
                searchPlaceholder="Buscar VIC..."
                emptyMessage="Sin VICs en esta programación"
              />
            </div>
          )}

          <div className="pt-2 space-y-2 border-t">
            <p className="text-sm font-medium">FSRs por defecto (opcional)</p>
            <p className="text-xs text-muted-foreground">
              Se asignan automáticamente a cada fila al subir el CSV. También
              puedes aplicarlos retroactivamente a todas las filas con el botón.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <MultiSelect
                  options={buildFsrOptions(defaultVicId || null)}
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
            Columnas:{" "}
            <code className="text-xs">
              titulo, descripcion, prioridad, sla, tipo, fecha_inicio, vic
            </code>
            .
            <br />
            <strong>tipo</strong>: nombre del tipo de incidente (ej.{" "}
            <code className="text-xs">
              {catalogs.types[0]?.name ?? "Mantenimiento"}
            </code>
            ). <strong>fecha_inicio</strong>: formato{" "}
            <code className="text-xs">YYYY-MM-DD HH:mm</code>.{" "}
            <strong>vic</strong>: código del CVV. Acepta texto largo, comas y
            caracteres especiales (UTF-8).
          </p>
          <Button onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Descargar plantilla CSV
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
            <code className="text-xs">vic</code> en tu CSV.
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

        <CollapsibleCard title="CVVs (VIC)" count={catalogs.vics.length}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código (escribir en columna vic)</TableHead>
                <TableHead>Nombre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.vics.map((v) => (
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
          <CardTitle>3. Subir CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            Se acepta la plantilla legible o un snapshot previamente descargado.
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
                    <TableHead className="w-20">Prio</TableHead>
                    <TableHead className="w-20">SLA (h)</TableHead>
                    <TableHead className="min-w-[180px]">Tipo</TableHead>
                    <TableHead className="min-w-[200px]">VIC</TableHead>
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
                          ) : !row.vicId ? (
                            <Badge variant="destructive">VIC pendiente</Badge>
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
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={row.priority}
                            onChange={(e) =>
                              updateRow(row.rowNumber, {
                                priority: Number(e.target.value),
                              })
                            }
                            className="w-16"
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            min={1}
                            value={row.sla}
                            onChange={(e) =>
                              updateRow(row.rowNumber, {
                                sla: Number(e.target.value),
                              })
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          {row.typeNameRaw && !row.typeResolved && (
                            <div className="text-[10px] text-destructive mb-1">
                              CSV: "{row.typeNameRaw}" (no encontrado)
                            </div>
                          )}
                          <SearchableSelect
                            options={typeOptions}
                            value={row.typeId ? String(row.typeId) : ""}
                            onValueChange={(v) =>
                              updateRow(row.rowNumber, {
                                typeId: v ? Number(v) : null,
                                typeResolved: true,
                                typeNameRaw: null,
                              })
                            }
                            placeholder="Sin tipo"
                            searchPlaceholder="Buscar tipo..."
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          {row.vicCodeRaw && !row.vicResolved && (
                            <div className="text-[10px] text-destructive mb-1">
                              CSV: "{row.vicCodeRaw}" (no encontrado)
                            </div>
                          )}
                          <SearchableSelect
                            options={vicOptions}
                            value={row.vicId ?? ""}
                            onValueChange={(v) =>
                              updateRow(row.rowNumber, {
                                vicId: v || null,
                                vicResolved: !!v,
                                vicCodeRaw: null,
                              })
                            }
                            placeholder="Selecciona VIC"
                            searchPlaceholder="Buscar VIC..."
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <MultiSelect
                            options={buildFsrOptions(row.vicId)}
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
