/** Pure, offline review candidates. No row can authorize an import. */
export type CsvTable = { header: string[]; rows: string[][] };

function column(header: string[], pattern: RegExp): number {
  const matches = header.flatMap((name, index) =>
    pattern.test(name) ? [index] : [],
  );
  if (matches.length !== 1) throw new Error("SOURCE_SCHEMA_INVALID");
  return matches[0];
}

function validate(table: CsvTable) {
  if (
    !table.header.length ||
    new Set(table.header).size !== table.header.length ||
    table.rows.some((row) => row.length !== table.header.length)
  )
    throw new Error("SOURCE_SCHEMA_INVALID");
}

function tokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function amount(value: string): number | null {
  const cleaned = value.trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

export const REVIEW_HEADER = [
  "rawInputSha256",
  "sourceSheet",
  "sourceRow",
  "cycleYear",
  "proposedUserCandidateKey",
  "proposedFundingPeriodKey",
  "matchStatus",
  "sourceAggregateArithmetic",
  "sourceHireDateStatus",
  "exceptionCategories",
  "reviewStatus",
  "importApproved",
] as const;

export function deriveVacationReview(
  source: CsvTable,
  users: CsvTable,
  digest: string,
) {
  validate(source);
  validate(users);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("SOURCE_DIGEST_INVALID");
  const sourceSheet = column(source.header, /^(?:source_?sheet|sheet)$/i);
  const sourceRow = column(source.header, /^(?:source_?row|row)$/i);
  const sourceName = column(source.header, /^name$/i);
  const entitled = column(source.header, /^raw.*entitl/i);
  const taken = column(
    source.header,
    /^raw.*(?:days.*taken|taken.*days|taken$)/i,
  );
  const remaining = column(
    source.header,
    /^raw.*(?:remain|saldo|balance|pending)/i,
  );
  const hire = column(source.header, /^raw.*(?:hire|ingres)/i);
  const userName = column(users.header, /^name$/i);
  const userKey = column(users.header, /^candidate_key$/i);
  const importable = column(users.header, /^importable$/i);
  const userReview = column(users.header, /^review_status$/i);
  const canonical = users.rows.filter(
    (row) =>
      row[importable].toLowerCase() === "true" &&
      !row[userReview].toLowerCase().includes("alias"),
  );
  if (
    canonical.length !== 24 ||
    new Set(canonical.map((row) => row[userKey])).size !== 24 ||
    canonical.some((row) => !row[userKey] || !tokens(row[userName]).length)
  )
    throw new Error("USER_CANDIDATES_INVALID");
  const seen = new Set<string>();
  const rows = source.rows.map((row) => {
    const sheet = row[sourceSheet];
    const ordinal = row[sourceRow];
    const labels = [...sheet.matchAll(/(20\d{2})\s*[-–—]\s*20\d{2}/g)];
    if (labels.length !== 1 || !/^[1-9]\d*$/.test(ordinal))
      throw new Error("PROVENANCE_INVALID");
    const sourceKey = `${sheet}\0${ordinal}`;
    if (seen.has(sourceKey)) throw new Error("PROVENANCE_DUPLICATE");
    seen.add(sourceKey);
    const name = tokens(row[sourceName]);
    const same = canonical.filter(
      (user) => tokens(user[userName]).join(" ") === name.join(" "),
    );
    // Move a whole leading name block to the end; never rearrange individual tokens.
    const reorderedNames = new Set(
      name
        .slice(1)
        .map((_, index) =>
          [...name.slice(index + 1), ...name.slice(0, index + 1)].join(" "),
        ),
    );
    const reversed = canonical.filter((user) =>
      reorderedNames.has(tokens(user[userName]).join(" ")),
    );
    const candidates = new Set([...same, ...reversed]);
    const matchStatus =
      candidates.size > 1
        ? "ambiguous"
        : candidates.size === 0
          ? "unmatched"
          : same.length
            ? "exact"
            : "reordered";
    const key = candidates.size === 1 ? [...candidates][0][userKey] : "";
    const [grant, used, balance] = [entitled, taken, remaining].map((index) =>
      amount(row[index]),
    );
    const arithmetic =
      grant === null || used === null || balance === null
        ? "partial"
        : grant >= used && grant - used === balance
          ? "complete"
          : "inconsistent";
    const rawHire = row[hire].trim();
    const hireStatus = /^\d+(?:\.\d+)?$/.test(rawHire)
      ? "numeric"
      : /(?:^|\D)\d{1,2}[-/.](?:\d{1,2}|[a-zA-Z]{3,})[-/.]\d{2}(?:\D|$)/.test(
            rawHire,
          )
        ? "ambiguous"
        : "unavailable";
    const issues = [
      ...(matchStatus === "exact" ? [] : [matchStatus]),
      ...(arithmetic === "complete" ? [] : [arithmetic]),
      ...(hireStatus === "numeric" ? [] : [`hire_${hireStatus}`]),
      "identity_unverified",
      "funding_unverified",
    ];
    return [
      digest,
      sheet,
      ordinal,
      labels[0][1],
      key,
      "",
      matchStatus,
      arithmetic,
      hireStatus,
      issues.join(";"),
      "PENDING",
      "false",
      ...row,
    ];
  });
  return {
    header: [
      ...REVIEW_HEADER,
      ...source.header.map((name) => `source_${name}`),
    ],
    rows,
  };
}
