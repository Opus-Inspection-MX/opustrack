import { promises as fs } from "node:fs";
import { join, normalize, sep } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";

/**
 * Dynamic filesystem upload serving (RF-265).
 *
 * Production `next start` does not serve files added to `public/` after
 * startup, so freshly uploaded evidence 404s until restart and the `next/image`
 * optimizer reports "not a valid image". This route reads from disk on every
 * request, so uploads are served immediately with no restart. Stored
 * `/uploads/...` URLs, providers and the Vercel Blob path are unchanged, and
 * no data migration is needed.
 *
 * App routes take precedence over `public/` files, so this handler answers
 * every `/uploads/...` request, including files that predate the server start.
 * It stays public, matching the `/uploads` public prefix and Blob behavior.
 */

const UPLOADS_ROOT = join(process.cwd(), "public", "uploads");

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
  // Video
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  avi: "video/x-msvideo",
  // Documents
  pdf: "application/pdf",
  // Office / text (downloadable evidence, never executed)
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
};

function contentTypeFor(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}

function notFound(): NextResponse {
  return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path ?? [];

  // Fail closed on traversal: empty/dot segments, backslashes and anything
  // that could escape the uploads root, including encoded separators (Next
  // decodes %2F/%5C into the segment before this handler runs).
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\"),
    )
  ) {
    return notFound();
  }

  const fullPath = normalize(join(UPLOADS_ROOT, ...segments));
  if (!fullPath.startsWith(UPLOADS_ROOT + sep)) {
    return notFound();
  }

  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return notFound();
    const bytes = await fs.readFile(fullPath);
    const body = new Uint8Array(bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(segments[segments.length - 1]),
        "Content-Length": String(body.length),
        // Stored filenames are unique per upload (timestamp prefix), so a
        // successful response is immutable for its URL.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return notFound();
    }
    logger.error("Error serving upload:", error);
    return NextResponse.json(
      { error: "No se pudo leer el archivo" },
      { status: 500 },
    );
  }
}
