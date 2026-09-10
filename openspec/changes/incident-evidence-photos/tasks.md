# Tasks: incident-evidence-photos

Change: incident-evidence-photos · Phase: tasks · Store: hybrid
Strategy: stacked-to-main (2 independent PRs, each <400 lines)
Delivery: ask-on-risk → Chained PRs if slice 2 grows (camera UX + two detail views)

---

## SLICE 1 — Backend: Schema + Migration + Actions

**PR target**: main
**Branch**: feat/incident-evidence-photos-backend
**Objective**: `IncidentAttachment` table exists; upload/delete actions enforce the RF-259-mirror contract.
**Satisfies**: RF-217 (storage + rules)

### Tasks (sequential within slice)

- [ ] T1.1 — `prisma/schema.prisma`: add `IncidentAttachment` model + `attachments` relation on `Incident` (exact shape per design §2).
- [ ] T1.2 — Run migration: `npm run db:migrate -- --name add_incident_attachment`. Verify table created, no backfill needed.
- [ ] T1.3 — NEW `src/lib/actions/incident-attachments.ts`: `uploadIncidentAttachment` + `deleteIncidentAttachment` with `guarded()`/`rejected()` contract, permission checks, terminal-state block, `revalidatePath()` on affected routes.
- [ ] T1.4 — Unit tests: upload blocked on `CERRADO`/`CANCELADA`; delete soft-deletes + calls provider delete; oversize/off-allowlist file rejected with operator-facing Spanish message.

**Verification (manual)**:
1. `npm run db:migrate` exits 0; table visible in `npm run db:studio`.
2. Focused test command passes (record command + result at apply time).

**Rollback boundary**: inverse migration drops table; revert action module. No UI depends on it yet.

**Estimated lines**: ~120 lines changed.

---

## SLICE 2 — Frontend: `/client/new` + Read Surfaces + Spec

**PR target**: main (after slice 1 merged)
**Branch**: feat/incident-evidence-photos-ui
**Objective**: CLIENT can attach camera/file evidence at report time; attachments visible + deletable on detail views.
**Satisfies**: RF-217 (capture + visibility)
**Depends on**: Slice 1 (table + actions)

### Tasks (sequential within slice)

- [ ] T2.1 — `src/app/client/new/page.tsx`: stage files via `FileUpload showCamera`; upload after `createIncidentAsClient` resolves; per-file failure toasts.
- [ ] T2.2 — Incident detail queries: include `attachments where active`.
- [ ] T2.3 — Admin + CLIENT detail views: attachment list + delete (permission-gated).
- [ ] T2.4 — `spec/03-incidentes.md`: model table + RF-217.
- [ ] T2.5 — E2E (ephemeral DB): CLIENT creates incident with attachment; attachment renders on detail; delete removes it.

**Verification (manual)**:
1. As CLIENT, file an incident with a camera photo → photo listed on detail.
2. Try upload on a `CERRADO` incident → Spanish rejection toast.
3. `npm run check` clean (biome + tsc + knip).

**Rollback boundary**: revert UI commits; slice 1 remains intact and harmless.

**Estimated lines**: ~200 lines changed.

---

## Dependency Graph

```
main
  └─ feat/incident-evidence-photos-backend  [Slice 1] ─ PR #1 → main
       └─ feat/incident-evidence-photos-ui  [Slice 2] ─ PR #2 → main
```

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Chained PRs recommended | Only if slice 2 exceeds budget (two detail views) |
| 400-line budget risk | Low — ~120 / ~200 |
| Estimated changed lines total | ~320 lines (2 PRs) |
| Largest single PR | Slice 2 (~200 lines) |
| Decision needed before apply | No |

---

## Commit Map (work-unit-commits convention)

**Slice 1**:
- `feat(db): add IncidentAttachment model and migration`
- `feat(incidents): add upload/delete attachment actions with terminal-state guard`

**Slice 2**:
- `feat(client): stage and upload evidence photos from incident report form`
- `feat(incidents): render and delete attachments on detail views`
- `docs(spec): document RF-217 incident evidence photos`
