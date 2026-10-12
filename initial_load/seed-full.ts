/**
 * Guarded private one-step full seed — T8d builder (NOT YET RUN, review pending).
 *
 * Target: a wiped database (`prisma migrate reset --skip-seed` style) that must
 * converge in ONE explicit step to catalog baseline + approved private data.
 * Production target is neondb; the complete private seed is prepared BEFORE any
 * reset. This file holds NO private values — only code plus the private CSV
 * paths already documented in the workbooks plan.
 *
 * Usage:
 *   npx tsx initial_load/seed-full.ts --dry-run   # validate inputs, print
 *                                                  # aggregate counts, touch
 *                                                  # nothing (no DB, no files)
 *   npx tsx initial_load/seed-full.ts              # full seed (empty DB only,
 *                                                  # review-gated, one step)
 *
 * Contract:
 * - Catalog baseline mirrors ignored `initial_load/seed.ts` by importing the
 *   SAME shared sources directly (PERMISSION_LIST / resolveSeedGrants,
 *   SYSTEM_* , defaultChannelPolicies). `seed.ts` self-executes its main, so
 *   it is never imported — parity was verified by call-site comparison
 *   (22 tx models, identical operation profile) instead.
 * - The 17 legacy test users are SKIPPED entirely (no password123 accounts).
 *   The 12 test clients are skipped; only the SIN-CENTRO system placeholder
 *   (visual fallback, not test data) is kept from the old client section.
 * - Real data loads ONLY from ignored private CSVs with strict header/width
 *   validation, failing closed on schema drift. Two-phase: validate everything
 *   first; execute only with zero blocking exceptions.
 * - Vacation: calendar periods only for users WITH a verified hire date;
 *   hire dates resolve in two tiers (exact person-key ISO date wins, else a
 *   normalized-name fallback on ISO hire_date values only, single distinct
 *   date per user — conflict/ambiguous/text stays null and counts as skipped);
 *   historical rows only for APPROVED + linked review rows (currently zero —
 *   imports zero and logs the count, never auto-approves PENDING).
 * - Per-user random passwords are written ONCE to ignored
 *   `initial_load/credentials.csv` (O_EXCL, mode 0600, fsync) BEFORE any user
 *   row is created; the run aborts if that file already exists.
 * - Output is aggregate counts per model + exception categories, never values.
 *   Error messages carry file:line:category only.
 */

import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Prisma } from "@prisma/client";
import {
  PERMISSION_LIST,
  resolveSeedGrants,
} from "../src/lib/authz/permission-catalog";
import { SEED_ROLE_CODES } from "../src/lib/authz/roles";
import {
  SYSTEM_ASSIGNMENT_STATUSES,
  SYSTEM_INCIDENT_STATUSES,
  SYSTEM_USER_STATUSES,
  SYSTEM_VACATION_STATUSES,
  SYSTEM_VEHICLE_STATUSES,
  SYSTEM_VEHICLE_TRIP_STATUSES,
} from "../src/lib/catalog/system-states";
import { prisma } from "../src/lib/database/prisma.singleton";
import { defaultChannelPolicies } from "../src/lib/notifications/catalog";
import { hashPassword } from "../src/lib/security/hash";
import { ensureCalendarPeriodsForUser } from "../src/lib/services/vacation-periods";
import { parseCsv, toCsvRow } from "./csv";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const USERS_CSV = path.join(MODULE_DIR, "users.csv");
const HIRE_EVIDENCE_CSV = path.join(MODULE_DIR, "vacation-balances.csv");
const CLIENTES_CSV = path.join(MODULE_DIR, "clientes-v3.csv");
const LINES_CSV = path.join(MODULE_DIR, "line-candidates-v3.csv");
const EQUIPMENT_CSV = path.join(MODULE_DIR, "equipment-candidates-cdmx-v3.csv");
const VACATION_REVIEW_CSV = path.join(MODULE_DIR, "vacation-review.csv");
const CREDENTIALS_CSV = path.join(MODULE_DIR, "credentials.csv");

/** Exact expected headers — field names only, no private values. */
export const USERS_HEADER = [
  "source_sheet",
  "source_row",
  "candidate_key",
  "name",
  "email",
  "source_category",
  "job_position",
  "reviewed_job_title",
  "proposed_grant",
  "review_status",
  "alias_of",
  "importable",
  "email_status",
  "email_review",
] as const;

export const HIRE_EVIDENCE_HEADER = [
  "source_sheet",
  "source_row",
  "candidate_key",
  "period_year",
  "name",
  "person_candidate_key",
  "review_status",
  "hire_date",
  "years_of_service",
  "entitled_days",
  "taken_days",
  "pending_days",
  "raw_hire_date",
  "raw_years_of_service",
  "raw_taken_dates",
  "raw_entitled_days",
  "raw_taken_days",
  "raw_pending_days",
  "raw_notes",
  "raw_extra",
] as const;

