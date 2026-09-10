import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";
import { REDACTED } from "./redact";

function spyConsole() {
  return {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    info: vi.spyOn(console, "info").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
}

describe("logger · RF-555 levels and output", () => {
  let spies: ReturnType<typeof spyConsole>;

  beforeEach(() => {
    spies = spyConsole();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("gates by LOG_LEVEL: info is silent when level is error", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "error");

    logger.info("invisible");
    logger.error("visible", { code: 1 });

    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it("defaults to debug outside production and info inside", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "");
    logger.debug("dev-debug");
    expect(spies.debug).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    logger.debug("prod-debug-hidden");
    logger.info("prod-info-shown");
    // Production is JSON lines on stdout only.
    expect(spies.log).toHaveBeenCalledOnce();
    expect(spies.info).not.toHaveBeenCalled();
  });

  it("emits parseable JSON with redacted context in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "");

    logger.error("api.handler_fault", {
      sessionToken: "tok-1",
      email: "a@b.com",
      route: "/api/incidents",
    });

    expect(spies.log).toHaveBeenCalledOnce();
    const line = spies.log.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as {
      level: string;
      message: string;
      context: Record<string, unknown>;
    };
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("api.handler_fault");
    expect(parsed.context).toMatchObject({
      sessionToken: REDACTED,
      email: REDACTED,
      route: "/api/incidents",
    });
    expect(line).not.toContain("tok-1");
  });

  it("keeps the error message and stack instead of stringifying to {}", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "");

    logger.error("action.defect", { error: new Error("boom") });

    const context = spies.error.mock.calls[0]?.[1] as {
      error: { name: string; message: string; stack: string };
    };
    expect(context.error.name).toBe("Error");
    expect(context.error.message).toBe("boom");
    expect(context.error.stack).toContain("boom");
  });

  it("falls back to the default level on an unknown LOG_LEVEL", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "verbose");

    logger.debug("still-shown-in-dev");
    expect(spies.debug).toHaveBeenCalledOnce();
  });
});
