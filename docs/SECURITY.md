# Security review (Phase 9)

## Permission audit
- Every table in `public` has row-level security (16 of 16) and tenant isolation by `organization_id`.
- Every Server Action and route calls `requireOrg()` (verified user + verified membership) and, where needed, `hasRole(role, "org_admin")`. Queries also filter by the active organization, so a forged id from another tenant finds nothing.
- Admin-only: issuing cards, QR regeneration, status changes, printing, batch card issuing, branding, fields, templates, verification settings. Staff can manage members and batches' member step.
- Database functions: `has_org_role`, `is_org_member`, `is_platform_admin`, `create_organization` and the number generators are callable by signed-in users on purpose (RLS needs them) and each checks the caller. `verify_credential` is service-role only. Supabase advisor flags on these are expected.
- Migration 9: `next_card_number` now requires org admin.

## Public verification
- Opaque 256-bit tokens, only SHA-256 hashes stored; all failures look like "not recognized".
- Rate limit 30 lookups/minute per hashed IP (inside `verify_credential`); raw IPs never stored.
- Public fields come from a hard-coded allowlist; pages send `no-referrer`, `no-store` and `noindex`.

## Other controls
- Print: same-origin check (malformed Origin handled), admin only, max 20 print runs per organization per 10 minutes, max 50 cards per PDF, audit log entry.
- Batches: CSV only, 500 rows, 1 MB, formula-injection safe export helper.
- Headers on every page: CSP (self + Supabase only), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy (camera this site only), COOP. `/app/*` is `no-store`.
- Sign-in, sign-up and password-reset throttling is provided by Supabase Auth's built-in limits.

## Tests (`npm test`, `npm run test:headers`)
- `tests/db`: 87 database checks (isolation, roles, triggers, verification, templates).
- `tests/unit`: redirects, tokens, hashing, CSV safety, all catalog templates parse.
- `tests/e2e/headers.test.mjs`: run against a running server (`BASE=... npm run test:headers`): headers, signed-out redirects, print origin checks, verification fail-closed.

## Needs the owner (dashboard settings, cannot be done from code)
1. Supabase → Authentication → Password security: turn on **Leaked password protection**.
2. Supabase → Authentication → Rate limits: review defaults for sign-up/sign-in.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` and `IP_HASH_SALT` only in Vercel/.env.local.