export const CLIENTES_HEADER = [
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

export const LINES_HEADER = [
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

export const VACATION_REVIEW_HEADER = [
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
  "source_source_sheet",
  "source_source_row",
  "source_candidate_key",
  "source_period_year",
  "source_name",
  "source_person_candidate_key",
  "source_review_status",
  "source_hire_date",
  "source_years_of_service",
  "source_entitled_days",
  "source_taken_days",
  "source_pending_days",
  "source_raw_hire_date",
  "source_raw_years_of_service",
  "source_raw_taken_dates",
  "source_raw_entitled_days",
  "source_raw_taken_days",
  "source_raw_pending_days",
  "source_raw_notes",
  "source_raw_extra",
] as const;

/**
 * Input failure. The message carries file:line:category ONLY — never a field
 * value — so a validation failure cannot leak a private row into logs.
 */
export class SeedInputError extends Error {
  constructor(
    readonly file: string,
    readonly line: number,
    readonly category: string,
  ) {
    super(`${file}:${line}: ${category}`);
  }
}

/** Strict header equality: any drift fails closed. */
export function assertHeader(
  file: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  const same =
    actual.length === expected.length &&
    actual.every((cell, index) => cell === expected[index]);
  if (!same) throw new SeedInputError(file, 1, "header drift");
}

function requireCell(
  file: string,
  line: number,
  cells: readonly string[],
  index: number,
  category: string,
): string {
  const value = cells[index]?.trim() ?? "";
  if (!value) throw new SeedInputError(file, line, category);
  return value;
}

/** Column position by header name — throws on drift instead of guessing. */
export function columnIndex(
  file: string,
  header: readonly string[],
  name: string,
): number {
  const index = header.indexOf(name);
  if (index < 0) throw new SeedInputError(file, 1, `missing column ${name}`);
  return index;
}

export interface UserRow {
  candidateKey: string;
  name: string;
  email: string;
  jobPosition: string;
  grants: string[];
  reviewStatus: string;
  importable: boolean;
}

/** Width + required-field gate for one users.csv data row. */
export function mapUserRow(
  file: string,
  line: number,
  cells: readonly string[],
): UserRow {
  if (cells.length !== USERS_HEADER.length)
    throw new SeedInputError(file, line, "width drift");
  const at = (name: string) =>
    cells[columnIndex(file, [...USERS_HEADER], name)] ?? "";
  const candidateKey = requireCell(file, line, cells, 2, "missing key");
  const name = requireCell(file, line, cells, 3, "missing name");
  const email = requireCell(file, line, cells, 4, "missing email");
  if (!email.includes("@")) throw new SeedInputError(file, line, "bad email");
  const reviewedTitle = at("reviewed_job_title").trim();
  const jobPosition = reviewedTitle || at("job_position").trim();
  const importable = at("importable").trim() === "true";
  return {
    candidateKey,
    name,
    email,
    jobPosition,
    grants: splitGrants(at("proposed_grant")),
    reviewStatus: at("review_status").trim(),
    importable,
  };
}

/** `ADMIN_OPERACION|ADMIN_VACACIONES`-style grant lists. */
export function splitGrants(raw: string): string[] {
  return raw
    .split("|")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/** Every grant token must be a known seed role — typos fail closed. */
export function assertKnownGrants(
  file: string,
  line: number,
  grants: readonly string[],
  known: readonly string[] = SEED_ROLE_CODES,
): void {
  for (const grant of grants) {
    if (!known.includes(grant))
      throw new SeedInputError(file, line, "unknown grant");
  }
}

export interface ClientRow {
  state: string;
  code: string;
  companyName: string;
  contact: string;
  phone: string;
  email: string;
}

export function mapClientRow(
  file: string,
  line: number,
  cells: readonly string[],
): ClientRow {
  if (cells.length !== CLIENTES_HEADER.length)
    throw new SeedInputError(file, line, "width drift");
  return {
    state: requireCell(file, line, cells, 0, "missing state"),
    code: requireCell(file, line, cells, 1, "missing code"),
    companyName: cells[3] ?? "",
    contact: cells[4] ?? "",
    phone: cells[5] ?? "",
    email: cells[6] ?? "",
  };
}

export interface LineRow {
  state: string;
  clientCode: string;
  name: string;
  description: string;
}

export function mapLineRow(
  file: string,
  line: number,
  cells: readonly string[],
): LineRow {
  if (cells.length !== LINES_HEADER.length)
    throw new SeedInputError(file, line, "width drift");
  return {
    state: requireCell(file, line, cells, 0, "missing state"),
    clientCode: requireCell(file, line, cells, 1, "missing client link"),
    name: requireCell(file, line, cells, 2, "missing name"),
    description: cells[3] ?? "",
  };
}

export interface EquipmentRow {
  state: string;
  clientCode: string;
  lineName: string;
  name: string;
}

export function mapEquipmentRow(
  file: string,
  line: number,
  cells: readonly string[],
): EquipmentRow {
  if (cells.length !== EQUIPMENT_HEADER.length)
    throw new SeedInputError(file, line, "width drift");
  return {
    state: requireCell(file, line, cells, 0, "missing state"),
    clientCode: requireCell(file, line, cells, 1, "missing client link"),
    lineName: requireCell(file, line, cells, 2, "missing line link"),
    name: requireCell(file, line, cells, 3, "missing name"),
  };
}

/** Strict YYYY-MM-DD — the only hire-date shape trusted for import. */
export function parseIsoDateOnly(raw: string): Date | null {
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Round-trip guard: 2021-02-30 must not silently become March.
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

/**
 * Verified hire-date evidence per person key. A key qualifies only with
 * exactly ONE distinct ISO date across all its evidence rows — conflicting or
 * text-only evidence resolves to null (fail closed, reported as skipped).
 */
export function buildHireDateIndex(
  rows: readonly { personKey: string; hireDate: string }[],
): Map<string, Date | null> {
  const seen = new Map<string, Set<string>>();
  for (const row of rows) {
    const iso = parseIsoDateOnly(row.hireDate);
    if (!iso) continue;
    const day = iso.toISOString().slice(0, 10);
    const bucket = seen.get(row.personKey) ?? new Set<string>();
    bucket.add(day);
    seen.set(row.personKey, bucket);
  }
  const index = new Map<string, Date | null>();
  for (const [key, days] of seen) {
    index.set(
      key,
      days.size === 1 ? new Date(`${[...days][0]}T00:00:00Z`) : null,
    );
  }
  return index;
}

export function resolveHireDate(
  index: Map<string, Date | null>,
  personKey: string,
): Date | null {
  return index.get(personKey) ?? null;
}

/**
 * Tier-2 fallback token rules — intentionally the same normalization as
 * `scripts/derive-vacation-review.ts` (`tokens()` there is not exported, so
 * the minimal logic is duplicated here and pinned by synthetic tests).
 * NFKD + strip marks + lowercase + non-alphanumeric to space.
 */
export function tokenizeHireName(raw: string): string[] {
  return raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function hireNameKey(tokens: readonly string[]): string {
  return tokens.join(" ");
}

/**
 * Reversible whole-block rotations only (move a leading block to the end).
 * Never rearranges individual tokens — same rule as derive-vacation-review.
 */
export function hireReorderedNameKeys(tokens: readonly string[]): Set<string> {
  return new Set(
    tokens
      .slice(1)
      .map((_, index) =>
        [...tokens.slice(index + 1), ...tokens.slice(0, index + 1)].join(" "),
      ),
  );
}

export interface HireNameUser {
  candidateKey: string;
  name: string;
}

export interface HireNameEvidenceRow {
  name: string;
  hireDate: string;
}

/**
 * Tier-2 index: normalized-name matching against `hire_date` ISO values ONLY.
 * A hire row contributes to a user only when it matches EXACTLY ONE user
 * (exact token join or whole-block rotation) and carries a strict ISO date.
 * Text/blank dates never contribute. Per user, exactly ONE distinct ISO date
 * across all attributed rows resolves; zero rows or conflicting dates yield
 * null (fail closed, counted as skipped — never a guess).
 */
export function buildNameMatchHireIndex(
  users: readonly HireNameUser[],
  rows: readonly HireNameEvidenceRow[],
): Map<string, Date | null> {
  const userTokens = new Map<string, { key: string; rotated: Set<string> }>();
  for (const user of users) {
    const tokens = tokenizeHireName(user.name);
    if (tokens.length === 0 || !user.candidateKey) continue;
    userTokens.set(user.candidateKey, {
      key: hireNameKey(tokens),
      rotated: hireReorderedNameKeys(tokens),
    });
  }
  const buckets = new Map<string, Set<string>>();
  for (const row of rows) {
    const iso = parseIsoDateOnly(row.hireDate);
    if (!iso) continue;
    const day = iso.toISOString().slice(0, 10);
    const tokens = tokenizeHireName(row.name);
    if (tokens.length === 0) continue;
    const key = hireNameKey(tokens);
    const matched: string[] = [];
    for (const [candidateKey, entry] of userTokens) {
      if (entry.key === key || entry.rotated.has(key))
        matched.push(candidateKey);
    }
    if (matched.length !== 1) continue;
    const only = matched[0] as string;
    const bucket = buckets.get(only) ?? new Set<string>();
    bucket.add(day);
    buckets.set(only, bucket);
  }
  const index = new Map<string, Date | null>();
  for (const [candidateKey, days] of buckets) {
    index.set(
      candidateKey,
      days.size === 1 ? new Date(`${[...days][0]}T00:00:00Z`) : null,
    );
  }
  return index;
}

export type HireProvenance = "exact_key" | "name_match" | "skipped";

/**
 * Two-tier resolution WITHOUT changing exact-key semantics: a non-null exact
 * person-key date always wins; otherwise the name-match tier applies.
 */
export function hireProvenanceFor(
  exactIndex: Map<string, Date | null>,
  fallbackIndex: Map<string, Date | null>,
  personKey: string,
): HireProvenance {
  if (resolveHireDate(exactIndex, personKey)) return "exact_key";
  if (fallbackIndex.get(personKey)) return "name_match";
  return "skipped";
}

export function resolveSeedHireDate(
  exactIndex: Map<string, Date | null>,
  fallbackIndex: Map<string, Date | null>,
  personKey: string,
): Date | null {
  return (
    resolveHireDate(exactIndex, personKey) ??
    fallbackIndex.get(personKey) ??
    null
  );
}

/** Accent/case/space-insensitive state matching; ambiguity fails closed. */
export function normalizeStateName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveStateId(
  want: string,
  states: readonly { id: number; name: string }[],
): number {
  const exact = states.find((state) => state.name === want.trim());
  if (exact) return exact.id;
  const normalized = normalizeStateName(want);
  const matches = states.filter(
    (state) => normalizeStateName(state.name) === normalized,
  );
  if (matches.length === 1 && matches[0]) return matches[0].id;
  throw new Error("Unresolved state");
}

export interface VacationReviewRow {
  cycleYear: number;
  userKey: string;
  fundingKey: string;
  reviewStatus: string;
  importApproved: boolean;
  sourceDigest: string;
  sourceSheet: string;
  sourceRow: number;
  entitled: number;
  taken: number;
  remaining: number;
}

function parseNonnegInt(
  file: string,
  line: number,
  raw: string,
  category: string,
): number {
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value) || value < 0)
    throw new SeedInputError(file, line, category);
  return value;
}

/** Width + shape gate for one vacation-review.csv data row. */
export function mapVacationReviewRow(
  file: string,
  line: number,
  cells: readonly string[],
  header: readonly string[],
): VacationReviewRow {
  if (cells.length !== VACATION_REVIEW_HEADER.length)
    throw new SeedInputError(file, line, "width drift");
  const at = (name: string) => cells[columnIndex(file, header, name)] ?? "";
  const digest = at("rawInputSha256").trim();
  if (!/^[0-9a-f]{64}$/.test(digest))
    throw new SeedInputError(file, line, "bad digest");
  const cycleYear = parseNonnegInt(file, line, at("cycleYear"), "bad cycle");
  if (cycleYear < 1000 || cycleYear > 9998)
    throw new SeedInputError(file, line, "bad cycle");
  const sourceRow = parseNonnegInt(
    file,
    line,
    at("source_source_row"),
    "bad row",
  );
  if (sourceRow <= 0) throw new SeedInputError(file, line, "bad row");
  const entitled = parseNonnegInt(
    file,
    line,
    at("source_entitled_days"),
    "bad days",
  );
  const taken = parseNonnegInt(file, line, at("source_taken_days"), "bad days");
  // No `source_remaining_days` column exists: the "por tomar" balance
  // evidence lives in `source_pending_days` (reviewed classification reads
  // positive remaining days from it). Approved rows must satisfy
  // entitled - taken = pending before debiting.
  const remaining = parseNonnegInt(
    file,
    line,
    at("source_pending_days"),
    "bad days",
  );
  const sourceSheet = at("source_source_sheet").trim();
  if (!sourceSheet) throw new SeedInputError(file, line, "missing sheet");
  return {
    cycleYear,
    userKey: at("proposedUserCandidateKey").trim(),
    fundingKey: at("proposedFundingPeriodKey").trim(),
    reviewStatus: at("reviewStatus").trim(),
    importApproved: at("importApproved").trim() === "true",
    sourceDigest: digest,
    sourceSheet,
    sourceRow,
    entitled,
    taken,
    remaining,
  };
}

/**
 * Import gate: only an APPROVED row with an explicit funding link qualifies.
 * Anything else is skipped and counted — PENDING is never auto-approved.
 */
export function isImportableReview(row: VacationReviewRow): boolean {
  return (
    row.reviewStatus === "APPROVED" &&
    row.importApproved &&
    row.userKey.length > 0 &&
    row.fundingKey.length > 0
  );
}

interface SeedPlan {
  users: UserRow[];
  hireSkipped: number;
  hireExact: number;
  hireNameMatch: number;
  grantSkipped: number;
  clients: ClientRow[];
  lines: LineRow[];
  equipment: EquipmentRow[];
  approvedReviews: VacationReviewRow[];
  pendingReviews: number;
  rejectedReviews: number;
  hireIndex: Map<string, Date | null>;
  hireFallbackIndex: Map<string, Date | null>;
  counts: Record<string, number>;
}

/** Read one private CSV with strict header/width validation. */
async function readStrictCsv(
  absPath: string,
  label: string,
  expected: readonly string[],
): Promise<{ header: string[]; rows: string[][] }> {
  const text = await readFile(absPath, "utf8");
  const parsed = parseCsv(text);
  if (parsed.length === 0 || !parsed[0])
    throw new SeedInputError(label, 1, "empty file");
  assertHeader(label, parsed[0], expected);
  return { header: parsed[0], rows: parsed.slice(1) };
}

/** Phase 1: validate every input, build the plan, count exceptions. */
export async function buildSeedPlan(): Promise<SeedPlan> {
  const counts: Record<string, number> = {};
  const usersFile = await readStrictCsv(USERS_CSV, "users.csv", USERS_HEADER);
  const hireFile = await readStrictCsv(
    HIRE_EVIDENCE_CSV,
    "vacation-balances.csv",
    HIRE_EVIDENCE_HEADER,
  );
  const clientesFile = await readStrictCsv(
    CLIENTES_CSV,
    "clientes-v3.csv",
    CLIENTES_HEADER,
  );
  const linesFile = await readStrictCsv(
    LINES_CSV,
    "line-candidates-v3.csv",
    LINES_HEADER,
  );
  const equipmentFile = await readStrictCsv(
    EQUIPMENT_CSV,
    "equipment-candidates-cdmx-v3.csv",
    EQUIPMENT_HEADER,
  );
  const reviewFile = await readStrictCsv(
    VACATION_REVIEW_CSV,
    "vacation-review.csv",
    VACATION_REVIEW_HEADER,
  );

  const hirePersonIdx = columnIndex(
    "vacation-balances.csv",
    hireFile.header,
    "person_candidate_key",
  );
  const hireDateIdx = columnIndex(
    "vacation-balances.csv",
    hireFile.header,
    "hire_date",
  );
  const hireNameIdx = columnIndex(
    "vacation-balances.csv",
    hireFile.header,
    "name",
  );
  const hireIndex = buildHireDateIndex(
    hireFile.rows.map((cells) => ({
      personKey: cells[hirePersonIdx] ?? "",
      hireDate: cells[hireDateIdx] ?? "",
    })),
  );

  // Users: importable + reviewed grants only; aliases never import.
  // Non-importable rows (e.g. duplicate aliases without an email) skip
  // strict mapping after the width gate — they are not seed inputs.
  const importableIdx = columnIndex(
    "users.csv",
    [...USERS_HEADER],
    "importable",
  );
  const users: UserRow[] = [];
  let grantSkipped = 0;
  usersFile.rows.forEach((cells, position) => {
    const line = position + 2;
    if (cells.length !== USERS_HEADER.length)
      throw new SeedInputError("users.csv", line, "width drift");
    if ((cells[importableIdx] ?? "").trim() !== "true") return;
    const row = mapUserRow("users.csv", line, cells);
    assertKnownGrants("users.csv", line, row.grants);
    if (row.grants.length === 0) {
      grantSkipped += 1;
      return;
    }
    users.push(row);
  });
  const userKeys = new Set(users.map((row) => row.candidateKey));
  if (userKeys.size !== users.length)
    throw new SeedInputError("users.csv", 0, "duplicate key");

  // Hire dates resolve per user in two tiers (exact person-key first, then
  // normalized-name fallback on ISO hire_date values only). Unverified stays
  // null (counted, not blocked). The exact-key index semantics above are
  // unchanged; the fallback only applies when it yields no date.
  const hireFallbackIndex = buildNameMatchHireIndex(
    users.map((row) => ({ candidateKey: row.candidateKey, name: row.name })),
    hireFile.rows.map((cells) => ({
      name: cells[hireNameIdx] ?? "",
      hireDate: cells[hireDateIdx] ?? "",
    })),
  );
  let hireSkipped = 0;
  let hireExact = 0;
  let hireNameMatch = 0;
  for (const user of users) {
    const tier = hireProvenanceFor(
      hireIndex,
      hireFallbackIndex,
      user.candidateKey,
    );
    if (tier === "exact_key") hireExact += 1;
    else if (tier === "name_match") hireNameMatch += 1;
    else hireSkipped += 1;
  }

  const clients = clientesFile.rows.map((cells, position) =>
    mapClientRow("clientes-v3.csv", position + 2, cells),
  );
  const clientCodes = new Set(clients.map((row) => row.code));
  if (clientCodes.size !== clients.length)
    throw new SeedInputError("clientes-v3.csv", 0, "duplicate key");

  const lines = linesFile.rows.map((cells, position) =>
    mapLineRow("line-candidates-v3.csv", position + 2, cells),
  );
  const lineKeys = new Set(lines.map((row) => `${row.clientCode}␟${row.name}`));
  if (lineKeys.size !== lines.length)
    throw new SeedInputError("line-candidates-v3.csv", 0, "duplicate key");
  lines.forEach((row, position) => {
    if (!clientCodes.has(row.clientCode))
      throw new SeedInputError(
        "line-candidates-v3.csv",
        position + 2,
        "unknown client",
      );
  });

  const equipment = equipmentFile.rows.map((cells, position) =>
    mapEquipmentRow("equipment-candidates-cdmx-v3.csv", position + 2, cells),
  );
  equipment.forEach((row, position) => {
    if (!lineKeys.has(`${row.clientCode}␟${row.lineName}`))
      throw new SeedInputError(
        "equipment-candidates-cdmx-v3.csv",
        position + 2,
        "unknown line",
      );
  });

  // Vacation review: only APPROVED + linked rows import (currently zero).
  let pendingReviews = 0;
  let rejectedReviews = 0;
  const approvedReviews: VacationReviewRow[] = [];
  reviewFile.rows.forEach((cells, position) => {
    const line = position + 2;
    const row = mapVacationReviewRow(
      "vacation-review.csv",
      line,
      cells,
      reviewFile.header,
    );
    if (isImportableReview(row)) {
      if (!userKeys.has(row.userKey))
        throw new SeedInputError("vacation-review.csv", line, "unknown user");
      approvedReviews.push(row);
      return;
    }
    if (row.reviewStatus === "PENDING") pendingReviews += 1;
    else if (row.reviewStatus === "REJECTED") rejectedReviews += 1;
    else throw new SeedInputError("vacation-review.csv", line, "bad status");
  });

  counts["users.parsed"] = users.length;
  counts["users.hireExact"] = hireExact;
  counts["users.hireNameMatch"] = hireNameMatch;
  counts["users.hireSkipped"] = hireSkipped;
  counts["users.grantSkipped"] = grantSkipped;
  counts["clients.parsed"] = clients.length;
  counts["lines.parsed"] = lines.length;
  counts["equipment.parsed"] = equipment.length;
  counts["reviews.approved"] = approvedReviews.length;
  counts["reviews.pending"] = pendingReviews;
  counts["reviews.rejected"] = rejectedReviews;

  return {
    users,
    hireSkipped,
    hireExact,
    hireNameMatch,
    grantSkipped,
    clients,
    lines,
    equipment,
    approvedReviews,
    pendingReviews,
    rejectedReviews,
    hireIndex,
    hireFallbackIndex,
    counts,
  };
}

/** Current CDMX calendar year — the ceiling for calendar-cycle grants. */
export function currentCdmxYear(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
    }).format(now),
  );
}

