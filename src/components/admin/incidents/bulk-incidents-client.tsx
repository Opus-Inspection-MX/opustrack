"use client";

import {
  AlertCircle,
  CheckCircle2,
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
    type: string;
    scheduledAt: Date;
    vicId: string;
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

function buildLegibleTemplateCsv(opts: {
  scheduleTitle?: string;
  vicCode?: string;
}): string {
  const sample = [
    "Falla en cámara de inspección",
    "Cámara 3 no enciende en el turno matutino, requiere revisión",
    "7",
    "24",
    "",
    "",
    opts.vicCode ?? "",
  ];
  const meta = opts.scheduleTitle
    ? `# Programación: ${opts.scheduleTitle}\n`
    : "";
  return (
    meta +
    Papa.unparse(
      { fields: [...TEMPLATE_HEADERS], data: [sample] },
      { quotes: true, newline: "\r\n" },
    )
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

  const selectedSchedule = useMemo(
    () => catalogs.schedules.find((s) => s.id === scheduleId) ?? null,
    [catalogs.schedules, scheduleId],
  );
  const scheduleVicId = selectedSchedule?.vicId ?? null;
  const scheduleVic = useMemo(
    () =>
      scheduleVicId
        ? (catalogs.vics.find((v) => v.id === scheduleVicId) ?? null)
        : null,
    [catalogs.vics, scheduleVicId],
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

  const handleDownloadTemplate = () => {
    downloadCsv(
      "incidentes-plantilla.csv",
      buildLegibleTemplateCsv({
        scheduleTitle: selectedSchedule?.title,
        vicCode: scheduleVic?.code,
      }),
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setGeneralErrors([]);
    setRowErrorsByRowNumber(new Map());
    setCreated(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      comments: "#",
      complete: async (res) => {
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
          setGeneralErrors(result.errors.map((e) => e.message));
          setPreviewRows([]);
          return;
        }
        setPreviewRows(result.rows);
      },
      error: (err) => {
        setParseError(`Error al leer el archivo: ${err.message}`);
        setPreviewRows([]);
      },
    });
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

  // Schedule options for the SearchableSelect.
  const scheduleOptions = useMemo(() => {
    const fmt = (d: Date) => new Date(d).toLocaleDateString("es-MX");
    return [
      { value: "", label: "— Sin programación —" },
      ...catalogs.schedules.map((s) => ({
        value: s.id,
        label: `${s.title} · ${s.type} · ${fmt(s.scheduledAt)}`,
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
            onValueChange={setScheduleId}
            placeholder="Selecciona una programación o ninguna"
            searchPlaceholder="Buscar programación..."
            emptyMessage="Sin programaciones"
          />
          {scheduleVic && (
            <p className="text-sm">
              VIC de la programación:{" "}
              <Badge variant="secondary">
                {scheduleVic.code} — {scheduleVic.name}
              </Badge>
            </p>
          )}
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
            Acepta texto largo, comas y caracteres especiales (UTF-8). Guarda
            como CSV UTF-8 al editar en Excel/LibreOffice/Numbers.
          </p>
          <Button onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Descargar plantilla CSV
          </Button>
        </CardContent>
      </Card>

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
