# Email password recovery

Users can select **¿Olvidaste tu contraseña?** on `/login`, enter their account
email at `/forgot-password`, and open the emailed link to `/reset-password`.
Successful recovery returns them to sign-in; it does not automatically log in.

## Deployment

1. Apply the additive `20261013140000_password_recovery` migration before deploying
   the app. It creates one recovery record per user without changing existing accounts.
2. Configure `NEXTAUTH_URL` to the trusted public HTTPS origin and configure
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, and credentials if required.
   Plain HTTP origins are accepted only for localhost development.
3. Verify delivery with a test account. Without SMTP, recovery sends nothing;
   it logs `password-recovery.smtp-unconfigured` without exposing an account or link.

## Security and delivery behavior

- Requests return the same acknowledgement for eligible, unknown, disabled and
  throttled accounts. Database lookup and SMTP execute after the response using
  Next.js `after`; delivery failures do not reveal account existence.
- Emails must match the stored address exactly, as in credentials sign-in.
  Recovery does not create accounts or reactivate users or roles.
- Links contain 256 random bits, expire after 30 minutes, and can be used once.
  Only a SHA-256 digest is stored. The bearer token travels in a URL fragment,
  not a server query string, and the form removes it from browser history.
  Opening another link in the same tab replaces the form's token and clears
  stale success, error and password fields.
  Reloading the page after that requires requesting another link.
- One persisted record per account enforces a one-minute resend cooldown;
  a new link replaces the previous one. Consumed records retain the cooldown.
- Reset requires matching passwords, at least eight characters, and at most
  72 UTF-8 bytes (bcrypt's input limit). Consumption, password replacement and
  session-version increment commit together under serializable isolation.
- Existing authenticated and administrator password changes already increment
  the session version, which invalidates pending recovery links. Current server
  session checks reject old JWTs; recovery does not change middleware behavior.
- Recovery bypasses configurable operational notification policies. Email is
  sent directly, not through `EmailOutbox`, so bearer links are not persisted in
  message bodies. There is no durable delivery retry; request another link after
  one minute if SMTP fails or the process stops before background work completes.
- Per-account cooldown is not a global/IP abuse limit. Deployments should also
  apply their ingress rate limits to unauthenticated actions.

## Checks

`npx vitest run --project unit src/lib/actions/password-recovery.test.ts
src/components/login/password-recovery-form.test.tsx src/lib/authz/route-access.test.ts`
checks validation, response privacy, digest storage, delivery failures and the UI.

`npm run test:int -- password-recovery` uses the guarded ephemeral database to
check concurrent single-use consumption, password replacement, revocation,
expiry, cooldown, replaced links and disabled-account handling.

`npm run test:e2e -- password-recovery.spec.ts --project=chromium --no-deps`
proves actual SMTP delivery through Mailpit, old/new credentials, session
revocation and same-tab replay rejection against the disposable production stack.
This spec disables screenshots, traces and video to avoid retaining bearer links.
