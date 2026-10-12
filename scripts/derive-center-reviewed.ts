/** Pure, fail-closed revision of private T6 candidate evidence. No import approval. */

import { EQUIPMENT_HEADER, LINE_HEADER } from "./derive-center-candidates-v2";
import { CLIENT_HEADER } from "./derive-client-candidates-v2";

type Table = { header: string[]; rows: string[][] };
export const REVIEWED_COUNT_HEADER = [
  "state",
  "code",
  "type",
  "rawCount",
  "status",
  "sourceSheet",
  "sourceRow",
  "sourceColumn",
  "effectiveCount",
  "reviewBasis",
] as const;
export const REVIEWED_RECONCILIATION_HEADER = [
  "sourceSheet",
  "sourceRow",
  "sourceColumn",
  "category",
  "clientCode",
] as const;
const COUNT_HEADER = REVIEWED_COUNT_HEADER.slice(0, 8);
const key = (...parts: string[]) => JSON.stringify(parts);
function rows(table: Table, header: readonly string[]): string[][] {
  if (
    table.header.join("\0") !== header.join("\0") ||
    table.rows.some((row) => row.length !== header.length)
  )
    throw new Error("SCHEMA_INVALID");
  return table.rows;
}
const types: Record<string, readonly string[]> = {
  "Ciudad de México": ["DINAMOMETRO", "FISICO_MECANICA"],
  Querétaro: ["GASOLINA", "DIESEL"],
  Tlaxcala: ["GASOLINA", "DIESEL"],
  México: ["LINEA"],
  Puebla: ["LINEA"],
};

