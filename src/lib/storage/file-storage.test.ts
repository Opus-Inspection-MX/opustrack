import { describe, expect, it } from "vitest";
import { guarded } from "@/lib/actions/result";
import { assertAllowedUpload } from "./file-storage";

/**
 * H-10: upload rules are operator-facing, so they must come back as values.
 * guarded() only converts BusinessRuleError — a plain throw here would reach
 * the FSR as a generic production error.
 */
function guardedUpload(mimetype: string, size: number) {
  return guarded(async () => {
    assertAllowedUpload(mimetype, size);
    return {};
  });
}

describe("assertAllowedUpload dentro de guarded", () => {
  it("devuelve el mensaje en español en vez de lanzar (oversize)", async () => {
    const result = await guardedUpload("image/jpeg", 11 * 1024 * 1024);

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/demasiado grande/),
    });
  });

  it("devuelve el mensaje en español en vez de lanzar (tipo no permitido)", async () => {
    const result = await guardedUpload("application/x-msdownload", 1024);

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/no permitido/),
    });
  });

  it("rechaza image/svg+xml: la evidencia de campo nunca es SVG (H-22)", async () => {
    const result = await guardedUpload("image/svg+xml", 1024);

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/no permitido/),
    });
  });

  it("rechaza el archivo vacío", async () => {
    const result = await guardedUpload("image/jpeg", 0);

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/vacío/),
    });
  });

  it("acepta un JPEG dentro del límite", async () => {
    await expect(guardedUpload("image/jpeg", 1024)).resolves.toEqual({
      success: true,
    });
  });
});
