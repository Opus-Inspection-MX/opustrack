/** Pure transformation of validated, private Client candidates. */
export const CLIENT_HEADER = [
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
] as const;

type Table = { header: string[]; rows: string[][] };
const fail = (code: string): never => {
  throw new Error(code);
};
const link = (state: string, code: string) => JSON.stringify([state, code]);

export function deriveClientCandidatesV2(
  source: Table,
  lines: Table,
  equipment: Table,
): string[][] {
  if (source.header.join("\0") !== CLIENT_HEADER.join("\0"))
    fail("CLIENT_HEADER_INVALID");
  if (
    lines.header[0] !== "state" ||
    lines.header[1] !== "clientCode" ||
    lines.header.length !== 9 ||
    equipment.header[0] !== "state" ||
    equipment.header[1] !== "clientCode" ||
    equipment.header.length !== 11
  )
    fail("LINK_HEADER_INVALID");
  const codes = new Set<string>();
  const keys = new Set<string>();
  const result = source.rows.map((row) => {
    if (row.length !== CLIENT_HEADER.length) fail("CLIENT_WIDTH_INVALID");
    const [state, code, name, , , , , sheet, sourceRow, status] = row;
    if (
      !state ||
      !code ||
      !sheet ||
      !sourceRow ||
      name !== "" ||
      !["blocked", "needs_review"].includes(status)
    )
      fail("CLIENT_INVALID");
    const folded = code.toLocaleLowerCase("und");
    if (codes.has(folded) || keys.has(link(state, code)))
      fail("CLIENT_DUPLICATE");
    codes.add(folded);
    keys.add(link(state, code));
    const updated = [...row];
    updated[2] = code;
    return updated;
  });
  for (const table of [lines, equipment]) {
    for (const row of table.rows) {
      if (row.length !== table.header.length || !keys.has(link(row[0], row[1])))
        fail("CLIENT_LINK_INVALID");
    }
  }
  return result;
}
