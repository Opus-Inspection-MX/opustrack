/** Pure offline derivation from the validated v1 candidate and count evidence CSVs. */
export const LINE_HEADER = [
  "state",
  "clientCode",
  "name",
  "description",
  "status",
  "sourceSheet",
  "sourceRow",
  "sourceColumn",
  "type",
] as const;
export const EQUIPMENT_HEADER = [
  "state",
  "clientCode",
  "lineName",
  "name",
  "status",
  "verification",
  "importApproval",
  "sourceSheet",
  "sourceRow",
  "sourceColumn",
  "type",
] as const;

type Table = { header: string[]; rows: string[][] };
const TYPES: Record<string, readonly string[]> = {
  "Ciudad de México": ["DINAMOMETRO", "FISICO_MECANICA"],
  Querétaro: ["GASOLINA", "DIESEL"],
  Tlaxcala: ["GASOLINA", "DIESEL"],
  México: ["LINEA"],
  Puebla: ["LINEA"],
};
const key = (...parts: string[]) => JSON.stringify(parts);
const fail = (code: string): never => {
  throw new Error(code);
};

function records(
  table: Table,
  expected: readonly string[],
): Record<string, string>[] {
  if (
    table.header.length !== expected.length ||
    new Set(table.header).size !== expected.length ||
    expected.some((name) => !table.header.includes(name))
  )
    fail("HEADER_INVALID");
  return table.rows.map((row) => {
    if (row.length !== expected.length) fail("ROW_WIDTH");
    return Object.fromEntries(table.header.map((name, i) => [name, row[i]]));
  });
}

const CLIENT_HEADER = [
  "state",
  "code",
  "name",
  "companyName",
  "contact",
  "phone",
  "email",
  "sourceSheet",
  "sourceRow",
  "status",
];
const COUNT_HEADER = [
  "state",
  "code",
  "type",
  "rawCount",
  "status",
  "sourceSheet",
  "sourceRow",
  "sourceColumn",
];

export function deriveCenterCandidatesV2(
  clientsTable: Table,
  countsTable: Table,
  linesTable: Table,
) {
  const clients = records(clientsTable, CLIENT_HEADER);
  const counts = records(countsTable, COUNT_HEADER);
  const oldLines = records(linesTable, LINE_HEADER);
  const clientByKey = new Map<string, Record<string, string>>();
  for (const client of clients) {
    const id = key(client.state, client.code);
    if (
      !client.code ||
      !TYPES[client.state] ||
      clientByKey.has(id) ||
      !["blocked", "needs_review"].includes(client.status)
    )
      fail("CLIENT_AMBIGUOUS");
    clientByKey.set(id, client);
  }
  const countByField = new Map<
    string,
    { count: number | null; status: string; client: Record<string, string> }
  >();
  const clientTypes = new Set<string>();
  const ordinal = new Map<string, number>();
  for (const field of counts) {
    const client = clientByKey.get(key(field.state, field.code));
    if (!client) throw new Error("COUNT_LINK_INVALID");
    if (
      client.sourceSheet !== field.sourceSheet ||
      client.sourceRow !== field.sourceRow ||
      !TYPES[field.state].includes(field.type) ||
      !field.sourceColumn
    )
      fail("COUNT_LINK_INVALID");
    const id = key(
      field.state,
      field.code,
      field.type,
      field.sourceSheet,
      field.sourceRow,
      field.sourceColumn,
    );
    const typeKey = key(field.state, field.code, field.type);
    if (countByField.has(id) || clientTypes.has(typeKey))
      fail("COUNT_DUPLICATE");
    clientTypes.add(typeKey);
    let count: number | null = null;
    if (field.status === "valid") {
      if (
        !/^(0|[1-9]\d*)$/.test(field.rawCount) ||
        !Number.isSafeInteger(Number(field.rawCount)) ||
        Number(field.rawCount) > 100
      )
        fail("COUNT_INVALID");
      count = Number(field.rawCount);
    } else if (
      field.status === "blank_primary" ||
      field.status === "blank_secondary"
    ) {
      if (field.rawCount !== "" || client.status !== "blocked")
        fail("BLANK_INVALID");
    } else fail("COUNT_STATUS_INVALID");
    countByField.set(id, { count, status: field.status, client });
    ordinal.set(id, 0);
  }
  const lines: string[][] = [];
  const equipment: string[][] = [];
  const names = new Set<string>();
  const links = new Set<string>();
  for (const line of oldLines) {
    const id = key(
      line.state,
      line.clientCode,
      line.type,
      line.sourceSheet,
      line.sourceRow,
      line.sourceColumn,
    );
    const field = countByField.get(id);
    if (
      !field ||
      field.count === null ||
      !line.name ||
      line.status !==
        (field.client.status === "blocked" ? "blocked" : "candidate")
    )
      fail("LINE_EVIDENCE_INVALID");
    const number = (ordinal.get(id) ?? 0) + 1;
    ordinal.set(id, number);
    const name = `${line.clientCode} ${line.type} ${number}`;
    const link = key(line.state, line.clientCode, name);
    if (names.has(link) || number > 999) fail("LINE_COLLISION");
    names.add(link);
    lines.push([
      line.state,
      line.clientCode,
      name,
      `Source sheet: ${line.sourceSheet}; count type: ${line.type}`,
      line.status,
      line.sourceSheet,
      line.sourceRow,
      line.sourceColumn,
      line.type,
    ]);
    if (line.state === "Ciudad de México" && line.type === "DINAMOMETRO") {
      if (links.has(link)) fail("EQUIPMENT_COLLISION");
      links.add(link);
      equipment.push([
        line.state,
        line.clientCode,
        name,
        `DINAMOMETRO ${number}`,
        line.status,
        "synthetic_unverified",
        "not_import_approved",
        line.sourceSheet,
        line.sourceRow,
        line.sourceColumn,
        line.type,
      ]);
    }
  }
  for (const [id, field] of countByField) {
    if ((ordinal.get(id) ?? 0) !== (field.count ?? 0)) fail("COUNT_MISMATCH");
  }
  if (equipment.some((row) => !names.has(key(row[0], row[1], row[2]))))
    fail("EQUIPMENT_LINK_INVALID");
  return { lines, equipment };
}
