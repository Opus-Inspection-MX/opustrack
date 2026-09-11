import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every id-taking action proves its scope (Fase 0c: H-03, H-04).
 *
 * A Server Action is a public POST endpoint for any session, so an action
 * that receives an id (or a FormData carrying one) must show, in its own
 * body, how it keeps one Client's rows away from another Client's users —
 * or sit in the allowlist below WITH its reason. Permission alone is not
 * scope: the seed hands `assignments:update` or `users:read` to scoped roles.
 *
 * What counts as proof (substring in the action's own region):
 *
 * - an `access.ts` loader: `loadIncidentFor(`, `loadAssignmentFor(`,
 *   `loadLineFor(`, `loadEquipmentFor(`, `requireClientAccess(`,
 *   `assertBelongsToClient(`, `clientInScope(`;
 * - scope resolution or fragments: `getReportScope(`,
 *   `*ScopeWhere(`, `withScope(`;
 * - the previous-generation client checks in `auth/filters.ts` (same
 *   fail-closed rule since 0c delegates them here):
 *   `assertClientAccessAsync(`, `canAccessClientAsync(`,
 *   `assertAllClienteAccess(`, `getClientWhereClauseAsync(`,
 *   `getUserClientIds(`, `getPrimaryClientId(`, `scopeIncludesClient(`;
 * - ownership checks for rows that have NO Client dimension (trips belong
 *   to the FSR who drove them, vacations to the person who requested them):
 *   `managesAllVacations(`, `userId: caller.id`, `userId !== caller.id`,
 *   `fsrId !== user.id`, `fsrId: user.id`, `userId: user.id`.
 *
 * Regions run from one `async function` declaration to the next, so a shared
 * helper's markers never launder the action above it. The paren in every
 * loader marker matters: `loadAssignmentForTransition(` (the state-machine
 * reader with no scope check) must NOT satisfy `loadAssignmentFor(`.
 */

const ACTIONS_DIR = join(process.cwd(), "src/lib/actions");

const SCOPE_EVIDENCE = [
  // access.ts loaders (Fase 0c).
  "loadIncidentFor(",
  "loadAssignmentFor(",
  "loadLineFor(",
  "loadEquipmentFor(",
  "requireClientAccess(",
  "assertBelongsToClient(",
  "clientInScope(",
  // Scope resolution and fragments (report-scope.ts).
  "getReportScope(",
  "ScopeWhere(",
  "withScope(",
  // Previous-generation client checks (same fail-closed rule since 0c).
  "assertClientAccessAsync(",
  "canAccessClientAsync(",
  "assertAllClienteAccess(",
  "getClientWhereClauseAsync(",
  "getUserClientIds(",
  "getPrimaryClientId(",
  "scopeIncludesClient(",
  // Ownership checks for rows with no Client dimension.
  "managesAllVacations(",
  "userId: caller.id",
  "userId !== caller.id",
  "fsrId !== user.id",
  "fsrId: user.id",
  "userId: user.id",
];

/**
 * Actions that take an id and legitimately show no scope evidence.
 *
 * Key: "file.ts :: action". Value: WHY — global catalogs (no Client
 * dimension in the schema), own-data/ownership handled elsewhere, tenant or
 * role administration, or an id guard explicitly deferred (with where it
 * lands). An entry that stops matching a real unguarded action fails the
 * "no dead entries" test below and must go.
 */
const ALLOWLIST: Record<string, string> = {
  // Global catalogs: no clientId anywhere in their schema.
  "holidays.ts :: getHolidayById":
    "global catalog: holidays are system-wide dates",
  "holidays.ts :: updateHoliday":
    "global catalog: holidays are system-wide dates",
  "holidays.ts :: deleteHoliday":
    "global catalog: holidays are system-wide dates",
  "lookups.ts :: getStateById": "global catalog: shared lookup tables",
  "lookups.ts :: updateState": "global catalog: shared lookup tables",
  "lookups.ts :: deleteState": "global catalog: shared lookup tables",
  "lookups.ts :: getUserStatusById": "global catalog: shared lookup tables",
  "lookups.ts :: updateUserStatus": "global catalog: shared lookup tables",
  "lookups.ts :: deleteUserStatus": "global catalog: shared lookup tables",
  "lookups.ts :: getIncidentTypeById": "global catalog: shared lookup tables",
  "lookups.ts :: updateIncidentType": "global catalog: shared lookup tables",
  "lookups.ts :: deleteIncidentType": "global catalog: shared lookup tables",
  "lookups.ts :: getIncidentStatusById": "global catalog: shared lookup tables",
  "lookups.ts :: updateIncidentStatus": "global catalog: shared lookup tables",
  "lookups.ts :: deleteIncidentStatus": "global catalog: shared lookup tables",
  "lookups.ts :: getAssignmentStatusById":
    "global catalog: shared lookup tables",
  "lookups.ts :: updateAssignmentStatus":
    "global catalog: shared lookup tables",
  "lookups.ts :: deleteAssignmentStatus":
    "global catalog: shared lookup tables",
  "lookups.ts :: getEquipmentStatusById":
    "global catalog: shared lookup tables",
  "lookups.ts :: updateEquipmentStatus": "global catalog: shared lookup tables",
  "lookups.ts :: deleteEquipmentStatus": "global catalog: shared lookup tables",
  "lookups.ts :: getVehicleStatusById": "global catalog: shared lookup tables",
  "lookups.ts :: updateVehicleStatus": "global catalog: shared lookup tables",
  "lookups.ts :: deleteVehicleStatus": "global catalog: shared lookup tables",
  "lookups.ts :: getVehicleTripStatusById":
    "global catalog: shared lookup tables",
  "lookups.ts :: updateVehicleTripStatus":
    "global catalog: shared lookup tables",
  "lookups.ts :: deleteVehicleTripStatus":
    "global catalog: shared lookup tables",
  "lookups.ts :: deletePermission":
    "permission catalog admin: global, ROOT-administered",
  "vacation-accrual-rules.ts :: getAccrualRuleById":
    "global config: accrual rules apply to everyone",
  "vacation-accrual-rules.ts :: updateAccrualRule":
    "global config: accrual rules apply to everyone",
  "vacation-accrual-rules.ts :: deleteAccrualRule":
    "global config: accrual rules apply to everyone",
  "vehicles.ts :: getVehicleById":
    "global catalog: the fleet has no Client dimension",
  "vehicles.ts :: updateVehicle":
    "global catalog: the fleet has no Client dimension",
  "vehicles.ts :: deleteVehicle":
    "global catalog: the fleet has no Client dimension",
  "vehicles.ts :: updateVehicleStatus":
    "global catalog: the fleet has no Client dimension",
  "broadcasts.ts :: updateBroadcast":
    "global: broadcasts target roles, no Client dimension",
  "broadcasts.ts :: cancelBroadcast":
    "global: broadcasts target roles, no Client dimension",
  "broadcasts.ts :: getRoleBroadcastTargets":
    "role broadcast config: targets are roles, no Client dimension",
  "broadcasts.ts :: setRoleBroadcastTargets":
    "role broadcast config: targets are roles, no Client dimension",
  "notification-settings.ts :: retryFailedEmail":
    "global ops: email outbox retry, no Client dimension",
  "vacations.ts :: updatePeriodOverride":
    "global payroll config: accrual periods, no Client dimension",
  // Own data: ownership enforced with the caller's id.
  "notifications.ts :: markNotificationAsRead":
    "own data: ownership enforced with user.id in the notification service",
  "notifications.ts :: deleteMyNotification":
    "own data: ownership enforced with user.id in the notification service",
  // Vacation administration: vacations are per-user rows, no Client dimension.
  "vacations.ts :: approveVacation":
    "vacation admin flow (vacations:approve); vacations have no Client dimension",
  "vacations.ts :: rejectVacation":
    "vacation admin flow (vacations:approve); vacations have no Client dimension",
  "vacations.ts :: getVacationApprovalConflicts":
    "vacation approval helper (vacations:approve); conflict check over assignee userIds",
  // User and role administration (users:read scoping is decision #1, pending).
  "users.ts :: getUserById":
    "user admin: personnel roster scoping is decision #1 (pending); users:read untouched in 0c",
  "users.ts :: updateUser":
    "user admin: personnel roster scoping is decision #1 (pending); client logic lives in a shared helper, not a per-id gate",
  "users.ts :: updateUserEmployment":
    "user admin: personnel roster scoping is decision #1 (pending); narrow hire-date capture with no Client dimension",
  "users.ts :: deleteUser":
    "user admin: personnel roster scoping is decision #1 (pending); users:delete held by ROOT",
  "roles.ts :: getRoleById": "role admin: roles are global, ROOT-administered",
  "roles.ts :: updateRole": "role admin: roles are global, ROOT-administered",
  "roles.ts :: deleteRole": "role admin: roles are global, ROOT-administered",
  "roles.ts :: assignPermissionsToRole":
    "role admin: roles are global, ROOT-administered",
  // Tenant administration: the Client itself is not inside a scope.
  "clients.ts :: updateClient":
    "tenant admin: clients:update held only by scope-unrestricted roles",
  "clients.ts :: deleteClient":
    "tenant admin: clients:delete held only by scope-unrestricted roles",
  // Id guards explicitly deferred: permission held only by scope-unrestricted
  // roles (or nobody) today, so no live hole — but roles are UI-editable
  // (H-09), so each lands in the Fase 2 real-SQL IDOR matrix, not here.
  "assignments.ts :: deleteAssignment":
    "deferred: assignments:delete held only by scope-unrestricted roles; id guard lands with the Fase 2 IDOR matrix",
  "assignments.ts :: reopenAssignment":
    "deferred: assignments:reopen held by no seeded role (H-06/0d); id guard lands with the Fase 2 IDOR matrix",
  "incidents.ts :: cancelIncident":
    "deferred: incidents:cancel held by no seeded role (H-06/0d); id guard lands with the Fase 2 IDOR matrix",
  "schedules.ts :: getScheduleById":
    "deferred: schedule row guard pending (writes already check the client list); full guard with the Fase 2 IDOR matrix",
  "schedules.ts :: deleteSchedule":
    "deferred: schedule row guard pending; full guard with the Fase 2 IDOR matrix",
  "tracking.ts :: assignFSRToIncident":
    "deferred: tracking:update held only by scope-unrestricted roles; id guard lands with the Fase 2 IDOR matrix",
  "tracking.ts :: updateAssignmentAssignees":
    "deferred: tracking:update held only by scope-unrestricted roles; id guard lands with the Fase 2 IDOR matrix",
  "tracking.ts :: updateIncidentDetails":
    "deferred: tracking:update held only by scope-unrestricted roles; id guard lands with the Fase 2 IDOR matrix",
  "tracking.ts :: overrideIncidentStatus":
    "deferred: tracking:update held only by scope-unrestricted roles; id guard lands with the Fase 2 IDOR matrix",
  "tracking.ts :: updateAssignmentDetails":
    "deferred: tracking:update held only by scope-unrestricted roles; id guard lands with the Fase 2 IDOR matrix",
};

type Candidate = { file: string; action: string; region: string };

/** Split top-level comma-separated params, ignoring nested ()[]{}<>. */
function topLevelParams(signature: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of signature) {
    if ("([{<".includes(ch)) depth++;
    if (")]}>".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() !== "") parts.push(current);
  return parts;
}

/** Parameters between the parens, without the body that follows them. */
function paramList(region: string): string {
  const open = region.indexOf("(");
  let depth = 0;
  for (let i = open; i < region.length; i++) {
    const ch = region[i];
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth === 0) return region.slice(open + 1, i);
    }
  }
  return "";
}

