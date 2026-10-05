# EduCard Pro: handover and operations guide

## What is where
| Part | Location |
|---|---|
| Code | GitHub `tech4life-123/EduCard-Pro`, branch `main` (every push deploys) |
| Website | Vercel project `educard-pro`, https://educard-pro.vercel.app |
| Database, login, photo storage | Supabase project `swfrpywkjqnmrqozdtbo` |
| Migrations | `supabase/migrations/` (apply in order; already applied through #9) |

## Environment variables (Vercel > Settings > Environment Variables, and `.env.local`)
| Name | Public? | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | `https://swfrpywkjqnmrqozdtbo.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase publishable key |
| `NEXT_PUBLIC_SITE_URL` | yes | Your final web address, no trailing slash. **Printed QR codes contain this address**, so set it before printing real cards and never change it afterwards without redirecting the old one |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** | server only; never share it or put `NEXT_PUBLIC_` in front |
| `IP_HASH_SALT` | **SECRET** | random 32+ characters (`openssl rand -base64 32`) |

## First-time setup checklist
1. Supabase > Authentication > URL Configuration: Site URL = your web address; add `<address>/auth/callback` to Redirect URLs.
2. Supabase > Authentication > Password security: enable leaked password protection.
3. Sign up in the app and confirm the email.
4. Make yourself platform admin (SQL editor):
   `insert into public.platform_admins (user_id) select id from auth.users where email = 'wmopolu@gmail.com';`
5. Create your organization in the onboarding screen, set branding, add fields (or press **Add all template fields**), pick a template.
6. Add a custom domain in Vercel when ready, then update `NEXT_PUBLIC_SITE_URL` and the Supabase URLs.

## Daily use (short)
- **Members:** add one by one with photo capture, or import a CSV under Batches (max 500 rows).
- **Issue:** an admin issues a card from the member page; the QR is shown once.
- **Print:** Cards or Batches > Print. Printing makes fresh QR codes, so older printed copies of that card stop verifying.
- **Verify:** anyone can scan the QR or open /verify and paste the code. Admins see the scan log under Scans.
- **Lost card:** open the card and mark it Lost or Revoked. Issue a replacement, which retires the old one.

## Monitoring and backups
- Uptime: point a monitor at `/api/health` (returns `{"status":"ok"}`, 503 if the database is down).
- Errors: Vercel > project > Logs (runtime errors). Supabase > Logs for database and auth.
- Backups: Supabase > Database > Backups (daily on paid plans; on the free plan export manually before big imports). Photos are in the private buckets `member-photos-original`, `member-photos-processed` and `org-assets`.

## Changing things safely
- New database change = new numbered file in `supabase/migrations/`, test with `npm run test:db`, then apply.
- Before every release run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Rotating a secret: create the new key in Supabase/own generator, update Vercel, redeploy, then remove the old key. Changing `IP_HASH_SALT` only resets rate-limit counters.

## Known limits
- PDF cards use the standard Helvetica font, so some non-Latin letters print as plain letters or "?".
- The attached community design is a recreation, not a pixel copy.
- Printing is capped at 50 cards per PDF and 20 print runs per organization per 10 minutes.
- The sign-in rate limits come from Supabase Auth defaults.
- Offline capture is not supported.