/**
 * Credentials are generated and fsynced to the ignored credentials file
 * BEFORE any user row exists. O_EXCL: an existing file aborts the run instead
 * of rotating live passwords.
 */
async function writeCredentialsOnce(
  entries: readonly { email: string; password: string }[],
): Promise<void> {
  const body = `${toCsvRow(["email", "password"])}\n${entries
    .map((entry) => toCsvRow([entry.email, entry.password]))
    .join("\n")}\n`;
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      CREDENTIALS_CSV,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(
        "initial_load/credentials.csv already exists: refusing to rotate passwords. Remove it deliberately to retry.",
      );
    }
    throw error;
  }
  try {
    await handle.writeFile(body, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

type TxClient = Prisma.TransactionClient;

/**
 * Catalog baseline — the SAME rows as ignored seed.ts, sourced from the SAME
 * shared modules (never stale inline copies for permissions, roles, system
 * states or channel policies). Literals below exist ONLY where no shared
 * module owns the data (states, incident types, schedule statuses, accrual
 * rules, holidays, broadcast targets, equipment statuses); they mirror
 * seed.ts call-for-call so a fresh database converges identically.
 */
async function seedCatalogBaseline(tx: TxClient): Promise<{
  userStatusActivoId: number;
  operativoStatusId: number;
  stateByName: Map<string, number>;
  cdmxId: number;
  roleIdByName: Map<string, number>;
  permissionIdByName: Map<string, number>;
}> {
  const userStatusRecords = [];
  for (const name of SYSTEM_USER_STATUSES) {
    userStatusRecords.push(
      await tx.userStatus.upsert({
        where: { name },
        update: { code: name },
        create: { name, code: name },
      }),
    );
  }
  const userStatusActivo = userStatusRecords.find((u) => u.name === "ACTIVO");
  if (!userStatusActivo) throw new Error("UserStatus ACTIVO not found");

  const equipmentStatuses = ["OPERATIVO", "MANTENIMIENTO", "INACTIVO"];
  for (const name of equipmentStatuses) {
    await tx.equipmentStatus.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const name of SYSTEM_VEHICLE_STATUSES) {
    await tx.vehicleStatus.upsert({
      where: { name },
      update: { code: name },
      create: { name, code: name },
    });
  }

  for (const name of SYSTEM_VEHICLE_TRIP_STATUSES) {
    await tx.vehicleTripStatus.upsert({
      where: { name },
      update: { code: name },
      create: { name, code: name },
    });
  }

  const mexicanStates: Array<{ name: string; code: string }> = [
    { name: "Aguascalientes", code: "AGU" },
    { name: "Baja California", code: "BCN" },
    { name: "Baja California Sur", code: "BCS" },
    { name: "Campeche", code: "CAM" },
    { name: "Coahuila", code: "COA" },
    { name: "Colima", code: "COL" },
    { name: "Chiapas", code: "CHP" },
    { name: "Chihuahua", code: "CHH" },
    { name: "Ciudad de México", code: "CDMX" },
    { name: "Durango", code: "DUR" },
    { name: "Guanajuato", code: "GUA" },
    { name: "Guerrero", code: "GRO" },
    { name: "Hidalgo", code: "HID" },
    { name: "Jalisco", code: "JAL" },
    { name: "México", code: "MEX" },
    { name: "Michoacán", code: "MIC" },
    { name: "Morelos", code: "MOR" },
    { name: "Nayarit", code: "NAY" },
    { name: "Nuevo León", code: "NLE" },
    { name: "Oaxaca", code: "OAX" },
    { name: "Puebla", code: "PUE" },
    { name: "Querétaro", code: "QUE" },
    { name: "Quintana Roo", code: "ROO" },
    { name: "San Luis Potosí", code: "SLP" },
    { name: "Sinaloa", code: "SIN" },
    { name: "Sonora", code: "SON" },
    { name: "Tabasco", code: "TAB" },
    { name: "Tamaulipas", code: "TAM" },
    { name: "Tlaxcala", code: "TLA" },
    { name: "Veracruz", code: "VER" },
    { name: "Yucatán", code: "YUC" },
    { name: "Zacatecas", code: "ZAC" },
  ];
  const stateByName = new Map<string, number>();
  for (const s of mexicanStates) {
    const rec = await tx.state.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: s,
    });
    stateByName.set(s.name, rec.id);
  }

  // Test clients (CVV01-09, IZ59/IT48/TH61) are deliberately NOT created here:
  // real clients load from clientes-v3.csv below. Only the SIN-CENTRO system
  // placeholder (visual fallback for unassigned incidents) is kept.
  const cdmxId = stateByName.get("Ciudad de México");
  if (!cdmxId) throw new Error("Estados base no encontrados");
  await tx.client.upsert({
    where: { code: "SIN-CENTRO" },
    update: { name: "SIN CENTRO" },
    create: {
      code: "SIN-CENTRO",
      name: "SIN CENTRO",
      companyName: "OpusInspection",
      stateId: cdmxId,
    },
  });

  const permissionIdByName = new Map<string, number>();
  for (const perm of PERMISSION_LIST) {
    const rec = await tx.permission.upsert({
      where: { name: perm.name },
      update: {
        description: perm.description,
        resource: perm.resource || null,
        action: perm.action || null,
        routePath: perm.routePath || null,
        exact: perm.exact ?? false,
      },
      create: { ...perm, exact: perm.exact ?? false },
    });
    permissionIdByName.set(rec.name, rec.id);
  }

  const rolesData = [
    {
      name: "ROOT",
      description:
        "Superusuario: administra catálogos, roles, permisos y usuarios",
      defaultPath: "/inicio",
      isSuperuser: true,
      priority: 100,
      permissions: resolveSeedGrants("ROOT"),
    },
    {
      name: "ADMIN_OPERACION",
      description:
        "Administra incidentes, programación, asignaciones y organización",
      defaultPath: "/inicio",
      priority: 80,
      permissions: resolveSeedGrants("ADMIN_OPERACION"),
    },
    {
      name: "ADMIN_VACACIONES",
      description: "Administra las vacaciones de todo el personal",
      defaultPath: "/inicio",
      priority: 70,
      permissions: resolveSeedGrants("ADMIN_VACACIONES"),
    },
    {
      name: "FSR",
      description:
        "Field Service Representative - System user with management capabilities",
      defaultPath: "/inicio",
      priority: 50,
      permissions: resolveSeedGrants("FSR"),
    },
    {
      name: "EMPLEADO",
      description:
        "Personal de oficina: solo su perfil y sus propias vacaciones",
      defaultPath: "/inicio",
      priority: 30,
      permissions: resolveSeedGrants("EMPLEADO"),
    },
    {
      name: "REPORTER",
      description: "Reporter user - Raises incidents from Client",
      defaultPath: "/inicio",
      priority: 10,
      permissions: resolveSeedGrants("REPORTER"),
    },
    {
      name: "GUEST",
      description: "Guest user - Read-only access (no create permissions)",
      defaultPath: "/inicio",
      priority: 20,
      permissions: resolveSeedGrants("GUEST"),
    },
  ];

  const roleIdByName = new Map<string, number>();
  for (const roleData of rolesData) {
    const roleCode = SEED_ROLE_CODES.includes(
      roleData.name as (typeof SEED_ROLE_CODES)[number],
    )
      ? roleData.name
      : null;
    const role = await tx.role.upsert({
      where: { name: roleData.name },
      update: {
        description: roleData.description,
        defaultPath: roleData.defaultPath,
        isSuperuser: roleData.isSuperuser ?? false,
        priority: roleData.priority ?? 0,
        ...(roleCode ? { code: roleCode } : {}),
      },
      create: {
        name: roleData.name,
        code: roleCode,
        description: roleData.description,
        defaultPath: roleData.defaultPath,
        isSuperuser: roleData.isSuperuser ?? false,
        priority: roleData.priority ?? 0,
      },
    });
    roleIdByName.set(role.name, role.id);

    for (const permName of roleData.permissions) {
      const permissionId = permissionIdByName.get(permName);
      if (!permissionId) {
        throw new Error(
          `Unknown permission "${permName}" for role "${roleData.name}". Re-run the seed from the permission catalog.`,
        );
      }
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  const BROADCAST_TARGETS: Array<[string, string]> = [
    ["ADMIN_OPERACION", "FSR"],
    ["ADMIN_OPERACION", "REPORTER"],
    ["ADMIN_OPERACION", "GUEST"],
    ["ADMIN_OPERACION", "ADMIN_OPERACION"],
    ["ADMIN_VACACIONES", "EMPLEADO"],
    ["ADMIN_VACACIONES", "FSR"],
    ["ADMIN_VACACIONES", "ADMIN_OPERACION"],
    ["ADMIN_VACACIONES", "ADMIN_VACACIONES"],
  ];
  for (const [sourceName, targetName] of BROADCAST_TARGETS) {
    const sourceId = roleIdByName.get(sourceName);
    const targetId = roleIdByName.get(targetName);
    if (!sourceId || !targetId) continue;
    await tx.roleBroadcastTarget.upsert({
      where: {
        sourceRoleId_targetRoleId: {
          sourceRoleId: sourceId,
          targetRoleId: targetId,
        },
      },
      update: { active: true },
      create: { sourceRoleId: sourceId, targetRoleId: targetId },
    });
  }

  const operativo = await tx.equipmentStatus.findUnique({
    where: { name: "OPERATIVO" },
    select: { id: true },
  });
  if (!operativo) throw new Error("EquipmentStatus OPERATIVO not found");

  return {
    userStatusActivoId: userStatusActivo.id,
    operativoStatusId: operativo.id,
    stateByName,
    cdmxId,
    roleIdByName,
    permissionIdByName,
  };
}

/** Remaining catalogs (incident/assignment/schedule/vacation rules, channels). */
async function seedDomainCatalogs(tx: TxClient): Promise<void> {
  const incidentTypes: Array<{
    name: string;
    description: string;
    priority: number;
  }> = [
    {
      name: "Desconocido",
      description:
        "Tipo por defecto cuando no se clasifica. NO eliminar — usado como fallback del sistema.",
      priority: 3,
    },
    {
      name: "Falla Eléctrica",
      description: "Cortocircuitos, fallas de tablero, iluminación",
      priority: 8,
    },
    {
      name: "Falla Mecánica",
      description: "Equipos hidráulicos, neumáticos, ejes",
      priority: 7,
    },
    {
      name: "Falla de Software",
      description: "Sistema de inspección, base de datos, integraciones",
      priority: 8,
    },
    {
      name: "Falla de Cámaras",
      description: "Cámaras de inspección OCR, lectores de placa",
      priority: 6,
    },
    {
      name: "Falla de Báscula",
      description: "Sistema de pesaje",
      priority: 8,
    },
    {
      name: "Falla de Diagnóstico",
      description: "Equipos de gases, frenómetro, alineadora",
      priority: 8,
    },
    {
      name: "Falla de Red",
      description: "Conectividad, switches, WiFi",
      priority: 7,
    },
    {
      name: "Mantenimiento Preventivo",
      description: "Mantenimiento programado",
      priority: 4,
    },
    {
      name: "Mantenimiento Correctivo",
      description: "Reparación tras falla",
      priority: 6,
    },
    {
      name: "Calibración",
      description: "Ajuste y calibración de equipos",
      priority: 5,
    },
    {
      name: "Limpieza / Acondicionamiento",
      description: "Higiene, orden, acondicionamiento del Cliente",
      priority: 2,
    },
    {
      name: "Suministro",
      description: "Faltante de consumibles o refacciones",
      priority: 4,
    },
    {
      name: "MANTENIMIENTO",
      description: "Mantenimiento general del centro de inspección",
      priority: 4,
    },
    {
      name: "Mantenimiento Predictivo",
      description: "Monitoreo de condición para anticipar fallas",
      priority: 4,
    },
    {
      name: "Mantenimiento de Equipos de Diagnóstico",
      description: "Analizador de gases, frenómetro, alineadora, suspensión",
      priority: 7,
    },
    {
      name: "Mantenimiento de Báscula",
      description: "Sistema de pesaje y celdas de carga",
      priority: 6,
    },
    {
      name: "Mantenimiento de Cámaras / OCR",
      description: "Cámaras de inspección, lectores de placa OCR",
      priority: 6,
    },
    {
      name: "Mantenimiento de Red / IT",
      description: "Switches, cableado, servidores, conectividad",
      priority: 5,
    },
    {
      name: "Mantenimiento de Infraestructura",
      description: "Instalaciones eléctricas, hidráulicas y de obra civil",
      priority: 5,
    },
  ];
  for (const it of incidentTypes) {
    await tx.incidentType.upsert({
      where: { name: it.name },
      update: { description: it.description, priority: it.priority },
      create: it,
    });
  }

  for (const status of SYSTEM_INCIDENT_STATUSES) {
    await tx.incidentStatus.upsert({
      where: { name: status.code },
      update: { color: status.color, active: true, code: status.code },
      create: { name: status.code, code: status.code, color: status.color },
    });
  }

  for (const status of SYSTEM_ASSIGNMENT_STATUSES) {
    await tx.assignmentStatus.upsert({
      where: { name: status.code },
      update: { color: status.color, active: true, code: status.code },
      create: { name: status.code, code: status.code, color: status.color },
    });
  }

  const legacyPendiente = await tx.assignmentStatus.findUnique({
    where: { name: "PENDIENTE" },
    select: { id: true },
  });
  if (legacyPendiente) {
    const enProgreso = await tx.assignmentStatus.findUnique({
      where: { code: "EN_PROGRESO" },
      select: { id: true },
    });
    if (enProgreso) {
      await tx.assignment.updateMany({
        where: { statusId: legacyPendiente.id },
        data: { statusId: enProgreso.id },
      });
    }
    await tx.assignmentStatus.update({
      where: { id: legacyPendiente.id },
      data: { active: false },
    });
  }

  const scheduleStatuses: Array<{
    name: string;
    description: string;
    color: string;
  }> = [
    {
      name: "BORRADOR",
      description: "Schedule en edición, no confirmado",
      color: "#94A3B8",
    },
    {
      name: "CONFIRMADO",
      description: "Schedule confirmado, listo para ejecutar",
      color: "#3B82F6",
    },
    {
      name: "EN_CURSO",
      description: "Schedule en ejecución",
      color: "#F59E0B",
    },
    {
      name: "COMPLETADO",
      description: "Schedule completado exitosamente",
      color: "#10B981",
    },
    {
      name: "CANCELADO",
      description: "Schedule cancelado",
      color: "#EF4444",
    },
    {
      name: "POSPUESTO",
      description: "Schedule pospuesto para otra fecha",
      color: "#8B5CF6",
    },
  ];
  for (const status of scheduleStatuses) {
    await tx.scheduleStatus.upsert({
      where: { name: status.name },
      update: { color: status.color, description: status.description },
      create: status,
    });
  }

  for (const vs of SYSTEM_VACATION_STATUSES) {
    await tx.vacationStatus.upsert({
      where: { name: vs.code },
      update: {
        color: vs.color,
        description: vs.description,
        code: vs.code,
      },
      create: {
        name: vs.code,
        code: vs.code,
        color: vs.color,
        description: vs.description,
      },
    });
  }

  const accrualRules: Array<{
    minYears: number;
    maxYears: number | null;
    days: number;
  }> = [
    { minYears: 1, maxYears: 1, days: 12 },
    { minYears: 2, maxYears: 2, days: 14 },
    { minYears: 3, maxYears: 3, days: 16 },
    { minYears: 4, maxYears: 4, days: 18 },
    { minYears: 5, maxYears: 5, days: 20 },
    { minYears: 6, maxYears: 10, days: 22 },
    { minYears: 11, maxYears: 15, days: 24 },
    { minYears: 16, maxYears: 20, days: 26 },
    { minYears: 21, maxYears: 25, days: 28 },
    { minYears: 26, maxYears: null, days: 30 },
  ];
  for (const rule of accrualRules) {
    await tx.vacationAccrualRule.upsert({
      where: { minYears: rule.minYears },
      update: { maxYears: rule.maxYears, days: rule.days },
      create: rule,
    });
  }

  await tx.vacationSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, graceWindowMonths: 12 },
  });

  for (const policy of defaultChannelPolicies()) {
    await tx.notificationChannelPolicy.upsert({
      where: { type: policy.type },
      update: {},
      create: policy,
    });
  }

  const holidayCount = await tx.holiday.count();
  if (holidayCount === 0) {
    await tx.holiday.createMany({
      data: [
        { name: "Año Nuevo", month: 1, day: 1, isRecurring: true },
        { name: "Día del Trabajo", month: 5, day: 1, isRecurring: true },
        {
          name: "Día de la Independencia",
          month: 9,
          day: 16,
          isRecurring: true,
        },
        { name: "Navidad", month: 12, day: 25, isRecurring: true },
        {
          name: "Día de la Constitución",
          month: 2,
          nthMonday: 1,
          isRecurring: true,
        },
        {
          name: "Natalicio de Benito Juárez",
          month: 3,
          nthMonday: 3,
          isRecurring: true,
        },
        {
          name: "Día de la Revolución",
          month: 11,
          nthMonday: 3,
          isRecurring: true,
        },
        {
          name: "Transmisión del Poder Ejecutivo",
          month: 10,
          day: 1,
          isRecurring: false,
          year: 2030,
        },
      ],
    });
  }
}