/** Exported actions whose parameter list carries an id (or an opaque FormData). */
function idTakingActions(): Candidate[] {
  const found: Candidate[] = [];
  for (const file of readdirSync(ACTIONS_DIR).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  )) {
    const source = readFileSync(join(ACTIONS_DIR, file), "utf8");
    // Every function declaration (exported or not) starts a region, so a
    // shared helper's scope calls never launder the action above it. Only
    // exported regions are evaluated.
    const decls = [
      ...source.matchAll(/(export\s+)?async\s+function\s+(\w+)\s*\(/g),
    ];
    for (let i = 0; i < decls.length; i++) {
      const [, exported, name] = decls[i];
      if (!exported) continue;
      const region = source.slice(
        decls[i].index,
        i + 1 < decls.length ? decls[i + 1].index : undefined,
      );
      const signature = topLevelParams(paramList(region));
      // Parameter NAMES only: inline object types mention ids (`clientId?:`)
      // that the action never receives as its own argument.
      const takesId = signature.some((param) => {
        const [lhs, ...rest] = param.split(":");
        const pname = lhs.replace(/=.*$/, "").trim();
        if (pname === "id" || /Ids?$/.test(pname)) return true;
        // FormData carries ids opaquely (assignmentId, tripId, ...).
        const ptype = rest.join(":").trim();
        return /(^|[\s<(,|])FormData([\s>),|]|$)/.test(ptype);
      });
      if (takesId) found.push({ file, action: name, region });
    }
  }
  return found;
}

