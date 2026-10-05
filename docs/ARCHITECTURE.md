# EduCard Pro — Architecture, Security & Database Plan

Status: Phase 1 (Foundation). Greenfield: no prior code, repo, or database existed.

## 1. Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Storage, RLS) · Vercel · GitHub.
Camera via `getUserMedia` (secure context only). PDF via server-side generation (Phase 8). QR via a server-side library.

## 2. Tenancy model

- Tenant = `organizations` row. Every tenant-owned table carries `organization_id`.
- Users are global (`auth.users` + `profiles`). Access comes from `organization_users` (user, org, role).
- Platform super admins are rows in `platform_admins`, kept separate from org roles so org-level mistakes can never grant platform power.
- RLS is the source of truth. Policies call `SECURITY DEFINER` helpers (`is_org_member`, `has_org_role`, `is_platform_admin`) with a pinned `search_path` to avoid recursive-policy and search-path attacks.
- The frontend never filters for security; the service-role key is used only in server code for narrowly scoped operations (public verification, batch jobs).

## 3. Roles

| Role | Scope | Capabilities |
|---|---|---|
| platform_admin | platform | manage orgs, templates, suspend orgs, system stats |
| org_owner | organization | everything in the org incl. managing admins |
| org_admin | organization | members, cards, batches, templates, revoke |
| org_staff | organization | create/edit members, draft cards; no revoke, no admin mgmt |
| public verifier | none | scan QR, see minimal result only |

Role rank: owner > admin > staff. `has_org_role(org, min_role)` compares rank.

## 4. Member vs ID card

`members` = the person/record. `id_cards` = an issued credential. A replacement creates a new `id_cards` row with `replacement_number + 1`, links `replaces_card_id`, and moves the old card to `replaced`. Every status change is written to `card_status_history` by trigger.

Org-specific fields use `member_custom_field_defs` (definitions per org) plus `members.custom_fields jsonb` (values), validated server-side against definitions. Common school fields are first-class columns; everything else is custom.

## 5. QR / verification credential design

- QR encodes only a URL: `https://<host>/verify/<token>`. No personal data.
- Token: 32 bytes from a CSPRNG, base64url (256 bits). Generated server-side only.
- Database stores only `sha256(token)` (`credential_hash`, unique). The plaintext token exists only at issuance (to render the QR/PDF) and is never persisted. A database leak therefore does not reveal usable credentials.
- Verification is done by the `public.verify_credential(hash)` RPC, executable only by the service role. The `/verify/[token]` route hashes the token server-side, calls the RPC, and returns only: result, organization name, card number, issue month, status. Org-configurable public fields are opt-in (`organization_settings.public_verify_fields`), default none.
- Not-found, malformed and wrong-token cases all return the same `INVALID` response with similar timing to limit enumeration.
- Rate limiting: per-IP counters in `verification_events` (hashed IP, daily-salted) checked before lookup; Vercel-level limits added in Phase 9.
- Every verification is logged (result, card if any, org if any, coarse metadata). Raw IPs are not stored.
- Signed credentials (HMAC/Ed25519 embedded in the token) are a planned Phase 9 hardening so obviously forged tokens are rejected before any database lookup.
- Honest limit: a photocopied or screenshotted valid QR still verifies. Mitigations are status controls (revoke/suspend/expire/replace), anomaly detection on scan volume per card, and visible card features. We never claim QR prevents physical counterfeiting.

## 6. Storage

Private buckets, path-prefixed by organization id:

- `org-assets/{org_id}/...` logos, signatures (private; served by signed URL)
- `member-photos-original/{org_id}/{member_id}/...`
- `member-photos-processed/{org_id}/{member_id}/...`
- `card-files/{org_id}/{batch_or_card_id}/...` generated PDFs/PNGs
- `batch-imports/{org_id}/{batch_id}/...`
- `template-assets` public-read, platform-admin write (no personal data)

Storage RLS checks the first path segment against the caller's org membership. Originals are kept; processed images are derived. Photos are never public by URL.

## 7. Templates

Templates are data: a `card_templates` row holds dimensions, bleed, safe zone, orientation, and `front_design` / `back_design` JSON (background, elements with position, typography, field bindings, visibility). One renderer interprets this JSON, so 50 → 500 templates is a data change. Org branding is injected through allowed tokens only (colors, logo, wording) and cannot change dimensions or the QR zone.

## 8. Print engine (Phase 8)

Printer-independent output: PDF at true CR80 (85.60 × 53.98 mm) or custom size, front/back/duplex pairing, bleed, safe margins, optional crop marks, 300 DPI where rasterized. No printer-brand coupling; no claim of universal compatibility.

## 9. Batches

`card_batches` + `batch_records`. Flow: upload → parse → validate (required fields, duplicates, photo match) → review report → resolve critical errors → generate. Final generation is blocked while any `error`-severity record is unresolved. Large batches run as background jobs and are resumable.

## 10. Security checklist (enforced from day one)

- RLS on every table; default deny.
- No service-role key in client code; `NEXT_PUBLIC_*` only for URL and publishable key.
- Server-side input validation (zod) on every route/action.
- Upload limits: type allowlist (jpeg/png/webp), size cap, magic-byte check.
- Audit log for admin actions; append-only (no update/delete policies).
- Security tests must attempt cross-organization reads and writes (Phase 9).

## 11. Phases

1 Foundation (this) · 2 Orgs & members · 3 Camera & photo engine · 4 Template engine · 5 ID generation · 6 Batches · 7 Verification UI · 8 Print engine · 9 Security & QA · 10 Production.

## 12. Known limits / decisions

- Face detection uses the browser `FaceDetector` where available with a lightweight fallback; basic capture never depends on it.
- Offline capture is deferred; if added, local records will be clearly marked unsynced.
- Supabase project: `https://swfrpywkjqnmrqozdtbo.supabase.co`. Migrations 1–9 are applied. See `docs/HANDOVER.md` for operations.
