"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Upload,
} from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type BulkIncidentError,
  createIncidentsBulk,
} from "@/lib/actions/incidents";
import { BulkIncidentRowSchema } from "@/lib/validations/incidents";

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

type ParsedRow = {
  raw: Record<string, string>;
  rowNumber: number;
  fieldErrors: Map<string, string[]>;
};

const CSV_HEADERS = [
  "title",
  "description",
  "priority",
  "sla",
  "typeId",
  "statusId",
  "vicId",
  "scheduleId",
  "assigneeIds",
] as const;

const SAMPLE_ROW = [
  "Falla en cámara de inspección",
  "La cámara 3 no enciende durante el turno matutino",
  "7",
  "24",
  "",
  "",
  "",
  "",
  "",
];

function buildTemplateCsv(): string {
  return Papa.unparse({
    fields: [...CSV_HEADERS],
    data: [SAMPLE_ROW],
  });
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CollapsibleCard({
  title,
  count,
  action,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 text-left"
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <CardTitle>
              {title}{" "}
              <Badge variant="secondary" className="ml-2">
                {count}
              </Badge>
            </CardTitle>
          </button>
          {action}
        </div>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}

export function BulkIncidentsClient({ catalogs }: { catalogs: Catalogs }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<BulkIncidentError[]>([]);
  const [created, setCreated] = useState<number | null>(null);

  const totalErrors = useMemo(
    () =>
      parsedRows.reduce((acc, r) => acc + r.fieldErrors.size, 0) +
      serverErrors.length,
    [parsedRows, serverErrors],
  );
  const validCount = parsedRows.filter((r) => r.fieldErrors.size === 0).length;

  const handleDownloadTemplate = () => {
    downloadCsv("incidentes-plantilla.csv", buildTemplateCsv());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setServerErrors([]);
    setCreated(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        if (res.errors.length > 0) {
          setParseError(
            `Error al parsear CSV: ${res.errors[0].message} (fila ${res.errors[0].row ?? "?"})`,
          );
          setParsedRows([]);
          return;
        }
        const rows: ParsedRow[] = res.data.map((raw, idx) => {
          const fieldErrors = new Map<string, string[]>();
          const result = BulkIncidentRowSchema.safeParse(raw);
          if (!result.success) {
            for (const issue of result.error.issues) {
              const key = issue.path.join(".") || "_row";
              const arr = fieldErrors.get(key) ?? [];
              arr.push(issue.message);
              fieldErrors.set(key, arr);
            }
          }
          return { raw, rowNumber: idx + 2, fieldErrors };
        });
        setParsedRows(rows);
      },
      error: (err) => {
        setParseError(`Error al leer el archivo: ${err.message}`);
        setParsedRows([]);
      },
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setServerErrors([]);
    setCreated(null);
    try {
      const payload = parsedRows.map((r) => r.raw);
      const result = await createIncidentsBulk(payload);
      if (result.ok) {
        setCreated(result.created);
        setParsedRows([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setServerErrors(result.errors);
      }
    } catch (err) {
      setServerErrors([
        {
          row: 0,
          message: (err as Error).message ?? "Error desconocido al crear",
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    parsedRows.length > 0 && validCount === parsedRows.length && !submitting;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Descarga la plantilla</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Columnas: <code className="text-xs">{CSV_HEADERS.join(", ")}</code>.
            <br />
            <strong>title</strong>, <strong>description</strong>,{" "}
            <strong>priority</strong> (1-10) y <strong>sla</strong> (horas) son
            obligatorios. <strong>assigneeIds</strong> es una lista separada por
            coma de IDs de FSR. Deja en blanco lo que no aplique. Guarda como{" "}
            <strong>UTF-8</strong>.
          </p>
          <Button onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Descargar plantilla CSV
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">2. Catálogos de referencia</h2>
          <p className="text-sm text-muted-foreground">
            Copia los IDs que necesites en tu CSV.
          </p>
        </div>

        <CollapsibleCard
          title="Tipos de incidente"
          count={catalogs.types.length}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">id</TableHead>
                <TableHead>name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">{t.id}</TableCell>
                  <TableCell>{t.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleCard>

        <CollapsibleCard
          title="Estados de incidente"
          count={catalogs.statuses.length}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">id</TableHead>
                <TableHead>name</TableHead>
                <TableHead>color</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.statuses.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.id}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>
                    <span
                      className="inline-block w-4 h-4 rounded-full mr-2 align-middle"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {s.color}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleCard>

        <CollapsibleCard title="VICs" count={catalogs.vics.length}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>id</TableHead>
                <TableHead>code</TableHead>
                <TableHead>name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.vics.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.id}</TableCell>
                  <TableCell>{v.code}</TableCell>
                  <TableCell>{v.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleCard>

        <CollapsibleCard
          title="Programaciones (Schedules)"
          count={catalogs.schedules.length}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/schedules/new" target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                Crear nueva programación
              </Link>
            </Button>
          }
        >
          {catalogs.schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay programaciones. Crea una y luego refresca la página.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>id</TableHead>
                  <TableHead>title</TableHead>
                  <TableHead>type</TableHead>
                  <TableHead>scheduledAt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalogs.schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.id}</TableCell>
                    <TableCell>{s.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.scheduledAt).toLocaleDateString()}
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
                <TableHead>id</TableHead>
                <TableHead>name</TableHead>
                <TableHead>email</TableHead>
                <TableHead>VICs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.fsrs.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.id}</TableCell>
                  <TableCell>{f.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.email}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {f.vicIds.length === 0 ? "—" : f.vicIds.length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleCard>
      </div>

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
          {parseError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {parseError}
            </div>
          )}
        </CardContent>
      </Card>

      {parsedRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                4. Previsualización ({parsedRows.length} filas)
              </CardTitle>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-emerald-600">
                  <CheckCircle2 className="inline h-4 w-4 mr-1" />
                  {validCount} válidas
                </span>
                <span className="text-destructive">
                  <AlertCircle className="inline h-4 w-4 mr-1" />
                  {parsedRows.length - validCount} inválidas
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-12">Estado</TableHead>
                    {CSV_HEADERS.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => {
                    const ok = row.fieldErrors.size === 0;
                    const serverRowErrors = serverErrors.filter(
                      (e) => e.row === row.rowNumber,
                    );
                    return (
                      <TableRow
                        key={row.rowNumber}
                        className={
                          !ok || serverRowErrors.length
                            ? "bg-destructive/5"
                            : ""
                        }
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell>
                          {ok && serverRowErrors.length === 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <span title="Ver errores debajo">
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            </span>
                          )}
                        </TableCell>
                        {CSV_HEADERS.map((h) => {
                          const errs = row.fieldErrors.get(h) ?? [];
                          const sErrs = serverRowErrors
                            .filter((e) => e.field === h)
                            .map((e) => e.message);
                          const allErrs = [...errs, ...sErrs];
                          return (
                            <TableCell key={h} className="text-xs align-top">
                              <div className="font-mono whitespace-pre-wrap break-all max-w-[200px]">
                                {row.raw[h] ?? ""}
                              </div>
                              {allErrs.map((e) => (
                                <div
                                  key={e}
                                  className="text-destructive text-[10px] mt-1"
                                >
                                  {e}
                                </div>
                              ))}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {serverErrors.filter((e) => !e.field || e.row === 0).length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive mb-1">
                  Errores generales del servidor:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {serverErrors
                    .filter((e) => !e.field || e.row === 0)
                    .map((e, i) => (
                      <li key={`${e.row}-${i}`}>
                        {e.row > 0 && (
                          <span className="text-muted-foreground">
                            fila {e.row}:{" "}
                          </span>
                        )}
                        {e.message}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={!canSubmit} size="lg">
                <Upload className="mr-2 h-4 w-4" />
                {submitting
                  ? "Creando..."
                  : `Crear ${parsedRows.length} incidentes`}
              </Button>
            </div>
            {totalErrors > 0 && validCount !== parsedRows.length && (
              <p className="text-sm text-muted-foreground text-right">
                Corrige los errores y vuelve a subir el CSV antes de crear.
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
                  Se crearon {created} incidentes correctamente.
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