export function deriveCenterReviewed(
  clientsTable: Table,
  countsTable: Table,
  reconciliationTable: Table,
  linesTable: Table,
  equipmentTable: Table,
) {
  const clients = rows(clientsTable, CLIENT_HEADER);
  const counts = rows(countsTable, COUNT_HEADER);
  const issues = rows(reconciliationTable, REVIEWED_RECONCILIATION_HEADER);
  const lines = rows(linesTable, LINE_HEADER);
  const equipment = rows(equipmentTable, EQUIPMENT_HEADER);
  const byClient = new Map<string, string[]>();
  const codeSet = new Set<string>();
  for (const client of clients) {
    const id = key(client[0], client[1]);
    const folded = client[1].toLocaleLowerCase("und");
    if (
      !types[client[0]] ||
      !client[1] ||
      client[2] !== client[1] ||
      !client[3] ||
      !client[7] ||
      !client[8] ||
      !["blocked", "needs_review"].includes(client[9]) ||
      byClient.has(id) ||
      codeSet.has(folded)
    )
      throw new Error("CLIENT_INVALID");
    byClient.set(id, client);
    codeSet.add(folded);
  }
  const byField = new Map<
    string,
    { raw: string[]; effective: number; status: string }
  >();
  const clientFields = new Map<string, string[]>();
  const reviewed: string[][] = [];
  for (const field of counts) {
    const [state, code, type, raw, status, sheet, row, column] = field;
    const id = key(state, code);
    const client = byClient.get(id);
    const fieldKey = key(state, code, type, sheet, row, column);
    if (
      !client ||
      !types[state].includes(type) ||
      sheet !== client[7] ||
      row !== client[8] ||
      !column ||
      byField.has(fieldKey) ||
      (clientFields.get(id) ?? []).includes(type)
    )
      throw new Error("COUNT_LINK_INVALID");
    const blank = status === "blank_primary" || status === "blank_secondary";
    if (
      blank
        ? raw !== ""
        : status !== "valid" || !/^(0|[1-9]\d*)$/.test(raw) || Number(raw) > 100
    )
      throw new Error("COUNT_INVALID");
    const effective = blank ? 0 : Number(raw);
    byField.set(fieldKey, { raw: field, effective, status });
    clientFields.set(id, [...(clientFields.get(id) ?? []), type]);
    reviewed.push([
      ...field.slice(0, 4),
      blank ? "reviewed_zero" : status,
      ...field.slice(5),
      String(effective),
      blank ? "user-approved-all-61" : "",
    ]);
  }
  const updatedClients = clients.map((client) => {
    const id = key(client[0], client[1]);
    const fields = counts.filter((field) => key(field[0], field[1]) === id);
    if (
      (clientFields.get(id) ?? []).join("\0") !== types[client[0]].join("\0") ||
      client[9] !==
        (fields.some((field) => field[4] !== "valid")
          ? "blocked"
          : "needs_review")
    )
      throw new Error("OTHER_CLIENT_BLOCKER_OR_MISSING_COUNT");
    return [...client.slice(0, 9), "needs_review"];
  });
  const positions = new Map<string, number>();
  const lineNames = new Set<string>();
  const updatedLines = lines.map((line) => {
    const [state, code, name, description, status, sheet, row, column, type] =
      line;
    const fieldKey = key(state, code, type, sheet, row, column);
    const field = byField.get(fieldKey);
    const client = byClient.get(key(state, code));
    const n = (positions.get(fieldKey) ?? 0) + 1;
    const link = key(state, code, name);
    if (
      !field ||
      !client ||
      !field.effective ||
      n > field.effective ||
      name !== `${code} ${type} ${n}` ||
      description !== `Source sheet: ${sheet}; count type: ${type}` ||
      status !== (client[9] === "blocked" ? "blocked" : "candidate") ||
      lineNames.has(link)
    )
      throw new Error("LINE_EVIDENCE_INVALID");
    positions.set(fieldKey, n);
    lineNames.add(link);
    return [...line.slice(0, 4), "candidate", ...line.slice(5)];
  });
  for (const [fieldKey, field] of byField)
    if ((positions.get(fieldKey) ?? 0) !== field.effective)
      throw new Error("LINE_COUNT_MISMATCH");
  const equipmentLinks = new Set<string>();
  const updatedEquipment = equipment.map((item) => {
    const [
      state,
      code,
      lineName,
      name,
      status,
      verification,
      approval,
      sheet,
      row,
      column,
      type,
    ] = item;
    const link = key(state, code, lineName);
    const sourceLine = lines.find(
      (line) => key(line[0], line[1], line[2]) === link,
    );
    const number = lineName.slice(`${code} DINAMOMETRO `.length);
    if (
      state !== "Ciudad de México" ||
      type !== "DINAMOMETRO" ||
      !sourceLine ||
      sourceLine.slice(5).join("\0") !==
        [sheet, row, column, type].join("\0") ||
      name !== `DINAMOMETRO ${number}` ||
      status !== sourceLine[4] ||
      verification !== "synthetic_unverified" ||
      approval !== "not_import_approved" ||
      equipmentLinks.has(link)
    )
      throw new Error("EQUIPMENT_INVALID");
    equipmentLinks.add(link);
    return [...item.slice(0, 4), "candidate", ...item.slice(5)];
  });
  if (
    lines
      .filter(
        (line) => line[0] === "Ciudad de México" && line[8] === "DINAMOMETRO",
      )
      .some((line) => !equipmentLinks.has(key(line[0], line[1], line[2])))
  )
    throw new Error("EQUIPMENT_LINK_MISSING");
  const blankIssues = new Set<string>();
  const updatedIssues = issues.map((issue) => {
    const [sheet, row, column, category, code] = issue;
    if (category === "blank_primary" || category === "blank_secondary") {
      const field = counts.find(
        (entry) =>
          entry[1] === code &&
          entry[5] === sheet &&
          entry[6] === row &&
          entry[7] === column &&
          entry[4] === category,
      );
      const id = key(sheet, row, column, code);
      if (!field || blankIssues.has(id)) throw new Error("ISSUE_INVALID");
      blankIssues.add(id);
      return [sheet, row, column, "resolved_zero_by_user", code];
    }
    if (!["total_excluded", "note_excluded"].includes(category))
      throw new Error("OTHER_RECONCILIATION_BLOCKER");
    return [...issue];
  });
  if (
    counts
      .filter((field) => field[4].startsWith("blank_"))
      .some(
        (field) =>
          !blankIssues.has(key(field[5], field[6], field[7], field[1])),
      )
  )
    throw new Error("ISSUE_MISSING");
  return {
    counts: reviewed,
    clients: updatedClients,
    lines: updatedLines,
    equipment: updatedEquipment,
    reconciliation: updatedIssues,
  };
}
