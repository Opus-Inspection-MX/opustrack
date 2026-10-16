import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { formatMX } from "@/lib/utils/datetime";

const labels: Record<string, string> = {
  UNMATCHED_IDENTITY: "Sin cuenta coincidente",
  AMBIGUOUS_IDENTITY: "Identidad ambigua",
  UNVERIFIED_HIRE_DATE: "Fecha de ingreso por verificar",
  SOURCE_SENIORITY_MISMATCH: "Antigüedad original distinta de la calculada",
  EXISTING_HIRE_DATE_CONFLICT: "Fecha distinta de la registrada",
  INCOMPLETE_BALANCE: "Saldo incompleto",
  INCONSISTENT_BALANCE: "Saldo por conciliar",
  FORMULA_CACHE_MISMATCH: "Resultado de fórmula por conciliar",
  UNEARNED_CYCLE: "Aún no corresponde un derecho anual",
};

/** Admin-only source evidence. Aggregates are deliberately separate from absences. */
export async function VacationWorkbookArchive() {
  await requirePermission("vacations:manage");
  const workbooks = await prisma.vacationWorkbook.findMany({
    orderBy: { importedAt: "desc" },
    include: {
      rows: { orderBy: [{ cycleYear: "desc" }, { sourceRow: "asc" }] },
    },
  });
  if (!workbooks.length) return null;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">
        Historial del Excel de vacaciones
      </h2>
      <p className="text-sm text-muted-foreground">
        Los consumos conciliados se reflejan en los saldos. Las filas pendientes
        conservan su información original y no descuentan días. El texto
        histórico no crea ausencias en el calendario.
      </p>
      {workbooks.map((book) => (
        <div key={book.digest} className="space-y-3">
          <p className="font-medium">
            {book.filename} · {book.rows.length} registros
          </p>
          {[...new Set(book.rows.map((row) => row.sourceSheet))].map(
            (sheet) => (
              <details key={sheet} className="rounded-lg border p-3">
                <summary className="cursor-pointer font-medium">
                  {sheet}
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        {[
                          "Persona",
                          "Ingreso",
                          "Años en origen",
                          "Derecho",
                          "Tomados",
                          "Pendientes",
                          "Revisión",
                          "Días y observaciones de origen",
                        ].map((label) => (
                          <th key={label} className="p-2">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {book.rows
                        .filter((row) => row.sourceSheet === sheet)
                        .map((row) => {
                          const cells = Array.isArray(row.sourceValues)
                            ? row.sourceValues
                            : [];
                          const notes = [cells[4], ...cells.slice(8)]
                            .filter((value) => typeof value === "string")
                            .join(" · ");
                          return (
                            <tr key={row.id} className="border-t align-top">
                              <td className="p-2">{row.sourceName}</td>
                              <td className="whitespace-nowrap p-2">
                                {row.hireDate
                                  ? formatMX(row.hireDate, {
                                      dateStyle: "short",
                                    })
                                  : "Por verificar"}
                              </td>
                              <td className="p-2">{row.yearsOfService}</td>
                              <td className="p-2">{row.entitledDays ?? "—"}</td>
                              <td className="p-2">{row.takenDays ?? "—"}</td>
                              <td className="p-2">
                                {row.remainingDays ?? "—"}
                              </td>
                              <td className="p-2">
                                {row.reviewStatus === "APPROVED"
                                  ? "Conciliado"
                                  : "Pendiente"}
                                {row.issues.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {row.issues
                                      .map(
                                        (issue) =>
                                          labels[issue] ?? "Requiere revisión",
                                      )
                                      .join(" · ")}
                                  </p>
                                )}
                              </td>
                              <td className="min-w-72 p-2">{notes || "—"}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </details>
            ),
          )}
          <a
            className="text-sm underline"
            href={`/api/vacations/workbooks/${book.digest}`}
          >
            Descargar evidencia completa de celdas y reglas
          </a>
        </div>
      ))}
    </section>
  );
}
