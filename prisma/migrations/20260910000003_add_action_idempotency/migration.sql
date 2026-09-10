-- Create the ActionIdempotency dedupe table (RF-260, RF-261).
--
-- One row per flushed idempotency key from an offline draft. A retried draft
-- with a known key converges on the live target instead of re-executing the
-- state-machine transition, so a retried close never double-applies.
-- Additive table; rollback drops it. No backfill: empty on migrate.

CREATE TABLE "action_idempotency" (
  "key"       TEXT NOT NULL PRIMARY KEY,
  "action"    TEXT NOT NULL,
  "targetId"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
