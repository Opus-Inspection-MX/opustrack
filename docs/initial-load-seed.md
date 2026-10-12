# Private initial load

The full seed combines the maintained permission and status catalogs with
reviewed local candidate files. Run it only against a freshly emptied database;
it is not a general-purpose repair command for live records. Real spreadsheets,
CSVs, `initial_load/seed.ts`, and generated passwords remain local and ignored
by Git.

## Quick path

1. Verify the target and confirm it has **zero users and zero Clients**:
   `npm run db:prod:status`.
2. If migrations are already applied, run
   `PROD_SEED_SCRIPT=initial_load/seed-full.ts npm run db:prod:seed` in an
   interactive terminal and type the database name when prompted. A reset is
   unnecessary after a failed seed if the database is still empty.
3. Check `npm run db:prod:status` again. Keep
   `initial_load/credentials.csv` private (mode `0600`); distribute the initial
   passwords through a private channel, never through Git or chat.

If a wipe is explicitly authorized later, the destructive command is
`PROD_SEED_SCRIPT=initial_load/seed-full.ts npm run db:prod:reset`. It drops the
database, reapplies migrations, then runs the selected seed. Do not use it as
an automatic retry for a failed data load.

## What the seed loads

| Dataset | Expected fresh-database count | Source |
| --- | ---: | --- |
| Users | 24 | Ignored reviewed `users.csv`; unique initial passwords |
| Clients | 107 | 106 reviewed center candidates plus the system `SIN-CENTRO` placeholder |
| Lines | 327 | Ignored numbered, type-specific Line candidates |
| Equipment | 160 | Ignored CDMX one-per-Line candidates |
| Calendar vacation periods | 179 in the local proof | Users with an unambiguous hire date; count changes with the current year |
| Historical vacation consumption | 0 | The 145 workbook rows remain pending review, not approved for import |

Catalog roles and permissions come from `src/lib/authz/permission-catalog.ts`;
the 17 demo users in `initial_load/seed.ts` are not loaded. A unique hire-date
match exists for 16 of the 24 users in the current private evidence. The other
eight keep `hireDate = null` until an authorized employment administrator
records it; no date is inferred from entitlement totals.

## Recovery boundary

The seed writes six groups in order using individually committed, idempotent
operations rather than a long interactive transaction. If any group fails,
**stop and inspect aggregate database counts before choosing recovery**: a
partially populated database will reject the ordinary empty-target run. Do
not delete or regenerate `credentials.csv` to retry; the seed reuses it only
when its email set matches the reviewed plan. A separately reviewed recovery
path is required for a nonempty target.

Local proof: all migrations applied to a disposable localhost database, the
full seed and one `--resume` run both completed with the expected counts, and
the test database was dropped. Unit tests and `npm run check` passed. This
proof does not assert that a production seed has completed.
