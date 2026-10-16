import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_VACATION_ACCRUAL_RULES } from "../src/lib/constants/vacation-accrual";
import { anniversaryVacationWindow } from "../src/lib/utils/vacation-cycle-window";
import { readVacationWorkbook, samePerson } from "./lib/vacation-workbook";

type Client = Prisma.TransactionClient;
export async function vacationImportState(tx: Client) {
  return {
    users: await tx.user.findMany({
      select: {
        id: true,
        name: true,
        hireDate: true,
        vacationCycleBasis: true,
        active: true,
      },
      orderBy: { id: "asc" },
    }),
    periods: await tx.vacationPeriod.findMany({ orderBy: { id: "asc" } }),
    history: await tx.historicalVacationConsumption.findMany({
      orderBy: { id: "asc" },
    }),
    vacations: await tx.vacation.findMany({ orderBy: { id: "asc" } }),
    rules: await tx.vacationAccrualRule.findMany({ orderBy: { id: "asc" } }),
    setting: await tx.vacationSetting.findUnique({ where: { id: 1 } }),
  };
}
export const stateDigest = (state: unknown) =>
  createHash("sha256").update(JSON.stringify(state)).digest("hex");
const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value));

/** All validation precedes mutation; caller owns one serializable transaction. */
export async function importVacationWorkbook(
  tx: Client,
  bytes: Buffer,
  filename: string,
  options: { apply: boolean; expectedState?: string },
) {
  const source = await readVacationWorkbook(bytes);
  const state = await vacationImportState(tx);
  const digest = stateDigest(state);
  if (options.apply && options.expectedState !== digest)
    throw new Error("TARGET_CHANGED_RERUN_DRY_RUN");
  const existing = await tx.vacationWorkbook.findUnique({
    where: { digest: source.digest },
  });
  if (existing) {
    const rows = await tx.vacationWorkbookRow.count({
      where: { workbookDigest: source.digest },
    });
    if (rows !== source.rows.length)
      throw new Error("SOURCE_ARCHIVE_INCOMPLETE");
    return {
      stateDigest: digest,
      alreadyImported: true,
      archived: rows,
      approved: 0,
      pending: 0,
      changed: 0,
    };
  }
  const months = state.setting?.graceWindowMonths ?? 12;
  const linked = source.rows.map((row) => {
    const matches = state.users.filter(
      (user) => user.active && samePerson(user.name, row.sourceName),
    );
    const user = matches.length === 1 ? matches[0] : null;
    const issues = [...row.issues];
    if (!user)
      issues.push(matches.length ? "AMBIGUOUS_IDENTITY" : "UNMATCHED_IDENTITY");
    if (
      row.hireDate &&
      row.cycleYear <= Number(row.hireDate.toISOString().slice(0, 4))
    )
      issues.push("UNEARNED_CYCLE");
    if (
      user?.hireDate &&
      row.hireDate &&
      user.hireDate.getTime() !== row.hireDate.getTime() &&
      // The initial seed stored Excel date-only cells at UTC midnight. Repair
      // that known encoding only when the original civil date agrees exactly.
      !(
        user.hireDate.toISOString().endsWith("T00:00:00.000Z") &&
        user.hireDate.toISOString().slice(0, 10) ===
          row.hireDate.toISOString().slice(0, 10)
      )
    )
      issues.push("EXISTING_HIRE_DATE_CONFLICT");
    const blocking = issues.filter(
      (issue) => issue !== "SOURCE_SENIORITY_MISMATCH",
    );
    return {
      ...row,
      issues,
      userId: user?.id ?? null,
      approved: user !== null && blocking.length === 0,
    };
  });
  const userDates = new Map<string, Date>();
  for (const row of linked) {
    if (
      !row.userId ||
      !row.hireDate ||
      row.issues.includes("EXISTING_HIRE_DATE_CONFLICT")
    )
      continue;
    const previous = userDates.get(row.userId);
    if (previous && previous.getTime() !== row.hireDate.getTime())
      throw new Error("HIRE_DATE_CONFLICT");
    userDates.set(row.userId, row.hireDate);
  }
  const affected = new Set(userDates.keys());
  if (state.history.some((row) => affected.has(row.userId)))
    throw new Error("EXISTING_HISTORY_REQUIRES_RECONCILIATION");
  // Aggregate import has no dated allocation links: any live reservation blocks it.
  if (state.vacations.some((v) => affected.has(v.userId) && v.active))
    throw new Error("DATED_REQUESTS_REQUIRE_RECONCILIATION");
  for (const old of state.rules.filter((rule) => rule.active)) {
    const baseline = DEFAULT_VACATION_ACCRUAL_RULES.find(
      (rule) => rule.minYears === old.minYears,
    );
    if (
      !baseline ||
      baseline.days !== old.days ||
      (old.maxYears !== baseline.maxYears &&
        !(old.minYears === 26 && old.maxYears === null))
    )
      throw new Error("CUSTOM_RULES_REQUIRE_RECONCILIATION");
  }
  const changes = new Map<
    string,
    {
      id?: string;
      userId: string;
      cycleYear: number;
      periodNumber: number;
      cycleBasis: "ANNIVERSARY";
      importBlocked: boolean;
      accrualStart: Date;
      accrualEnd: Date;
      availableFrom: Date;
      graceEnd: Date;
      ruleDays: number;
      overrideDays: number | null;
    }
  >();
  for (const period of state.periods.filter((period) =>
    affected.has(period.userId),
  )) {
    if (period.cycleYear === null)
      throw new Error("LEGACY_PERIOD_REQUIRES_RECONCILIATION");
    const window = anniversaryVacationWindow(
      userDates.get(period.userId) ?? null,
      period.cycleYear,
      months,
    );
    if (!window || window.periodNumber !== period.periodNumber)
      throw new Error("PERIOD_IDENTITY_CONFLICT");
    if (period.overrideDays !== null)
      throw new Error("EXISTING_OVERRIDE_REQUIRES_RECONCILIATION");
    changes.set(`${period.userId}:${period.cycleYear}`, {
      id: period.id,
      userId: period.userId,
      ...window,
      cycleBasis: "ANNIVERSARY",
      importBlocked: period.importBlocked,
      ruleDays: period.ruleDays,
      overrideDays: null,
    });
  }
  for (const row of linked.filter((row) => row.approved)) {
    if (!row.userId || !row.hireDate || row.entitledDays === null)
      throw new Error("INVALID_APPROVED_ROW");
    const window = anniversaryVacationWindow(
      row.hireDate,
      row.cycleYear,
      months,
    );
    if (!window) throw new Error("INVALID_WINDOW");
    const key = `${row.userId}:${row.cycleYear}`;
    const old = changes.get(key);
    const { id } = old ?? {};
    changes.set(key, {
      id,
      userId: row.userId,
      ...window,
      cycleBasis: "ANNIVERSARY",
      importBlocked: false,
      ruleDays: row.entitledDays,
      overrideDays: null,
    });
  }
  for (const row of linked.filter((row) => !row.approved && row.userId)) {
    const change = changes.get(`${row.userId}:${row.cycleYear}`);
    if (change) change.importBlocked = true;
  }
  const approved = linked.filter((row) => row.approved);
  if (
    new Set(approved.map((row) => `${row.userId}:${row.cycleYear}`)).size !==
    approved.length
  )
    throw new Error("DUPLICATE_PERSON_CYCLE");
  const summary = {
    stateDigest: digest,
    alreadyImported: false,
    archived: linked.length,
    approved: approved.length,
    pending: linked.length - approved.length,
    users: affected.size,
    periods: changes.size,
    graceWindowMonths: months,
    changed: options.apply ? changes.size : 0,
  };
  if (!options.apply) return summary;

  await tx.vacationWorkbook.create({
    data: {
      digest: source.digest,
      filename: path.basename(filename),
      source: source.source,
    },
  });
  for (const rule of DEFAULT_VACATION_ACCRUAL_RULES)
    await tx.vacationAccrualRule.upsert({
      where: { minYears: rule.minYears },
      create: rule,
      update: rule,
    });
  for (const [id, hireDate] of userDates) {
    const before = state.users.find((user) => user.id === id);
    await tx.user.update({
      where: { id },
      data: { hireDate, vacationCycleBasis: "ANNIVERSARY" },
    });
    await tx.businessCorrection.create({
      data: {
        entityType: "User",
        entityId: id,
        actorId: `workbook:${source.digest}`,
        reason:
          "Conciliación autorizada del Excel: fecha de ingreso y cortes por aniversario",
        before: asJson(before),
        after: asJson({ hireDate, vacationCycleBasis: "ANNIVERSARY" }),
      },
    });
  }
  const funding = new Map<string, string>();
  for (const [key, change] of changes) {
    const { id, ...data } = change;
    const period = id
      ? await tx.vacationPeriod.update({ where: { id }, data })
      : await tx.vacationPeriod.create({ data });
    funding.set(key, period.id);
    await tx.businessCorrection.create({
      data: {
        entityType: "VacationPeriod",
        entityId: period.id,
        actorId: `workbook:${source.digest}`,
        reason:
          "Conciliación autorizada del Excel: ventana por aniversario y derecho histórico",
        before: asJson(state.periods.find((old) => old.id === id) ?? {}),
        after: asJson(period),
      },
    });
  }
  for (const row of linked) {
    const { approved: isApproved, ...data } = row;
    await tx.vacationWorkbookRow.create({
      data: {
        ...data,
        workbookDigest: source.digest,
        reviewStatus: isApproved ? "APPROVED" : "PENDING",
      },
    });
    if (
      !isApproved ||
      !row.userId ||
      row.entitledDays === null ||
      row.takenDays === null ||
      row.remainingDays === null
    )
      continue;
    await tx.historicalVacationConsumption.create({
      data: {
        userId: row.userId,
        cycleYear: row.cycleYear,
        fundingPeriodId: funding.get(`${row.userId}:${row.cycleYear}`),
        sourceDigest: source.digest,
        sourceSheet: row.sourceSheet,
        sourceRow: row.sourceRow,
        sourceEntitledDays: row.entitledDays,
        sourceTakenDays: row.takenDays,
        sourceRemainingDays: row.remainingDays,
        identityVerified: true,
        reviewStatus: "APPROVED",
      },
    });
  }
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args[0];
  const apply = args.includes("--apply");
  const expectedState = args
    .find((arg) => arg.startsWith("--expected-state="))
    ?.split("=")[1];
  if (
    !file ||
    args.some(
      (arg) =>
        arg !== file &&
        arg !== "--apply" &&
        arg !== "--dry-run" &&
        !arg.startsWith("--expected-state="),
    )
  )
    throw new Error("INVALID_ARGUMENTS");
  const bytes = await readFile(file);
  const prisma = new PrismaClient({ log: [] });
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        if (!apply) await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return importVacationWorkbook(tx, bytes, file, {
          apply,
          expectedState,
        });
      },
      { isolationLevel: "Serializable", timeout: 120000 },
    );
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "VACATION_IMPORT_FAILED",
    );
    process.exitCode = 1;
  });
}
