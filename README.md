# EduCard Pro

Professional ID Card Creation & Verification Platform — multi-organization, mobile-first, secure by design.

Status: **Phases 1–8 complete**: foundation, accounts/organizations/members, photo capture, 56 card templates (10 categories, gradient and plain no-background styles), ID card issuing with real QR credentials, CSV batches, public verification, and the print engine (true-size PDF, A4 sheets, crop marks). See `docs/ARCHITECTURE.md` for the full plan.

## What exists now

- Sign-up / sign-in / password reset, organization onboarding, mobile-first dashboard
- Member management (search, add, edit, archive) with per-organization custom fields
- Photo capture (camera or gallery), 3:4 crop with zoom, private storage with short-lived signed URLs

- Database schema, RLS policies, storage buckets and the public verification RPC (`supabase/migrations/`)
- Next.js (App Router) app with Supabase clients, session proxy and the public `/verify/[credential]` page
- 55-check database security suite that attacks cross-organization access (`npm run test:db`)

## Setup

1. `cp .env.example .env.local` and fill in the keys from Supabase → Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` is a secret: server-side only, never `NEXT_PUBLIC_`.
   - `IP_HASH_SALT`: `openssl rand -base64 32`
2. Migrations 0001–0004 are already applied to project `swfrpywkjqnmrqozdtbo`. For a fresh project, apply them with:
   ```bash
   npx supabase login
   npx supabase link --project-ref swfrpywkjqnmrqozdtbo
   npx supabase db push
   ```
3. Create your platform admin (once, in the Supabase SQL editor, after signing up):
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
4. `npm install && npm run dev`

## Connecting Vercel and GitHub

1. Create a GitHub repo and push this project.
2. In Vercel: **Add New → Project → import the repo**.
3. In Vercel → Project → Settings → Environment Variables, add the four variables from `.env.example`
   (or use the Supabase integration in the Vercel Marketplace, then add `IP_HASH_SALT` and `NEXT_PUBLIC_SITE_URL`).
4. In Supabase → Authentication → URL Configuration, set the Site URL and redirect URLs to your Vercel domain.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run test:db` | Apply migrations to an in-memory Postgres and run the RLS/verification attack tests |

## Security notes

- The QR contains only `https://<host>/verify/<opaque 256-bit token>`. Only its SHA-256 hash is stored.
- Public verification returns the minimum: organization, card number, issue month, status. Extra fields are opt-in per organization from a fixed allowlist.
- A valid QR confirms a card is on record and in good standing. It cannot prove a physical card hasn't been copied.
