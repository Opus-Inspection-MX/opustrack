/**
 * PII/secret redaction for the observability logger (RF-556).
 *
 * Any log context passes through {@link redact} BEFORE serialization, so
 * secrets and direct personal data never reach stdout — not even in a local
 * `next dev` terminal that someone might paste into a ticket.
 *
 * Matching is case-insensitive SUBSTRING on keys (`userEmail` matches
 * `email`), applied recursively through objects and arrays. Redacted values
 * become the literal `"[REDACTED]"`.
 *
 * Stdlib only: safe in Edge Runtime, Server Components, and client bundles.
 */

export const REDACTED = "[REDACTED]";

/**
 * Minimum denylist (spec 11, RF-556): secrets first, then direct PII and
 * location/file handles the app routinely carries in incident payloads.
 */
const DENYLIST: readonly string[] = [
  // Secrets / credentials.
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "sessiontoken",
  // Direct personal data.
  "email",
  "rfc",
  "companyname",
  "phone",
  "contact",
  "address",
  "reportername",
  // Location.
  "lat",
  "lng",
  "gps",
  // File/blob handles and free text that routinely embeds PII.
  "photourl",
  "filepath",
  "bloburl",
  "description",
  "notes",
];

/** True when a key must be redacted (case-insensitive substring match). */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return DENYLIST.some((denied) => lower.includes(denied));
}

/**
 * Recursively copy `value`, replacing every sensitive leaf with `[REDACTED]`.
 *
 * Never mutates its input. Circular references become `"[Circular]"` instead
 * of recursing forever. Class instances other than plain objects/arrays
 * (e.g. `Error`, `Headers`, `Date`) pass through untouched — the logger
 * normalizes errors separately before calling this.
 */
export function redact<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[Circular]" as T;
    seen.add(value);
    return value.map((item) => redact(item, seen)) as T;
  }

  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    if (seen.has(value)) return "[Circular]" as T;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(entry, seen);
    }
    return out as T;
  }

  return value;
}
