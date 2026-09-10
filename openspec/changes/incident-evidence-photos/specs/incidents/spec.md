# Delta for Incidentes (Domain 03)

> Change: `incident-evidence-photos` | RF range: RF-200–RF-249 | Spec file: spec/03-incidentes.md
> Free number verified: RF-213–RF-216 taken by `incident-type-priority`; RF-217 is the next free number in range.

---

## ADDED Requirements

### Requirement: RF-217 · Fotos de evidencia en el incidente

The system MUST support file attachments directly on the `Incident` via a new `IncidentAttachment` model that mirrors `AssignmentAttachment` (RF-259). The reporter (CLIENT) MUST be able to attach evidence photos at creation time from `/client/new`, including mobile camera capture.

**Rules:**

- `IncidentAttachment` MUST store `incidentId`, `filename`, `filepath`, `mimetype`, `size`, optional `description`, per-row `provider` (`vercel-blob` | `filesystem`), `uploadedAt`, and soft-delete `active`.
- Upload contract identical to RF-259: **10MB** per file; the shared MIME allowlist in `src/lib/storage/file-storage.ts`; `FormData` with `File` (no base64).
- Creation flow is two-step: the incident is created first (`createIncidentAsClient`), then staged files upload against the returned id. Per-file upload failures MUST be reported without invalidating the created incident.
- Upload and delete MUST be blocked when the parent incident is `CERRADO` or `CANCELADA` (terminal-state rule, same as RF-259).
- Delete is soft-delete in DB + physical delete in the row's stored provider; physical-delete failure is logged and does NOT fail the operation.
- Unlike RF-259, attachments are NEVER required: reporting MUST NOT be blocked for lack of photos.
- All incident-detail queries MUST filter `where: { active: true }`.

#### Scenario: CLIENT attaches a camera photo while reporting

- GIVEN the CLIENT is filing an incident from `/client/new`
- WHEN they capture a photo with the camera input and submit
- THEN the incident is created AND the photo is stored as an `IncidentAttachment` with its provider recorded
- AND the photo renders on the incident detail view

#### Scenario: Oversize file is rejected with an operator-facing message

- GIVEN a staged file larger than 10MB (or with a MIME type outside the allowlist)
- WHEN the upload is attempted
- THEN the operation is rejected with a Spanish message naming the limit
- AND the parent incident remains created and valid

#### Scenario: Upload blocked on closed incident

- GIVEN an incident in `CERRADO` (or `CANCELADA`)
- WHEN an upload or delete is attempted against it
- THEN the operation is rejected and no row or blob changes
