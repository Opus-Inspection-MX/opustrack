# Proposal: Evidence Photos on Incident (RF-217)

## Intent

Today only assignments carry evidence: `AssignmentAttachment` exists (RF-259, 10MB, MIME allowlist, per-row provider), but there is **no `IncidentAttachment` model** — verified in `prisma/schema.prisma`. The "before" state of a failure is therefore never captured: a CLIENT reporting from `/client/new` (`src/app/client/new/page.tsx`, `ReportIncidentPage` → `createIncidentAsClient`) can describe the problem in text only, and the first photo appears only after an FSR starts work. This change lets the reporter attach evidence photos **at creation time**, reusing the existing storage and capture components.

## Scope

### In Scope
- `IncidentAttachment` model mirroring `AssignmentAttachment` (cuid id, `incidentId`, filename, filepath, mimetype, size, description?, per-row `provider`, uploadedAt, soft-delete `active`).
- Same upload contract as RF-259: **10MB** per file, same MIME allowlist (`src/lib/storage/file-storage.ts`), `FormData` with `File` (no base64), soft-delete in DB + physical delete in provider.
- Upload wired into `/client/new` creation flow using the existing `FileUpload` component (`src/components/ui/file-upload.tsx`, already supports mobile camera capture via `showCamera`).
- Read surface: attachments visible on incident detail views (admin + CLIENT).
- Spec/03 update (model table + RF-217).

### Out of Scope (Non-Goals)
- NO required-photo-to-close rule for incidents (that rule belongs to assignments, RF-259).
- NO changes to `AssignmentAttachment` or its UI.
- NO gallery redesign, image annotation, or compression pipeline.
- NO retroactive migration of assignment attachments to incidents.

## Capabilities

### New Capabilities
- None (new model, existing patterns).

### Modified Capabilities
- `incidents`: RF-217 — incident creation and detail gain attachments.

## Approach

Clone the proven RF-259 pattern rather than inventing a new one: same Prisma shape, same `uploadFileFromBuffer`/`deleteFromProvider` storage helpers, same `FileUpload` component with `showCamera`. Creation is **two-step** (create incident via `createIncidentAsClient`, then upload files against the returned id) because Server Actions receive files as `FormData` and the incident id must exist first. Upload/delete is blocked when the parent incident is `CERRADO`/`CANCELADA`, mirroring the RF-259 terminal-state rule.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | New `IncidentAttachment` model + `attachments` relation on `Incident` |
| migration (`npm run db:migrate`) | New | Create table (additive, no backfill) |
| `src/lib/actions/incidents.ts` (or new `incident-attachments.ts`) | Modified/New | `uploadIncidentAttachment` / `deleteIncidentAttachment` Server Actions |
| `src/app/client/new/page.tsx` | Modified | `FileUpload` (camera) staged files, uploaded after incident creation |
| Incident detail views (admin, client) | Modified | Attachment list + delete |
| `spec/03-incidentes.md` | Modified | Model table + RF-217 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Phone photos exceed 10MB | Medium | Client-side `validateFile` rejects before upload with a clear message; same UX as assignments |
| Orphan files if upload fails mid-flow | Low | Two-step flow: incident always exists first; failed uploads return `rejected()` and leave no DB row (no DB row ⇒ janitor-safe storage) |
| Camera capture varies by mobile browser | Low | Component already ships `showCamera` + file fallback; no new capture code |

## Rollback Plan

Additive table + actions. Revert commits and drop the table via inverse migration. Incident data untouched; only attachment rows/files are lost.

## Dependencies

- None on Phase 2 beyond the existing `FileUpload`/storage stack (already shipped).
- **§3.5 decisions:** independent of both (a) IncidentAssignee gate-vs-log and (b) ScheduleStatus. Stated here so the decision log is complete: no dependency.

## Success Criteria

- [ ] `IncidentAttachment` table exists; rows carry per-row `provider`.
- [ ] CLIENT can attach ≥1 photo (camera or file) when reporting from `/client/new`; files >10MB or off-allowlist are rejected with an operator-facing message.
- [ ] Attachments render on admin and CLIENT incident detail; delete is soft-delete + physical removal.
- [ ] Upload/delete blocked on `CERRADO`/`CANCELADA` incidents.
- [ ] spec/03 documents RF-217.