describe("contrato de alcance por id (Fase 0c)", () => {
  it("toda acción con id prueba su alcance o está en el allowlist con razón", () => {
    const offenders: string[] = [];

    for (const { file, action, region } of idTakingActions()) {
      const key = `${file} :: ${action}`;
      if (SCOPE_EVIDENCE.some((marker) => region.includes(marker))) continue;
      if (ALLOWLIST[key]) continue;
      offenders.push(key);
    }

    expect(
      offenders,
      "Estas acciones reciben un id sin probar su alcance. Agrega un gate " +
        "de access.ts (o de ownership si la fila no tiene Cliente) o súmala " +
        "al allowlist CON su razón.",
    ).toEqual([]);
  });

  it("el allowlist no tiene entradas muertas", () => {
    // An allowlist nobody prunes becomes a way to opt out of the rule. Every
    // entry must still name a real, still-unguarded action.
    const live = new Map(
      idTakingActions().map((c) => [`${c.file} :: ${c.action}`, c.region]),
    );
    const dead = Object.keys(ALLOWLIST).filter((key) => {
      const region = live.get(key);
      return (
        region === undefined ||
        SCOPE_EVIDENCE.some((marker) => region.includes(marker))
      );
    });

    expect(dead, "Entradas obsoletas en el allowlist de alcance").toEqual([]);
  });
});
