import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const MIG = new URL("../../supabase/migrations/", import.meta.url).pathname;
const db = new PGlite();

// ---- Supabase stand-ins -------------------------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant all on all tables in schema storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

for (const f of ["20261004000001_core_schema.sql", "20261004000002_rls_and_functions.sql", "20261004000003_storage.sql", "20261004000004_lock_trigger_functions.sql", "20261005000005_starter_templates.sql"]) {
  try { await db.exec(readFileSync(MIG + f, "utf8")); console.log("migration ok:", f); }
  catch (e) { console.log("MIGRATION FAILED:", f, "\n", e.message); process.exit(1); }
}

// ---- helpers --------------------------------------------------------------
let pass = 0, fail = 0;
const as = async (role, uid, sql, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
};
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  -> " + extra)); };
const denied = (name, r) => ok(name, !!r.error, "expected an error but got " + JSON.stringify(r.rows));
const allowed = (name, r) => ok(name, !r.error, r.error);

const A = "00000000-0000-0000-0000-00000000000a"; // owner of orgA
const B = "00000000-0000-0000-0000-00000000000b"; // owner of orgB
const C = "00000000-0000-0000-0000-00000000000c"; // staff in orgA
const P = "00000000-0000-0000-0000-0000000000f0"; // platform admin
for (const u of [A, B, C, P]) await db.query("insert into auth.users (id) values ($1)", [u]);
await db.query("insert into public.platform_admins (user_id) values ($1)", [P]);

// ---- onboarding -------------------------------------------------------------
const oa = await as("authenticated", A, "select public.create_organization('Alpha School','alpha','school','ALPHA') id");
const ob = await as("authenticated", B, "select public.create_organization('Beta Church','beta','church','BETA') id");
allowed("A creates org via RPC", oa); allowed("B creates org via RPC", ob);
const orgA = oa.rows[0].id, orgB = ob.rows[0].id;
denied("direct INSERT into organizations is blocked", await as("authenticated", A,
  "insert into public.organizations (name,slug,card_prefix) values ('Evil','evil','EVIL')"));
denied("anonymous cannot read organizations", await as("anon", null, "select * from public.organizations"));

// ---- isolation ----------------------------------------------------------------
const seeA = await as("authenticated", A, "select count(*)::int n from public.organizations");
ok("A sees only its own organization", seeA.rows[0].n === 1, JSON.stringify(seeA.rows));
await as("authenticated", A, "insert into public.organization_users (organization_id,user_id,role) values ($1,$2,'org_staff')", [orgA, C]);
const ma = await as("authenticated", A,
  `insert into public.members (organization_id, member_number, first_name, last_name, date_of_birth)
   values ($1, public.next_member_number($1), 'Ada', 'Lovelace', '2000-01-01') returning id, member_number`, [orgA]);
allowed("A inserts member in orgA", ma);
const memA = ma.rows?.[0]?.id;
const mb = await as("authenticated", B,
  `insert into public.members (organization_id, member_number, first_name, last_name)
   values ($1, public.next_member_number($1), 'Bob', 'Builder') returning id`, [orgB]);
const memB = mb.rows?.[0]?.id;
denied("A cannot insert a member into orgB", await as("authenticated", A,
  "insert into public.members (organization_id, member_number, first_name, last_name) values ($1,'X-1','Mal','Ory')", [orgB]));
ok("B cannot read A's members", (await as("authenticated", B, "select count(*)::int n from public.members where id=$1", [memA])).rows[0].n === 0);
ok("A cannot read B's members", (await as("authenticated", A, "select count(*)::int n from public.members where id=$1", [memB])).rows[0].n === 0);
const upd = await as("authenticated", B, "update public.members set first_name='Hacked' where id=$1 returning id", [memA]);
ok("B cannot update A's member (0 rows)", !upd.error && upd.rows.length === 0, JSON.stringify(upd));
denied("A cannot move a member to orgB", await as("authenticated", A,
  "update public.members set organization_id=$1 where id=$2", [orgB, memA]));
denied("card for A's member cannot be created inside orgB", await as("authenticated", B,
  "insert into public.id_cards (organization_id, member_id, card_number) values ($1,$2,'BETA-9')", [orgB, memA]));
denied("A cannot self-insert into orgB's users", await as("authenticated", A,
  "insert into public.organization_users (organization_id,user_id,role) values ($1,$2,'org_owner')", [orgB, A]));

// ---- roles --------------------------------------------------------------------
denied("staff cannot add org users", await as("authenticated", C,
  "insert into public.organization_users (organization_id,user_id,role) values ($1,$2,'org_admin')", [orgA, B]));
