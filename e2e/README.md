# E2E tests (Playwright)

End-to-end coverage for the domain specs in `spec/`. Current coverage:
`spec/01-auth-rbac.md` (login, session redirect by `defaultPath`, ADMIN bypass,
per-role route denial, public routes).

## Requirements

These tests drive the real app, so they need:

1. **A running app** — started automatically via `webServer` in
   `playwright.config.ts` (`npm run dev`), or reused if already running.
2. **A seeded database with the standard test users.** The fixtures in
   `fixtures/auth.ts` expect the canonical seed accounts
   (`{admin,fsr,client,guest}@opusinspection.com` / `password123`) created by the
   tracked seed `prisma/seed.ts` / `initial_load/seed.example.ts`.

   > ⚠️ A dev database loaded with real/import data (different emails and
   > passwords) will fail the login-dependent tests. Run e2e against a database
   > seeded with the test accounts (a dedicated test DB in CI, or `npm run
   > db:reset && npm run db:seed` on a disposable local DB).

## Running

```bash
npm run test:e2e            # all browsers
npm run test:e2e:ui         # interactive UI mode
npx playwright test --project=chromium   # single browser
```

First run only, install browsers: `npx playwright install`.

## Structure

- `fixtures/auth.ts` — seeded roles, credentials, storage-state paths.
- `auth.setup.ts` — `setup` project: logs each role in through the UI once and
  saves its session as storage state (consumed via `test.use({ storageState })`).
- `auth-rbac.spec.ts` — spec 01 scenarios, grouped by RF requirement.
