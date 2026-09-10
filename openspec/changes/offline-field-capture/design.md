# Design: Offline-Tolerant Field Capture (RF-260, RF-261)

Change: `offline-field-capture` · Phase: design · Artifact store: hybrid

This design turns the proposal contract into concrete technical decisions. It does NOT reopen any contract point (four actions only, draft-and-retry, action-time GPS, idempotent flush, freshness window, no merge UI, no state-machine changes).

---

## 1. Executive Summary

Add a client-side outbox: one localStorage entry per pending action (`action`, scalar payload, GPS fix, `capturedAt`, `idempotencyKey` cuid, staged file refs). Forms for the four actions catch failure/offline, persist the draft, and show pending state with explicit retry + auto-flush on `online` event. Server actions gain optional `idempotencyKey`/`capturedAt`, enforce a 24h freshness window (proposed default, confirm at apply), dedupe by key, then run the UNCHANGED guards and transitions. Ship in 3 slices.

---

## 2. Outbox Shape (client)

New module, e.g. `src/lib/offline/outbox.ts` (exact path at apply; must survive knip `--include files` — imported by the four forms):

```ts
type PendingAction =
  | { kind: "startAssignmentWork"; assignmentId: string; lat: number; lng: number; address?: string }
  | { kind: "closeAssignment"; assignmentId: string; /* close scalars */ lat: number; lng: number }
  | { kind: "startVehicleTrip"; /* trip scalars */ odometerPhotoRef: string; lat: number; lng: number }
  | { kind: "endVehicleTrip"; tripId: string; /* trip scalars */ odometerPhotoRef: string; lat: number; lng: number };

type OutboxEntry = {
  key: string; // idempotencyKey, cuid
  action: PendingAction;
  capturedAt: string; // ISO, action time — never rewritten at flush
  attempts: number;
  lastError?: string;
};
```

Decisions:
- localStorage over IndexedDB: payloads are small scalars + photo refs; photos stage as object-URL blobs rehydrated to `File` at flush (no base64 persistence — the RF-259 rule extends here). If photo staging proves too large at apply, scope drops photo *persistence* first (draft keeps scalars + GPS; photo re-attached online) — documented fallback, not silent.
- Cap: max 20 entries / warn past ~4MB (`try/catch` on `setItem` quota). Eviction is user-confirmed, never silent.
- Flush triggers: explicit "Reintentar" button on pending badges + `window.addEventListener("online")` auto-flush. Backoff: 3 attempts (immediate, 30s, 5min), then manual-only. Attempt count stored on the entry.

---

## 3. Server Contract (additive, identical for all four actions)

Each of the four Server Actions accepts two optional fields (top-level `FormData` entries, so existing online callers are untouched):

- `idempotencyKey: string` — server keeps a small dedupe record (new tiny table `ActionIdempotency { key @id, action, result, createdAt }` OR a column on the target entity — decided at apply; table preferred to avoid touching four models). Repeat key → return the stored result without re-executing.
- `capturedAt: string` — ISO timestamp of the field action. Server rejects `now - capturedAt > 24h` with `rejected("El registro es de hace más de 24 horas…")` (freshness window; 24h proposed default).

After those two checks, the action runs its EXISTING guards and transitions byte-for-byte (permissions, terminal-state blocks, GPS presence, odometer monotonicity, state machine). Offline therefore cannot do anything online cannot — it only delivers late. Conflict outcome = the action's normal `rejected()` message, displayed in the existing toast path.

---

## 4. GPS Semantics (exact)

- Coordinates + `capturedAt` are frozen at draft creation (the field moment). Flush re-sends them as data; the device MUST NOT re-capture location at flush time.
- Server validates presence/shape exactly as today; it additionally validates freshness (§3). It does NOT validate "was the FSR really there" beyond what online actions already do — no new trust model, just preserved evidence.

---

## 5. UI Behavior (four forms)

| Form | Pending UX |
|---|---|
| Start-work / close (`fsr/assignments/[id]`) | Button shows "Pendiente de envío" badge; tapping opens entry detail (captured-at, attempts, last error) + Reintentar / Descartar (descartar confirms) |
| `trip-start-form.tsx` / `trip-end-form.tsx` | Same pattern incl. staged-photo thumbnail |

On successful flush: entry removed, normal success toast + `revalidatePath()` already owned by the action. On business-rule failure: entry kept, error shown, user edits fresh state and retries or discards — this IS the conflict UX (manual, no merge screen).

---

## 6. §3.5(a) Flush Matrix

Flushes call the real actions, so whichever semantics ship are automatically honored:

| Outcome | Flush behavior for a stale-authorized draft |
|---|---|
| Gate | Flush fails with the standard denial message; entry kept for the user to resolve |
| Log | Flush auto-creates the assignee row as today; success toast notes it |

Tests pin the active outcome; the other is ignored-with-reason (same pattern as `incident-audit-trail` slice 2).

---

## 7. Spec Updates

- `spec/04-asignaciones.md`: RF-260 (draft shape, idempotency, 24h window, no-merge rule, GPS-frozen rule).
- `spec/06-vehiculos-viajes.md`: RF-261 (same, plus staged-photo fallback rule).

---

## 8. Slicing Plan

### Slice 1 — Outbox + one action (closeAssignment)
Outbox module + unit tests (persistence, backoff, eviction-cap), server `idempotencyKey`/`capturedAt` on `closeAssignment` + dedupe store + migration (if table), idempotency test (double-flush applies once).

### Slice 2 — Remaining three actions + forms UX
`startAssignmentWork`, `startVehicleTrip`, `endVehicleTrip` server params; pending badges + retry/discard on all four forms; staged-photo handling + fallback.

### Slice 3 — Freshness/conflict E2E + specs
Airplane-mode E2E over ephemeral DB (all four actions), stale-draft rejection, moved-on conflict surfacing, spec/04 + spec/06 updates.

---

## 9. ADR-style Decisions

1. **localStorage outbox, no service worker.** Rejected: full PWA background sync — 10× the surface for a problem solved by user-triggered flush.
2. **Idempotency keys over "exactly-once" transport.** Rejected: assuming flush runs once — retries are the feature; dedupe is the correctness.
3. **24h freshness window, server-enforced.** Rejected: unbounded drafts (stale GPS evidence rots) and client-only checks (spoofable). Value confirmable at apply.
4. **No merge UI, ever (in this change).** Rejected: conflict resolution screens — they would duplicate state-machine judgment in the client. Conflicts stay server errors.
5. **GPS frozen at capture.** Rejected: re-capture at flush — would falsify the field evidence the feature exists to preserve.

---

## 10. Risks + Mitigations

| Risk | Mitigation |
|---|---|
| Photo blobs exceed localStorage quota | Byte cap + quota `try/catch`; documented fallback drops photo persistence before scalars/GPS |
| Double-execution across tabs | Dedupe key is the single truth; concurrent flushes converge on the stored result |
| Users hoard stale drafts | 24h server window bounds staleness; pending badges nag; discard is one tap with confirm |
| knip flags the outbox module | Imported directly by the four forms — no orphan files (transversal `npm run check` rule) |

---

## 11. Next Recommended

`sdd-tasks` — task breakdown follows the 3-slice plan in section 8. Run the §3.5(a) gate-vs-log decision before slice 2 apply.
