/** Pure, synthetic one-per-line CDMX Equipment candidates; never import approval. */
import { EQUIPMENT_HEADER, LINE_HEADER } from "./derive-center-candidates-v2";
import { CLIENT_HEADER } from "./derive-client-candidates-v2";

type Table = { header: string[]; rows: string[][] };
const cdmx = "Ciudad de México";
const key = (...parts: string[]) => JSON.stringify(parts);

function records(table: Table, header: readonly string[]) {
  if (
    table.header.join("\0") !== header.join("\0") ||
    table.rows.some((row) => row.length !== header.length)
  )
    throw new Error("SCHEMA_INVALID");
  return table.rows;
}

export function deriveCdmxEquipmentV3(
  clientsTable: Table,
  linesTable: Table,
  equipmentTable: Table,
) {
  const clients = records(clientsTable, CLIENT_HEADER);
  const lines = records(linesTable, LINE_HEADER);
  const previous = records(equipmentTable, EQUIPMENT_HEADER);
  const byClient = new Map<string, string[]>();
  const codes = new Set<string>();
  for (const client of clients) {
    const id = key(client[0], client[1]);
    const folded = client[1].toLocaleLowerCase("und");
    if (
      !client[0] ||
      !client[1] ||
      client[2] !== client[1] ||
      !client[3] ||
      !client[7] ||
      !client[8] ||
      client[9] !== "needs_review" ||
      byClient.has(id) ||
      codes.has(folded)
    )
      throw new Error("CLIENT_INVALID");
    byClient.set(id, client);
    codes.add(folded);
  }
  const byLine = new Map<string, string[]>();
  const ordinal = new Map<string, number>();
  const physical: string[][] = [];
  for (const line of lines) {
    const [state, code, name, description, status, sheet, row, column, type] =
      line;
    const client = byClient.get(key(state, code));
    const typeKey = key(state, code, type);
    const n = (ordinal.get(typeKey) ?? 0) + 1;
    const link = key(state, code, name);
    if (
      !client ||
      !column ||
      sheet !== client[7] ||
      row !== client[8] ||
      !type ||
      name !== `${code} ${type} ${n}` ||
      description !== `Source sheet: ${sheet}; count type: ${type}` ||
      status !== "candidate" ||
      byLine.has(link) ||
      (state === cdmx && !["DINAMOMETRO", "FISICO_MECANICA"].includes(type))
    )
      throw new Error("LINE_INVALID");
    ordinal.set(typeKey, n);
    byLine.set(link, line);
    if (state === cdmx && type === "FISICO_MECANICA")
      physical.push([
        state,
        code,
        name,
        `FISICOMECANICA ${n}`,
        status,
        "synthetic_unverified",
        "not_import_approved",
        sheet,
        row,
        column,
        type,
      ]);
  }
  const linked = new Set<string>();
  for (const item of previous) {
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
    const source = byLine.get(link);
    if (
      state !== cdmx ||
      type !== "DINAMOMETRO" ||
      !source ||
      source[8] !== type ||
      name !== lineName.slice(`${code} `.length) ||
      status !== source[4] ||
      verification !== "synthetic_unverified" ||
      approval !== "not_import_approved" ||
      [sheet, row, column].join("\0") !== source.slice(5, 8).join("\0") ||
      linked.has(link)
    )
      throw new Error("PREVIOUS_EQUIPMENT_INVALID");
    linked.add(link);
  }
  for (const [link, line] of byLine) {
    if (line[0] === cdmx && line[8] === "DINAMOMETRO" && !linked.has(link))
      throw new Error("EQUIPMENT_LINK_MISSING");
  }
  for (const item of physical) {
    const link = key(item[0], item[1], item[2]);
    if (!byLine.has(link) || linked.has(link))
      throw new Error("EQUIPMENT_DUPLICATE");
    linked.add(link);
  }
  if (
    [...byLine.values()].filter((line) => line[0] === cdmx).length !==
    linked.size
  )
    throw new Error("EQUIPMENT_COUNT_MISMATCH");
  return {
    rows: [...previous.map((item) => [...item]), ...physical],
    dynamometers: previous.length,
    physical: physical.length,
  };
}
