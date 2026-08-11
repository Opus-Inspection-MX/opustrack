# E2E tests (Playwright)

End-to-end coverage for the domain specs in `spec/`. Current coverage:

- **`auth-rbac.spec.ts`** — `spec/01-auth-rbac.md`: login, session redirect by
  `defaultPath`, ADMIN bypass, per-role route denial, public routes.
- **`incident-lifecycle.spec.ts`** — the business flow from
  `spec/00-overview.md`: a CLIENT reports an incident, an ADMIN schedules and
  assigns it, an FSR marks it seen, starts on site and closes it, and the
  incident closes **automatically**. Notifications are asserted at each hop.

## How it runs

The suite is **fully isolated** from your development and production
environments. `npm run test:e2e` does three things:

0. **Builds the app** (`next build`) and serves it with `next start`. The dev
   server logs every request Playwright aborts on teardown as
   `uncaughtException: [Error: aborted] ECONNRESET` — around 45 lines per run,
   enough to bury a genuine server error. The production server emits none of
   it, runs the suite in about half the time, and is what actually ships. Use
   `npm run test:e2e:dev` to swap back to the dev server while debugging.
1. **Starts a throwaway PostgreSQL** (`docker-compose.e2e.yml`) — its own
   container, port **5433**, and a tmpfs data directory, so every `up` begins
   empty and `npm run e2e:db:down` leaves nothing behind.
2. **Migrates and seeds it** with the tracked template seed
   (`initial_load/seed.example.ts`), which is self-contained mock data covering
   all four roles.
3. **Serves it on port 3100** and runs Playwright against it.

Environment comes from `config/e2e.env`, loaded by `playwright.config.ts`
itself with dotenv's `override`, so a bare `npx playwright test` is configured
exactly like the npm script.

On top of that, `assertEphemeralDatabase()` (`fixtures/ephemeral-db.ts`) runs
before anything else and **refuses to start** unless `DATABASE_URL` is
`localhost:<E2E_DB_PORT>/opustrack_e2e`. It is checked in three places: the
Playwright config, the `db` setup project, and `scripts/assert-ephemeral-db.ts`
(which guards `prisma migrate deploy` and the seed). The database is not
configurable on purpose — `.env.development` here points at a hosted Neon
instance, and a suite that *can* reach a real database eventually will.

> Port 3100 and 5433 are deliberate. The app's 3000 and Postgres' 5432 are
> usually taken, and `reuseExistingServer` would silently attach to whatever is
> there.

## Credentials

Nothing is hardcoded. Emails and the shared password are read from the
environment:

| Variable | Purpose |
|----------|---------|
| `E2E_PASSWORD` | Shared password for every e2e account |
| `E2E_ADMIN_EMAIL` / `E2E_FSR_EMAIL` / `E2E_CLIENT_EMAIL` / `E2E_GUEST_EMAIL` | One account per role |

`config/e2e.env` is **tracked** and holds only disposable values pointing at the
container — never put a real credential there.

To customise, copy `config/e2e.local.env.example` to
**`config/e2e.local.env`** (gitignored). It is loaded after `config/e2e.env`
and overrides it.

To run with your **real data and accounts**, point `E2E_SEED_SCRIPT` at
`initial_load/seed.ts` there. The real seed then populates the *ephemeral
container*: real data, still thrown away on `e2e:db:down`.

`db.setup.ts` creates any configured account that is missing. If the account
already exists it is left alone — its password is never rewritten — so pointing
the suite at real accounts cannot modify anyone's credentials.

## Commands

```bash
npm run test:e2e            # docker + seed + build + all browsers (~1.5 min)
npm run test:e2e:dev        # dev server instead: no build, dev overlay, noisy
npm run test:e2e:ui         # dev server, interactive UI mode
npm run test:e2e:only       # skip docker/seed/build, reuse what is there
npm run e2e:db:up           # start the container only
npm run e2e:db:prepare      # migrate + seed it
npm run e2e:db:down         # stop and delete it (volumes included)

npx playwright test --project=chromium   # one browser (after a build)
```

`Access denied for role X to /y` lines in the output are **expected**: they are
the middleware's own security warning, emitted once per RF-106 denial test.
They are evidence those tests exercised the deny path.

First run only, install browsers: `npx playwright install`.

## Structure

- `fixtures/auth.ts` — resolves accounts from the environment; storage-state paths.
- `fixtures/ephemeral-db.ts` — the database guard (unit-tested by vitest).
- `fixtures/db.ts` — Prisma helpers for assertions: polls for derived status,
  notifications, and the assignment created by the UI.
- `fixtures/forms.ts` — `fillStable` / `fillStableAll` / `pickFromCombobox`.
- `fixtures/login.ts` — `submitLogin()`: fills the login form retrying until the
  values stick. The inputs are React-controlled, so filling them before
  hydration lets the first client render wipe them — WebKit hydrates slowly
  enough to hit this every run.
- `db.setup.ts` — `db` project: ensures the configured accounts exist. Runs first.
- `auth.setup.ts` — `setup` project (depends on `db`): logs each role in through
  the UI once and saves its session as storage state.
- `auth-rbac.spec.ts` — spec 01 scenarios, grouped by RF requirement.

## Notes

- **Hydration.** Every form binds `value` + `onChange`. Filling an input before
  hydration finishes lets the first client render wipe it, and the submit then
  fails validation with nothing visible on screen. Always use `fillStable`
  (or `fillStableAll` when several fields must survive together). This has bitten
  the login form on WebKit and the schedule form on Chromium.
- **Combobox triggers.** `SearchableSelect` / `MultiSelect` show the *selected*
  label, not the placeholder — `AssignmentForm` pre-selects the newest incident.
  Address them with `comboboxByLabel`, and match options with `exact: true`
  (the seed has "FSR User", "FSR User 2", "FSR User 3").
- **`waitForURL` needs anchoring.** `"**/admin/assignments**"` also matches the
  `/new` page you are already on, so it resolves before the submit navigates.
- **`confirm()`.** The FSR start/close actions use `window.confirm`; Playwright
  dismisses dialogs by default, which cancels the transition. Register
  `page.on("dialog", d => d.accept())` first.
- **Read-after-write.** `waitForURL` resolves when the client navigation starts,
  not when the server transaction is visible to another connection. Use the
  polling helpers in `fixtures/db.ts` rather than a single read.
- Route access is database-driven. Adding or revoking a `route:*` permission
  changes what these tests expect — see `src/lib/authz/route-access.ts`.
- Assert on real routes only. A non-existent path still returns its own URL on a
  404 page, so an access assertion against it passes trivially.
