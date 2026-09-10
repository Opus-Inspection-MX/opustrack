# Design: Evidence Photos on Incident (RF-217)

Change: `incident-evidence-photos` · Phase: design · Artifact store: hybrid

This design turns the proposal contract into concrete technical decisions against the real codebase. It does NOT reopen any contract point (mirror of `AssignmentAttachment`, 10MB + allowlist, per-row provider, `/client/new` + camera component, blocked on terminal states).

---

## 1. Executive Summary

Add `IncidentAttachment` as a structural clone of `AssignmentAttachment`. Reuse `uploadFileFromBuffer` / provider-delete helpers in `src/lib/storage/file-storage.ts` unchanged. Add two Server Actions (`uploadIncidentAttachment`, `deleteIncidentAttachment`) following the `result.ts` contract (`rejected()` for rules, `guarded()` at the boundary). Wire the existing `FileUpload` (`showCamera`) into `ReportIncidentPage` as staged files uploaded after `createIncidentAsClient` resolves. Render a read list on incident detail views. Ship in 2 slices.

---

## 2. Schema Change (exact)

```prisma
model IncidentAttachment {
  id           String   @id @default(cuid())
  incidentId   Int
  incident     Incident @relation(fields: [incidentId], references: [id])
  filename     String
  filepath     String
  mimetype     String
  size         Int
  description  String?
  provider     String   @default("vercel-blob") // "vercel-blob" or "filesystem"
  uploadedAt   DateTime @default(now())
  active       Boolean  @default(true)

  @@index([incidentId])
}
```

Plus `attachments IncidentAttachment[]` on `Incident`.

Decisions:
- Field-for-field clone of `AssignmentAttachment` (verified shape in `prisma/schema.prisma`, ~line 415), including the per-row `provider` default. Deliberate duplication over abstraction: the two lifecycles (incident vs assignment) evolve independently, and RF-259 behavior must not shift.
- No backfill: new table, empty on migrate. Migration via `npm run db:migrate`.
- Range/size enforcement stays at the action boundary (Zod + `validateFile`), matching RF-259 — no DB CHECK.

---

## 3. Storage Reuse (no new code)

- Upload path calls the existing `uploadFileFromBuffer(filename, buffer, mimetype, options)` — 10MB default and `ALLOWED_MIMETYPES` enforced inside (`file-storage.ts` lines ~117–160). No new constants.
- Delete path calls the existing provider-delete helper keyed off the row's stored `provider` (correct even if `FILE_STORAGE_PROVIDER` changed since upload — same guarantee as RF-259).
- `FormData` with `File`, never base64 (RF-259 rule, avoids Server Action payload inflation).

---

## 4. Server Actions

New module `src/lib/actions/incident-attachments.ts` (preferred over bloating `incidents.ts`):

- `uploadIncidentAttachment(formData: FormData)` — fields: `incidentId`, `file: File`, `description?`. Guards (all `rejected()` in Spanish, via `guarded()`): `incidents:create` or `incidents:update` permission as appropriate; incident exists + `active`; incident status not `CERRADO`/`CANCELADA`; file passes storage validation. On success: storage upload → create row → `revalidatePath()` on `/client/...` + `/admin/incidents/...`. Returns `{ success: true, value: attachmentDto }`.
- `deleteIncidentAttachment(id)` — soft-delete row + physical provider delete (physical failure logged, does not fail the op — RF-259 rule). Same terminal-state block.
- Read: extend existing incident-detail queries with `attachments: { where: { active: true } }` (select only, no new endpoint).

---

## 5. `/client/new` Wiring

`ReportIncidentPage` is a client component; the `FileUpload` atom already supports `showCamera`, `maxSizeMB = 10` default, and `accept = "image/*,video/*,.pdf,.heic,.heif"`:

1. Mount `<FileUpload showCamera maxFiles={5} onFilesSelected={stage} />` below the description field. Files are **staged in component state**, not uploaded yet (no incident id exists).
2. On submit: `await createIncidentAsClient(...)` → on success, `for each staged file: uploadIncidentAttachment(formData)`; aggregate failures into the existing toast path (`use-toast`, never `alert()`).
3. Partial-failure semantics: incident creation succeeding while some uploads fail is acceptable and reported per-file; the incident detail view allows adding missing photos later (slice 2 read surface doubles as the repair path).

Decision: two-step over single-FormData-submit because `createIncidentAsClient` takes scalar fields today; threading files through it would change its contract and validation. The staged approach keeps both actions independently testable.

---

## 6. Read Surface

- Admin incident detail + CLIENT incident detail: attachment list (filename, size via existing `formatFileSize`, thumbnail/link, delete button behind permission). Reuse the assignment-attachment list markup pattern; no new design language.
- Queries filter `active: true` (soft-delete rule, transversal).

---

## 7. Spec Updates

- `spec/03-incidentes.md`: add `IncidentAttachment` row to the model map + RF-217 (creation-time evidence, 10MB/allowlist/provider-per-row, terminal-state block, soft delete).

---

## 8. Slicing Plan

### Slice 1 — Backend: schema + migration + actions
Schema, migration, `incident-attachments.ts`, unit tests for guards (terminal-state block, permission). No UI.

### Slice 2 — Frontend: `/client/new` + read surfaces + spec
`FileUpload` staging/upload, detail lists + delete, spec/03 update.

Each slice < 400 lines, independently revertible (slice 2 reverts without touching the table).

---

## 9. ADR-style Decisions

1. **Clone, don't abstract** `AssignmentAttachment`. Rejected: shared `Attachment` supertable/polymorphic relation — would couple two lifecycles and force RF-259 migration.
2. **Two-step create→upload.** Rejected: single submit threading files through `createIncidentAsClient` — breaks its scalar contract.
3. **No required-photo rule.** Rejected: mirroring RF-259's close-gate — reporters must never be blocked from filing.
4. **Per-row provider retained.** Rejected: config-global delete — would mis-delete after provider switches (transversal rule 7, spec/00).

---

## 10. Risks + Mitigations

| Risk | Mitigation |
|---|---|
| Large phone photos rejected | Pre-upload `validateFile` message names the 10MB limit; user can still file the incident and add photos later |
| Orphan blobs on mid-flow failure | DB row is created only after storage upload succeeds; storage-without-row is inert and never referenced |
| Scope creep into gallery/annotation | Explicit non-goal in proposal; reviewers check slice 2 diff against it |

---

## 11. Next Recommended

`sdd-tasks` — task breakdown follows the 2-slice plan in section 8.
