# File serving specification

## Purpose

Add RF-265, after RF-264 in `spec/04`. ARF-261 already belongs to trip retries
in `spec/06`; RF-265 is the next free assignment-range ID. Preserve every
existing attachment, storage and transversal requirement/scenario unchanged.

Production `next start` does not serve files added to `public/` after startup,
so freshly uploaded evidence 404s until restart and `next/image` optimization
reports "not a valid image". WF-03 requires decoded uploaded photos, which this
capability makes possible on the filesystem provider without changing stored
URLs, providers or the Vercel Blob path.

## Requirements

### Requirement: RF-265 · Dynamic serving of filesystem uploads

The application MUST serve `GET /uploads/<subfolder>/<file>` by reading the
file from disk on every request, so files uploaded after startup are served
immediately. Stored `/uploads/...` URLs MUST NOT change, and the Vercel Blob
provider path MUST be unaffected. The route MUST reject path traversal
(`..`, empty segments, absolute paths, backslashes, encoded separators) with
404 and MUST only serve regular files inside the configured uploads root.
Missing files MUST answer 404. Served responses MUST carry the content type
matching the file extension (images, PDF, video, office, text) and long-lived
immutable cache headers, because stored filenames are unique per upload.

Uploads MUST continue to be written to the same location; no data migration is
required. The route MUST stay public, matching the existing `/uploads` public
prefix and the production Blob behavior.

#### Scenario: Freshly uploaded evidence renders without restart
- GIVEN a production server started before an upload
- WHEN an operator uploads an image and opens its stored `/uploads/...` URL
- THEN the bytes served equal the uploaded bytes with an image content type,
  with no restart in between.

#### Scenario: Traversal and missing files fail closed
- GIVEN traversal (`..`), absolute, backslash or encoded-separator paths, or
  a missing file
- WHEN requested through the route
- THEN the response is 404 and no file outside the uploads root is read.

#### Scenario: Optimizer receives a valid image
- GIVEN a freshly uploaded PNG through the filesystem provider
- WHEN `next/image` optimizes its stored URL
- THEN the optimizer returns a decodable image instead of "not a valid image".