const cardNo = (await as("authenticated", C, "select public.next_card_number($1) n", [orgA])).rows[0].n;
ok("card number format PREFIX-000001", cardNo === "ALPHA-000001", cardNo);
const cc = await as("authenticated", C,
  "insert into public.id_cards (organization_id, member_id, card_number) values ($1,$2,$3) returning id", [orgA, memA, cardNo]);
allowed("staff creates a DRAFT card", cc);
const cardId = cc.rows?.[0]?.id;
denied("staff cannot activate a card", await as("authenticated", C,
  "update public.id_cards set status='active', issue_date=current_date where id=$1", [cardId]));
denied("staff cannot insert an already-active card", await as("authenticated", C,
  "insert into public.id_cards (organization_id, member_id, card_number, status) values ($1,$2,'ALPHA-777','active')", [orgA, memA]));
allowed("owner activates the card", await as("authenticated", A,
  "update public.id_cards set status='active', issue_date=current_date, expiry_date=current_date+365 where id=$1", [cardId]));
const hist = await as("authenticated", A, "select count(*)::int n from public.card_status_history where card_id=$1", [cardId]);
ok("status history recorded by trigger (draft + active)", hist.rows[0].n === 2, JSON.stringify(hist));
denied("clients cannot write status history", await as("authenticated", A,
  "insert into public.card_status_history (organization_id, card_id, new_status) values ($1,$2,'revoked')", [orgA, cardId]));
denied("cannot remove the last owner", await as("authenticated", A,
  "delete from public.organization_users where organization_id=$1 and user_id=$2", [orgA, A]));
denied("org admin cannot suspend their own org", await as("authenticated", A,
  "update public.organizations set status='suspended' where id=$1", [orgA]));
denied("clients cannot edit numbering counters", await as("authenticated", A,
  "update public.organization_settings set card_number_seq=0 where organization_id=$1", [orgA]));
denied("audit logs cannot be updated", await as("authenticated", A, "update public.audit_logs set action='x'"));
denied("audit logs cannot be deleted", await as("authenticated", A, "delete from public.audit_logs"));
denied("platform_admins hidden from normal users", await as("authenticated", A, "insert into public.platform_admins (user_id) values ($1)", [A]));

// ---- public verification ------------------------------------------------------
const token = "T".repeat(43);
const hash = createHash("sha256").update(token).digest("hex");
allowed("staff registers credential hash", await as("authenticated", C,
  "insert into public.verification_credentials (organization_id, card_id, credential_hash) values ($1,$2,$3)", [orgA, cardId, hash]));
denied("credential must reference a same-org card", await as("authenticated", B,
  "insert into public.verification_credentials (organization_id, card_id, credential_hash) values ($1,$2,$3)", [orgB, cardId, "a".repeat(64)]));
denied("signed-in users cannot call verify_credential directly", await as("authenticated", A, "select public.verify_credential($1)", [hash]));
denied("anon cannot call verify_credential directly", await as("anon", null, "select public.verify_credential($1)", [hash]));
const v = async (h, ip = "ip1") => (await as("service_role", null, "select public.verify_credential($1,$2) r", [h, ip])).rows?.[0]?.r;
let r = await v(hash);
ok("active card -> VERIFIED with minimal data", r?.result === "VERIFIED" && r.organization === "Alpha School" && r.card_number === cardNo && !("full_name" in (r.public_fields ?? {})), JSON.stringify(r));
ok("no personal data leaked by default", JSON.stringify(r).includes("Ada") === false && JSON.stringify(r).includes("2000") === false, JSON.stringify(r));
ok("unknown token -> INVALID", (await v("f".repeat(64)))?.result === "INVALID");
ok("malformed hash -> INVALID", (await v("not-a-hash"))?.result === "INVALID");
await db.query("update public.organization_settings set public_verify_fields = array['full_name','date_of_birth','phone'] where organization_id=$1", [orgA]);
r = await v(hash);
ok("opt-in public fields honoured; non-allowlisted (DOB, phone) stripped", r.public_fields?.full_name === "Ada Lovelace" && !("date_of_birth" in r.public_fields) && !("phone" in r.public_fields), JSON.stringify(r));
denied("expiry before issue date is rejected by constraint", await (async () => { try { await db.query("update public.id_cards set expiry_date = current_date - 1 where id=$1", [cardId]); return { rows: [] }; } catch (e) { return { error: e.message }; } })());
await db.query("update public.id_cards set issue_date = current_date - 400, expiry_date = current_date - 1 where id=$1", [cardId]);
ok("past expiry date -> EXPIRED", (await v(hash))?.result === "EXPIRED");
await db.query("update public.id_cards set expiry_date = current_date + 30, status='revoked' where id=$1", [cardId]);
ok("revoked -> REVOKED", (await v(hash))?.result === "REVOKED");
await db.query("update public.id_cards set status='suspended' where id=$1", [cardId]);
ok("suspended -> SUSPENDED", (await v(hash))?.result === "SUSPENDED");
await db.query("update public.id_cards set status='replaced' where id=$1", [cardId]);
ok("replaced -> REPLACED", (await v(hash))?.result === "REPLACED");
await db.query("update public.id_cards set status='draft' where id=$1", [cardId]);
ok("draft -> INVALID (never issued)", (await v(hash))?.result === "INVALID");
await db.query("update public.id_cards set status='active' where id=$1", [cardId]);
await db.query("update public.organizations set status='suspended' where id=$1", [orgA]);
ok("suspended organization -> SUSPENDED", (await v(hash))?.result === "SUSPENDED");
await db.query("update public.organizations set status='active' where id=$1", [orgA]);
let limited = false;
for (let i = 0; i < 35; i++) { if ((await v(hash, "burst"))?.result === "RATE_LIMITED") { limited = true; break; } }
ok("rate limit trips after 30 lookups/min per IP hash", limited);
const ev = await db.query("select count(*)::int n from public.verification_events where card_id=$1", [cardId]);
ok("verification events are logged", ev.rows[0].n > 5, JSON.stringify(ev.rows));