/** One-step-after-wipe guard: real-data tables must be empty. */
async function assertEmptyTarget(): Promise<void> {
  const checks = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.line.count(),
    prisma.equipment.count(),
    prisma.vacationPeriod.count(),
    prisma.historicalVacationConsumption.count(),
  ]);
  if (checks.some((count) => count > 0)) {
    throw new Error(
      "Target is not empty: seed-full runs only on a wiped database (migrate reset --skip-seed style). Aborting before any write.",
    );
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const plan = await buildSeedPlan();
  const upToCycleYear = currentCdmxYear();

  // Planned calendar grants: one estimate per user WITH a verified hire date
  // (hireYear + 1 through the current CDMX year). Creation itself happens in
  // the transaction via ensureCalendarPeriodsForUser.
  let plannedPeriods = 0;
  for (const user of plan.users) {
    const hireDate = resolveSeedHireDate(
      plan.hireIndex,
      plan.hireFallbackIndex,
      user.candidateKey,
    );
    if (!hireDate) continue;
    const hireYear = hireDate.getUTCFullYear();
    if (hireDate.getUTCMonth() === 1 && hireDate.getUTCDate() === 29) continue;
    plannedPeriods += Math.max(0, upToCycleYear - hireYear);
  }

  const summary = {
    mode: dryRun ? "dry-run" : "full",
    upToCycleYear,
    wouldCreate: {
      users: plan.users.length,
      clients: plan.clients.length,
      lines: plan.lines.length,
      equipment: plan.equipment.length,
      calendarPeriodsPlanned: plannedPeriods,
      historicalRows: plan.approvedReviews.length,
    },
    exceptions: {
      usersWithoutVerifiedHireDate: plan.hireSkipped,
      usersWithExactHireDate: plan.hireExact,
      usersWithNameMatchedHireDate: plan.hireNameMatch,
      usersWithoutGrants: plan.grantSkipped,
      reviewsPending: plan.pendingReviews,
      reviewsRejected: plan.rejectedReviews,
    },
    counts: plan.counts,
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await assertEmptyTarget();

  // Passwords are generated and durably stored BEFORE any user row exists.
  const credentials = plan.users.map((user) => ({
    email: user.email,
    password: randomBytes(15).toString("base64url"),
  }));
  await writeCredentialsOnce(credentials);
  const passwordByEmail = new Map(
    credentials.map((entry) => [entry.email, entry.password] as const),
  );

  const created = {
    users: 0,
    clients: 0,
    lines: 0,
    equipment: 0,
    calendarPeriods: 0,
    historicalRows: 0,
  };

  await prisma.$transaction(
    async (tx) => {
      const baseline = await seedCatalogBaseline(tx);
      await seedDomainCatalogs(tx);

      const states = [...baseline.stateByName.entries()].map(([name, id]) => ({
        id,
        name,
      }));
      const clientIdByCode = new Map<string, string>();
      for (const row of plan.clients) {
        const stateId = resolveStateId(row.state, states);
        const rec = await tx.client.upsert({
          where: { code: row.code },
          update: {},
          // name = code by reviewed mapping; no address/rfc invented.
          create: {
            code: row.code,
            name: row.code,
            companyName: row.companyName || null,
            contact: row.contact || null,
            phone: row.phone || null,
            email: row.email || null,
            stateId,
          },
        });
        clientIdByCode.set(row.code, rec.id);
        created.clients += 1;
      }

      const lineIdByKey = new Map<string, number>();
      for (const row of plan.lines) {
        const clientId = clientIdByCode.get(row.clientCode);
        if (!clientId) throw new Error("Planned client missing in run");
        const rec = await tx.line.upsert({
          where: {
            name_clientId: { name: row.name, clientId },
          },
          update: {},
          create: {
            name: row.name,
            description: row.description || null,
            clientId,
          },
        });
        lineIdByKey.set(`${row.clientCode}␟${row.name}`, rec.id);
        created.lines += 1;
      }

      for (const row of plan.equipment) {
        const lineId = lineIdByKey.get(`${row.clientCode}␟${row.lineName}`);
        if (!lineId) throw new Error("Planned line missing in run");
        // Name only; status resolves the OPERATIVO row by name, never id 1.
        await tx.equipment.create({
          data: {
            name: row.name,
            lineId,
            statusId: baseline.operativoStatusId,
          },
        });
        created.equipment += 1;
      }

      const userIdByKey = new Map<string, string>();
      for (const row of plan.users) {
        const password = passwordByEmail.get(row.email);
        if (!password) throw new Error("Planned credential missing in run");
        const hireDate = resolveSeedHireDate(
          plan.hireIndex,
          plan.hireFallbackIndex,
          row.candidateKey,
        );
        const user = await tx.user.upsert({
          where: { email: row.email },
          update: {},
          create: {
            name: row.name,
            email: row.email,
            password: await hashPassword(password),
            userStatusId: baseline.userStatusActivoId,
            hireDate: hireDate ?? null,
            userProfile: {
              create: { jobPosition: row.jobPosition || null },
            },
          },
        });
        for (const grant of row.grants) {
          const roleId = baseline.roleIdByName.get(grant);
          if (!roleId) throw new Error(`Planned role missing in run`);
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: user.id, roleId } },
            update: {},
            create: { userId: user.id, roleId },
          });
        }
        userIdByKey.set(row.candidateKey, user.id);
        created.users += 1;
      }

      // Calendar grants only for users WITH a verified hire date.
      for (const row of plan.users) {
        const userId = userIdByKey.get(row.candidateKey);
        if (!userId) continue;
        if (
          !resolveSeedHireDate(
            plan.hireIndex,
            plan.hireFallbackIndex,
            row.candidateKey,
          )
        )
          continue;
        const periods = await ensureCalendarPeriodsForUser(
          userId,
          { upToCycleYear },
          tx,
        );
        created.calendarPeriods += periods.length;
      }

      // Historical ledger: APPROVED + linked rows only (currently zero).
      for (const review of plan.approvedReviews) {
        const userId = userIdByKey.get(review.userKey);
        if (!userId) throw new Error("Planned review user missing in run");
        const funding = await tx.vacationPeriod.findUnique({
          where: { userId_cycleYear: { userId, cycleYear: review.cycleYear } },
        });
        if (!funding) throw new Error("Planned funding period missing");
        if (review.entitled < review.taken)
          throw new Error("Review arithmetic mismatch");
        if (review.entitled - review.taken !== review.remaining)
          throw new Error("Review arithmetic mismatch");
        await tx.historicalVacationConsumption.create({
          data: {
            userId,
            cycleYear: review.cycleYear,
            fundingPeriodId: funding.id,
            sourceDigest: review.sourceDigest,
            sourceSheet: review.sourceSheet,
            sourceRow: review.sourceRow,
            sourceEntitledDays: review.entitled,
            sourceTakenDays: review.taken,
            sourceRemainingDays: review.remaining,
            allocatedToDatedDays: 0,
            // Approval by the reviewer IS the identity verification: only
            // APPROVED rows reach this branch (isImportableReview gate).
            identityVerified: true,
            reviewStatus: "APPROVED",
          },
        });
        created.historicalRows += 1;
      }
    },
    {
      maxWait: 30000,
      timeout: 180000,
    },
  );

  // Aggregate counts only — never values.
  console.log(
    JSON.stringify(
      {
        mode: "full",
        upToCycleYear,
        created,
        exceptions: summary.exceptions,
        counts: plan.counts,
      },
      null,
      2,
    ),
  );
}

const invoked =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invoked) {
  main()
    .catch((error) => {
      console.error(error instanceof SeedInputError ? error.message : error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
