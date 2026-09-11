/**
 * Registry of the admin catalogs, driving `e2e/catalogs.spec.ts`.
 *
 * All of them share the same list (`CatalogTable`: search box plus "Ver",
 * "Editar" and "Eliminar" icon actions with `aria-label`) and the same route
 * shape (`/path`, `/path/new`, `/path/:id/edit`). Only the form differs, which
 * is why a single declarative entry per catalog is enough and adding a new
 * catalog later means one entry, not one more spec.
 *
 * `kind` covers the three form shapes found in the app:
 *   - `text` / `number` → plain inputs addressed by `#id`
 *   - `label`           → react-hook-form + shadcn FormField (parts, roles)
 *   - `select`          → Radix `<Select>` (lines, equipments, clients)
 */

import type { Role } from "./auth";
import { db } from "./db";

export type CatalogField =
  | { kind: "text"; id: string; value: (suffix: string) => string }
  | { kind: "number"; id: string; value: () => string }
  | { kind: "label"; label: string | RegExp; value: (suffix: string) => string }
  | { kind: "select"; id: string; option?: string }
  /**
   * SearchableSelect (Popover + cmdk), not the same component as `select`:
   * it has its own search box and renders a longer option label.
   */
  | {
      kind: "combobox";
      id: string;
      searchPlaceholder: string;
      search: string;
      option: string;
    };

export interface CatalogSpec {
  /** Stable key, used in test titles. */
  key: string;
  /** List route. `/new` and `/:id/edit` hang off it. */
  path: string;
  /**
   * Role driving this catalog's CRUD. Fase 1 (H-07): operational catalogs
   * run as ADMIN_OPERACION; ROOT-only catalogs (users/roles/permissions and
   * the state catalogs, where the operator holds at most :read) stay on
   * `admin`. Defaults to `admin` when omitted.
   */
  role?: Role;
  /** `aria-label` of the CatalogTable search box. */
  searchPlaceholder: string;
  /** Fields to fill on create. */
  fields: CatalogField[];
  /**
   * Field whose value identifies the row: it is what gets searched for, and
   * what gets changed on edit. Always the name in practice.
   */
  identity:
    | { kind: "text"; id: string }
    | { kind: "label"; label: string | RegExp };
  /** Builds the unique display name for a run. */
  name: (suffix: string) => string;
  /**
   * Prisma model backing the catalog, used to assert the soft delete.
   *
   * Verifying the deletion through the list is racy — the search is debounced,
   * the table keeps its own client state, and the action ends in a redirect —
   * so the UI performs the action and the database confirms it, the same split
   * the incident lifecycle spec uses.
   */
  model: string;
  /**
   * Creates whatever must already exist for the form to be fillable.
   *
   * `equipments` needs a Line, and the e2e seed ships zero lines. Creating it
   * through the UI would make this spec fail whenever the *lines* form changes,
   * for reasons unrelated to equipments — so the prerequisite is set up
   * directly, the same way the incident lifecycle spec prepares its evidence.
   */
  prepare?: () => Promise<void>;
}

/** Name used by every catalog whose identity is a plain "name" field. */
const named = (prefix: string) => (suffix: string) => `${prefix} ${suffix}`;

/**
 * Suffix reduced to letters, for the catalogs that validate their name against
 * `/^[a-zA-ZÀ-ÿ\s]+$/` (states). Digits map to letters so the value stays
 * unique per run.
 */
const letters = (suffix: string) =>
  suffix
    .replace(/[^0-9]/g, "")
    .slice(-8)
    .replace(/[0-9]/g, (d) => "ABCDEFGHIJ"[Number(d)]);

/** Uppercase alphanumeric, max 10 — the shape `State.code` requires. */
const upperCode = (suffix: string) =>
  `E${suffix.replace(/[^0-9]/g, "").slice(-7)}`;

/** The six status catalogs share `GenericStatusForm`: a single `#name`. */
function statusCatalog(key: string, path: string, model: string): CatalogSpec {
  return {
    key,
    path,
    model,
    searchPlaceholder: "Buscar por nombre...",
    fields: [{ kind: "text", id: "name", value: named("E2E Estado") }],
    identity: { kind: "text", id: "name" },
    name: named("E2E Estado"),
  };
}

/** Client the equipments test selects; guaranteed to have a line. */
const PREREQ_CLIENT = "SIN CENTRO";

/** Give `PREREQ_CLIENT` an active line, so the lineId select has an option. */
async function ensureLineForEquipments(): Promise<void> {
  const prisma = db();

  const client = await prisma.client.findFirstOrThrow({
    where: { active: true, name: PREREQ_CLIENT },
    select: { id: true },
  });

  const existing = await prisma.line.findFirst({
    where: { clientId: client.id, active: true },
    select: { id: true },
  });
  if (existing) return;

  await prisma.line.create({
    data: {
      name: "Línea base e2e",
      clientId: client.id,
    },
  });
}