// ---- platform admin & suspension ---------------------------------------------------
ok("platform admin sees all orgs", (await as("authenticated", P, "select count(*)::int n from public.organizations")).rows[0].n === 2);
allowed("platform admin can suspend an org", await as("authenticated", P, "update public.organizations set status='suspended' where id=$1", [orgB]));
ok("members of a suspended org lose access", (await as("authenticated", B, "select count(*)::int n from public.members")).rows[0].n === 0);
await db.query("update public.organizations set status='active' where id=$1", [orgB]);

// ---- storage --------------------------------------------------------------------
allowed("A uploads a photo under its own org folder", await as("authenticated", A,
  "insert into storage.objects (bucket_id, name) values ('member-photos-original', $1)", [`${orgA}/${memA}/orig.jpg`]));
denied("A cannot upload into orgB's folder", await as("authenticated", A,
  "insert into storage.objects (bucket_id, name) values ('member-photos-original', $1)", [`${orgB}/x/orig.jpg`]));
denied("malformed path (no org uuid) is rejected", await as("authenticated", A,
  "insert into storage.objects (bucket_id, name) values ('member-photos-original', 'whatever/x.jpg')"));
ok("B cannot see A's photo", (await as("authenticated", B, "select count(*)::int n from storage.objects where bucket_id='member-photos-original'")).rows[0].n === 0);
ok("A can see its photo", (await as("authenticated", A, "select count(*)::int n from storage.objects where bucket_id='member-photos-original'")).rows[0].n === 1);
denied("staff cannot replace org logo (admin only)", await as("authenticated", C,
  "insert into storage.objects (bucket_id, name) values ('org-assets', $1)", [`${orgA}/logo.png`]));
ok("private buckets are not public", (await db.query("select count(*)::int n from storage.buckets where public and id <> 'template-assets'")).rows[0].n === 0);

// ---- templates (Phase 4) ---------------------------------------------------------
ok("5 starter templates are seeded", (await db.query("select count(*)::int n from public.card_templates where organization_id is null")).rows[0].n === 5);
ok("staff can read global templates", (await as("authenticated", C, "select count(*)::int n from public.card_templates")).rows[0].n === 5);
{ const r = await as("anon", null, "select count(*)::int n from public.card_templates"); ok("anonymous cannot read templates", !!r.error || r.rows[0].n === 0); }
const gid = (await db.query("select id from public.card_templates where organization_id is null limit 1")).rows[0].id;
ok("staff cannot edit a global template", (await as("authenticated", C, "update public.card_templates set name='x' where id=$1 returning id", [gid])).rows?.length === 0);
ok("admin cannot edit a global template", (await as("authenticated", A, "update public.card_templates set name='x' where id=$1 returning id", [gid])).rows?.length === 0);
denied("staff cannot create an org template", await as("authenticated", C,
  "insert into public.card_templates (organization_id, slug, name, category) values ($1,'mine','Mine','school')", [orgA]));
allowed("admin creates an org template", await as("authenticated", A,
  "insert into public.card_templates (organization_id, slug, name, category) values ($1,'mine','Mine','school')", [orgA]));
denied("admin cannot create a template in another org", await as("authenticated", A,
  "insert into public.card_templates (organization_id, slug, name, category) values ($1,'evil','Evil','school')", [orgB]));
ok("B cannot see A's org template", (await as("authenticated", B, "select count(*)::int n from public.card_templates where slug='mine'")).rows[0].n === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
