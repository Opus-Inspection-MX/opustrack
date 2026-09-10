/**
 * Standard application logger (RF-555).
 *
 * Zero dependencies, Edge-safe (`console` + `JSON` + `process.env` only), so
 * it can be imported from API routes, Server Actions, middleware,
 * `instrumentation.ts`, and client components alike.
 *
 * - Level gating via `LOG_LEVEL` (`debug` < `info` < `warn` < `error`);
 *   default is `debug` in dev, `info` in production. Unknown values fall
 *   back to the default instead of failing open or closed.
 * - Production emits one JSON line per event to stdout; development prints a
 *   human-readable line through the matching `console` method.
 * - Every context is normalized (errors keep `name`/`message`/`stack`,
 *   circular refs become `"[Circular]"`) and PII-redacted (RF-556) BEFORE
 *   serialization — callers never redact by hand.
 *
 * What belongs here: handler faults (500), `onRequestError`, denial context
 * at `debug`. What NEVER belongs here: returned business rules
 * (`rejected()` / `BusinessRuleError` are operator decisions, not defects).
 */

import { redact } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

function configuredLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (LEVELS.includes(raw as LogLevel)) return raw as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Convert anything into a JSON-safe structure.
 *
 * `JSON.stringify(new Error("boom"))` is `"{}"` — the message and stack that
 * make a fault diagnosable would silently vanish. Errors (nested at any
 * depth) become `{ name, message, stack }`; circular references become
 * `"[Circular]"`; everything else passes through for `redact` to handle.
 */
function normalize(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return value.map((item) => normalize(item, seen));
  }
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = normalize(entry, seen);
    }
    return out;
  }
  return value;
}

function emit(level: LogLevel, message: string, context?: unknown): void {
  if (ORDER[level] < ORDER[configuredLevel()]) return;

  const timestamp = new Date().toISOString();
  if (isProduction()) {
    // Single stream (stdout): one JSON line per event for the collector.
    const payload: Record<string, unknown> = { timestamp, level, message };
    if (context !== undefined) payload.context = redact(normalize(context));
    console.log(JSON.stringify(payload));
    return;
  }

  const line = `[${timestamp}] ${level.toUpperCase()} ${message}`;
  if (context === undefined) {
    console[level](line);
    return;
  }
  console[level](line, redact(normalize(context)));
}

export const logger = {
  debug: (message: string, context?: unknown): void =>
    emit("debug", message, context),
  info: (message: string, context?: unknown): void =>
    emit("info", message, context),
  warn: (message: string, context?: unknown): void =>
    emit("warn", message, context),
  error: (message: string, context?: unknown): void =>
    emit("error", message, context),
};