export const CATALOGS: CatalogSpec[] = [
  // ── Estados (GenericStatusForm) ────────────────────────────────────────────
  statusCatalog(
    "assignment-status",
    "/admin/settings/assignment-status",
    "assignmentStatus",
  ),
  statusCatalog(
    "equipment-status",
    "/admin/settings/equipment-status",
    "equipmentStatus",
  ),
  statusCatalog(
    "vehicle-status",
    "/admin/settings/vehicle-status",
    "vehicleStatus",
  ),
  statusCatalog(
    "vehicle-trip-status",
    "/admin/settings/vehicle-trip-status",
    "vehicleTripStatus",
  ),
  statusCatalog("user-status", "/admin/user-status", "userStatus"),

  // ── Catálogos con formulario propio de texto ──────────────────────────────
  {
    key: "states",
    model: "state",
    path: "/admin/states",
    role: "admin-operacion",
    searchPlaceholder: "Buscar por nombre o código...",
    fields: [
      // StateForm rejects digits in the name (letters and spaces only) and
      // requires an uppercase alphanumeric code of at most 10 characters.
      { kind: "text", id: "name", value: (s) => `Estado Prueba ${letters(s)}` },
      { kind: "text", id: "code", value: upperCode },
    ],
    identity: { kind: "text", id: "name" },
    name: (s) => `Estado Prueba ${letters(s)}`,
  },
  {
    key: "incident-types",
    model: "incidentType",
    path: "/admin/incident-types",
    searchPlaceholder: "Buscar por nombre...",
    fields: [
      { kind: "text", id: "name", value: named("E2E Tipo") },
      {
        kind: "text",
        id: "description",
        value: () => "Tipo creado por la suite e2e",
      },
      { kind: "number", id: "priority", value: () => "5" },
    ],
    identity: { kind: "text", id: "name" },
    name: named("E2E Tipo"),
  },
  {
    key: "incident-status",
    model: "incidentStatus",
    path: "/admin/incident-status",
    searchPlaceholder: "Buscar por nombre...",
    // Like StateForm, this one rejects digits in the name.
    fields: [
      { kind: "text", id: "name", value: (s) => `Estado Inc ${letters(s)}` },
    ],
    identity: { kind: "text", id: "name" },
    name: (s) => `Estado Inc ${letters(s)}`,
  },

  // ── react-hook-form ───────────────────────────────────────────────────────
  {
    key: "roles",
    model: "role",
    path: "/admin/roles",
    searchPlaceholder: "Buscar por nombre o descripción...",
    fields: [
      { kind: "label", label: /^Nombre del Rol/, value: named("E2E_ROL") },
      { kind: "label", label: /^Ruta Predeterminada/, value: () => "/guest" },
    ],
    identity: { kind: "label", label: /^Nombre del Rol/ },
    name: named("E2E_ROL"),
  },

  // ── Relacionales (Radix Select) ───────────────────────────────────────────
  {
    key: "clients",
    model: "client",
    path: "/admin/clients",
    role: "admin-operacion",
    searchPlaceholder: "Buscar por código, nombre o razón social...",
    fields: [
      { kind: "text", id: "code", value: (s) => `E2E-${s.slice(-6)}` },
      { kind: "text", id: "name", value: named("E2E Centro") },
      { kind: "select", id: "stateId" },
    ],
    identity: { kind: "text", id: "name" },
    name: named("E2E Centro"),
  },
  {
    key: "lines",
    model: "line",
    path: "/admin/lines",
    role: "admin-operacion",
    searchPlaceholder: "Buscar por nombre o descripción...",
    fields: [
      { kind: "text", id: "name", value: named("E2E Linea") },
      { kind: "select", id: "clientId" },
    ],
    identity: { kind: "text", id: "name" },
    name: named("E2E Linea"),
  },
  {
    key: "equipments",
    model: "equipment",
    path: "/admin/equipments",
    role: "admin-operacion",
    searchPlaceholder: "Buscar por nombre o descripción...",
    fields: [
      { kind: "text", id: "name", value: named("E2E Equipo") },
      {
        kind: "combobox",
        id: "clientId",
        searchPlaceholder: "Buscar Cliente...",
        search: PREREQ_CLIENT,
        // EquipmentForm labels its options `${name} (${code})`.
        option: `${PREREQ_CLIENT} (SIN-CENTRO)`,
      },
      { kind: "select", id: "lineId" },
    ],
    identity: { kind: "text", id: "name" },
    name: named("E2E Equipo"),
    prepare: ensureLineForEquipments,
  },
];
