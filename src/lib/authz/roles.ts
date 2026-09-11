/**
 * Stable system role codes (Fase 3, H-09).
 *
 * `Role.name` is an editable label; `Role.code` is the identity the logic
 * resolves by. Custom roles created from the UI carry `code: null` and are
 * only ever referenced by id.
 */

export const ROLE = {
  ROOT: "ROOT",
  ADMIN_OPERACION: "ADMIN_OPERACION",
  ADMIN_VACACIONES: "ADMIN_VACACIONES",
  FSR: "FSR",
  EMPLEADO: "EMPLEADO",
  REPORTER: "REPORTER",
  GUEST: "GUEST",
} as const;

export type RoleCode = (typeof ROLE)[keyof typeof ROLE];

export const SEED_ROLE_CODES: readonly RoleCode[] = [
  ROLE.ROOT,
  ROLE.ADMIN_OPERACION,
  ROLE.ADMIN_VACACIONES,
  ROLE.FSR,
  ROLE.EMPLEADO,
  ROLE.REPORTER,
  ROLE.GUEST,
];

/** A role row as the logic sees it: identity in `code`, label in `name`. */
export type RoleRef = {
  code?: string | null;
  name?: string | null;
};

/** Stable identity of a role row, falling back to the label. */
export function roleCodeOf(role: RoleRef | null | undefined): string | null {
  if (!role) return null;
  return role.code ?? role.name ?? null;
}
