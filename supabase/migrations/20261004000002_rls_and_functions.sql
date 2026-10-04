-- EduCard Pro — authorization helpers, RLS policies, RPCs (Phase 1)
-- Principle: default deny. Every table has RLS enabled; only listed policies grant access.

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER, pinned search_path, no recursion into RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.role_rank(r public.org_role)
returns int
language sql immutable
set search_path = ''
as $$
  select case r when 'org_staff' then 1 when 'org_admin' then 2 when 'org_owner' then 3 end;
$$;

-- Member of the organization, and the organization is not suspended.
-- Platform admins can always read (suspended orgs included) via separate policies.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_users ou
    join public.organizations o on o.id = ou.organization_id
    where ou.organization_id = org
      and ou.user_id = auth.uid()
      and o.status = 'active'
  );
$$;

create or replace function public.has_org_role(org uuid, min_role public.org_role)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_users ou
    join public.organizations o on o.id = ou.organization_id
    where ou.organization_id = org
      and ou.user_id = auth.uid()
      and o.status = 'active'
      and public.role_rank(ou.role) >= public.role_rank(min_role)
  );
$$;

revoke all on function public.is_platform_admin()               from public, anon;
revoke all on function public.is_org_member(uuid)               from public, anon;
revoke all on function public.has_org_role(uuid, public.org_role) from public, anon;
grant execute on function public.is_platform_admin()               to authenticated;
grant execute on function public.is_org_member(uuid)               to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Guards (triggers) that RLS alone cannot express
-- ---------------------------------------------------------------------------

-- Staff may only create/edit cards in 'draft'. Activating, revoking, suspending, etc.
-- needs org_admin. auth.uid() is null for service-role/migration contexts (trusted server code).
create or replace function public.guard_card_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.status <> 'draft')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if not (public.has_org_role(new.organization_id, 'org_admin') or public.is_platform_admin()) then
      raise exception 'Only organization admins can change a card status.';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_cards_guard_status
  before insert or update on public.id_cards
  for each row execute function public.guard_card_status();

-- Every card's member, template batch and replaced card must belong to the same org.
create or replace function public.guard_card_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.members m
                 where m.id = new.member_id and m.organization_id = new.organization_id) then
    raise exception 'Member does not belong to this organization.';
  end if;
  if new.batch_id is not null and not exists (
       select 1 from public.card_batches b
       where b.id = new.batch_id and b.organization_id = new.organization_id) then
    raise exception 'Batch does not belong to this organization.';
  end if;
  if new.template_id is not null and not exists (
       select 1 from public.card_templates t
       where t.id = new.template_id
         and (t.organization_id is null or t.organization_id = new.organization_id)) then
    raise exception 'Template is not available to this organization.';
  end if;
  if new.replaces_card_id is not null and not exists (
       select 1 from public.id_cards c
       where c.id = new.replaces_card_id and c.organization_id = new.organization_id) then
    raise exception 'Replaced card does not belong to this organization.';
  end if;
  return new;
end;
$$;
create trigger trg_cards_guard_refs
  before insert or update on public.id_cards
  for each row execute function public.guard_card_refs();

-- Credentials must point at a card in the same organization.
create or replace function public.guard_credential_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.id_cards c
                 where c.id = new.card_id and c.organization_id = new.organization_id) then
    raise exception 'Card does not belong to this organization.';
  end if;
  return new;
end;
$$;
create trigger trg_credentials_guard
  before insert or update on public.verification_credentials
  for each row execute function public.guard_credential_org();

-- Prevent removing/demoting the last owner of an organization.
create or replace function public.guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining int;
begin
  if (tg_op = 'DELETE' and old.role = 'org_owner')
     or (tg_op = 'UPDATE' and old.role = 'org_owner' and new.role <> 'org_owner') then
    select count(*) into remaining
    from public.organization_users
    where organization_id = old.organization_id and role = 'org_owner' and id <> old.id;
    if remaining = 0 and exists (select 1 from public.organizations where id = old.organization_id) then
      raise exception 'An organization must keep at least one owner.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_org_users_last_owner
  before update or delete on public.organization_users
  for each row execute function public.guard_last_owner();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Self-service onboarding: creates the organization, its settings, and makes the caller owner.
-- Direct INSERT on organizations is not allowed for regular users.
create or replace function public.create_organization(
  p_name text, p_slug text, p_type public.org_type, p_card_prefix text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;
  insert into public.organizations (name, slug, org_type, card_prefix, created_by)
  values (p_name, lower(p_slug), p_type, upper(p_card_prefix), auth.uid())
  returning id into new_id;
  insert into public.organization_settings (organization_id) values (new_id);
  insert into public.organization_users (organization_id, user_id, role)
  values (new_id, auth.uid(), 'org_owner');
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (new_id, auth.uid(), 'organization.create', 'organization', new_id::text);
  return new_id;
end;
$$;
revoke all on function public.create_organization(text, text, public.org_type, text) from public, anon;
grant execute on function public.create_organization(text, text, public.org_type, text) to authenticated;

-- Atomic, gap-tolerant, per-organization sequential card number: PREFIX-000123
create or replace function public.next_card_number(p_org uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
  pfx text;
begin
  if auth.uid() is not null and not public.has_org_role(p_org, 'org_staff') then
    raise exception 'Not allowed.';
  end if;
  update public.organization_settings
     set card_number_seq = card_number_seq + 1
   where organization_id = p_org
   returning card_number_seq into n;
  if n is null then
    raise exception 'Organization settings not found.';
  end if;
  select card_prefix into pfx from public.organizations where id = p_org;
  return pfx || '-' || lpad(n::text, 6, '0');
end;
$$;
revoke all on function public.next_card_number(uuid) from public, anon;
grant execute on function public.next_card_number(uuid) to authenticated;

create or replace function public.next_member_number(p_org uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
  pfx text;
begin
  if auth.uid() is not null and not public.has_org_role(p_org, 'org_staff') then
    raise exception 'Not allowed.';
  end if;
  update public.organization_settings
     set member_number_seq = member_number_seq + 1
   where organization_id = p_org
   returning member_number_seq into n;
  if n is null then
    raise exception 'Organization settings not found.';
  end if;
  select card_prefix into pfx from public.organizations where id = p_org;
  return 'M-' || pfx || '-' || lpad(n::text, 6, '0');
end;
$$;
revoke all on function public.next_member_number(uuid) from public, anon;
grant execute on function public.next_member_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public verification. Callable ONLY by the service role (the Next.js server route).
-- Input is the SHA-256 hex of the QR token; the plaintext token is never stored.
-- Every non-match returns the same INVALID shape. Returns the minimum public data.
-- ---------------------------------------------------------------------------
create or replace function public.verify_credential(p_hash text, p_ip_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec        record;
  eff        text;
  recent     int;
  pub_fields text[];
  allowed    constant text[] := array['full_name','role_title','department','class_name','grade_level','academic_year'];
  pub        jsonb := '{}'::jsonb;
  k          text;
  mval       jsonb;
begin
  -- Rate limit per hashed IP: 30 lookups/minute.
  if p_ip_hash is not null then
    select count(*) into recent
    from public.verification_events
    where ip_hash = p_ip_hash and created_at > now() - interval '1 minute';
    if recent >= 30 then
      return jsonb_build_object('result', 'RATE_LIMITED');
    end if;
  end if;

  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    insert into public.verification_events (result, ip_hash) values ('INVALID', p_ip_hash);
    return jsonb_build_object('result', 'INVALID');
  end if;

  select c.id as card_id, c.organization_id, c.card_number, c.status, c.issue_date,
         c.expiry_date, c.member_id, o.name as org_name, o.status as org_status,
         o.verification_wording
    into rec
    from public.verification_credentials vc
    join public.id_cards c      on c.id = vc.card_id
    join public.organizations o on o.id = c.organization_id
   where vc.credential_hash = p_hash;

  if not found then
    insert into public.verification_events (result, ip_hash) values ('INVALID', p_ip_hash);
    return jsonb_build_object('result', 'INVALID');
  end if;

  if rec.org_status <> 'active' then
    eff := 'SUSPENDED';
  elsif rec.status = 'draft' then
    eff := 'INVALID';
  elsif rec.status = 'active' then
    eff := case when rec.expiry_date is not null and rec.expiry_date < current_date
                then 'EXPIRED' else 'VERIFIED' end;
  elsif rec.status = 'expired'   then eff := 'EXPIRED';
  elsif rec.status = 'revoked'   then eff := 'REVOKED';
  elsif rec.status = 'lost'      then eff := 'REVOKED';
  elsif rec.status = 'suspended' then eff := 'SUSPENDED';
  elsif rec.status = 'replaced'  then eff := 'REPLACED';
  else eff := 'INVALID';
  end if;

  insert into public.verification_events (organization_id, card_id, result, ip_hash)
  values (rec.organization_id, rec.card_id, eff, p_ip_hash);

  if eff = 'INVALID' then
    return jsonb_build_object('result', 'INVALID');
  end if;

  -- Org-opted-in public fields, restricted to a hard-coded allowlist.
  select s.public_verify_fields into pub_fields
    from public.organization_settings s where s.organization_id = rec.organization_id;
  if eff = 'VERIFIED' and pub_fields is not null then
    select to_jsonb(m) into mval from public.members m where m.id = rec.member_id;
    foreach k in array pub_fields loop
      if k = any (allowed) and mval ? k then
        pub := pub || jsonb_build_object(k, mval -> k);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'result',        eff,
    'organization',  rec.org_name,
    'card_number',   rec.card_number,
    'status',        rec.status,
    'issued',        to_char(rec.issue_date, 'FMMonth YYYY'),
    'wording',       rec.verification_wording,
    'public_fields', pub
  );
end;
$$;
revoke all on function public.verify_credential(text, text) from public, anon, authenticated;
grant execute on function public.verify_credential(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Table privileges: nothing is granted implicitly; RLS then narrows further.
-- verification_events and audit_logs are append/read-only for clients.
-- ---------------------------------------------------------------------------
alter table public.profiles                  enable row level security;
alter table public.platform_admins           enable row level security;
alter table public.organizations             enable row level security;
alter table public.organization_users        enable row level security;
alter table public.organization_settings     enable row level security;
alter table public.member_custom_field_defs  enable row level security;
alter table public.members                   enable row level security;
alter table public.card_templates            enable row level security;
alter table public.template_elements         enable row level security;
alter table public.card_batches              enable row level security;
alter table public.id_cards                  enable row level security;
alter table public.verification_credentials  enable row level security;
alter table public.batch_records             enable row level security;
alter table public.card_status_history       enable row level security;
alter table public.verification_events       enable row level security;
alter table public.audit_logs                enable row level security;

-- profiles: own row; org-mates can see names of people in shared orgs; platform admins see all.
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_select_orgmates on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.organization_users a
      join public.organization_users b on b.organization_id = a.organization_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );
create policy profiles_select_platform on public.profiles
  for select to authenticated using (public.is_platform_admin());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- platform_admins: only platform admins can see the list; writes via service role only.
create policy platform_admins_select on public.platform_admins
  for select to authenticated using (public.is_platform_admin());

-- organizations
create policy orgs_select_member on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy orgs_select_platform on public.organizations
  for select to authenticated using (public.is_platform_admin());
create policy orgs_update_admin on public.organizations
  for update to authenticated
  using (public.has_org_role(id, 'org_admin'))
  with check (public.has_org_role(id, 'org_admin'));
create policy orgs_platform_all on public.organizations
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
-- Note: 'status' (suspension) must only change via platform admin; enforced below.
create or replace function public.guard_org_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and not public.is_platform_admin() then
    raise exception 'Only platform administrators can suspend or reactivate an organization.';
  end if;
  return new;
end;
$$;
create trigger trg_orgs_guard_status
  before update on public.organizations
  for each row execute function public.guard_org_status();

-- organization_users
create policy orgusers_select_member on public.organization_users
  for select to authenticated using (public.is_org_member(organization_id));
create policy orgusers_select_platform on public.organization_users
  for select to authenticated using (public.is_platform_admin());
create policy orgusers_insert on public.organization_users
  for insert to authenticated with check (
    public.has_org_role(organization_id, 'org_owner')
    or (public.has_org_role(organization_id, 'org_admin') and role <> 'org_owner')
  );
create policy orgusers_update on public.organization_users
  for update to authenticated
  using (
    public.has_org_role(organization_id, 'org_owner')
    or (public.has_org_role(organization_id, 'org_admin') and role <> 'org_owner')
  )
  with check (
    public.has_org_role(organization_id, 'org_owner')
    or (public.has_org_role(organization_id, 'org_admin') and role <> 'org_owner')
  );
create policy orgusers_delete on public.organization_users
  for delete to authenticated using (
    public.has_org_role(organization_id, 'org_owner')
    or (public.has_org_role(organization_id, 'org_admin') and role <> 'org_owner')
    or user_id = auth.uid()
  );

-- organization_settings
create policy settings_select on public.organization_settings
  for select to authenticated using (public.is_org_member(organization_id));
create policy settings_update on public.organization_settings
  for update to authenticated
  using (public.has_org_role(organization_id, 'org_admin'))
  with check (public.has_org_role(organization_id, 'org_admin'));
-- Sequence counters must not be edited by clients.
create or replace function public.guard_settings_counters()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and (
       new.card_number_seq   is distinct from old.card_number_seq
    or new.member_number_seq is distinct from old.member_number_seq) then
    -- Allowed only from inside the SECURITY DEFINER numbering functions.
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'Counters are managed by the system.';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_settings_guard_counters
  before update on public.organization_settings
  for each row execute function public.guard_settings_counters();

-- member_custom_field_defs
create policy cfd_select on public.member_custom_field_defs
  for select to authenticated using (public.is_org_member(organization_id));
create policy cfd_write on public.member_custom_field_defs
  for all to authenticated
  using (public.has_org_role(organization_id, 'org_admin'))
  with check (public.has_org_role(organization_id, 'org_admin'));

-- members
create policy members_select on public.members
  for select to authenticated using (public.is_org_member(organization_id));
create policy members_insert on public.members
  for insert to authenticated with check (public.has_org_role(organization_id, 'org_staff'));
create policy members_update on public.members
  for update to authenticated
  using (public.has_org_role(organization_id, 'org_staff'))
  with check (public.has_org_role(organization_id, 'org_staff'));
create policy members_delete on public.members
  for delete to authenticated using (public.has_org_role(organization_id, 'org_admin'));

-- card_templates: global templates readable by any signed-in user; org templates by members.
create policy templates_select_global on public.card_templates
  for select to authenticated using (organization_id is null and is_active);
create policy templates_select_org on public.card_templates
  for select to authenticated using (organization_id is not null and public.is_org_member(organization_id));
create policy templates_org_write on public.card_templates
  for all to authenticated
  using (organization_id is not null and public.has_org_role(organization_id, 'org_admin'))
  with check (organization_id is not null and public.has_org_role(organization_id, 'org_admin'));
create policy templates_platform_all on public.card_templates
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- template_elements follow their template
create policy tel_select on public.template_elements
  for select to authenticated using (
    exists (select 1 from public.card_templates t
            where t.id = template_id
              and ((t.organization_id is null and t.is_active)
                   or (t.organization_id is not null and public.is_org_member(t.organization_id))))
  );
create policy tel_write on public.template_elements
  for all to authenticated
  using (
    public.is_platform_admin() or exists (
      select 1 from public.card_templates t
      where t.id = template_id and t.organization_id is not null
        and public.has_org_role(t.organization_id, 'org_admin'))
  )
  with check (
    public.is_platform_admin() or exists (
      select 1 from public.card_templates t
      where t.id = template_id and t.organization_id is not null
        and public.has_org_role(t.organization_id, 'org_admin'))
  );

-- card_batches
create policy batches_select on public.card_batches
  for select to authenticated using (public.is_org_member(organization_id));
create policy batches_insert on public.card_batches
  for insert to authenticated with check (public.has_org_role(organization_id, 'org_staff'));
create policy batches_update on public.card_batches
  for update to authenticated
  using (public.has_org_role(organization_id, 'org_staff'))
  with check (public.has_org_role(organization_id, 'org_staff'));
create policy batches_delete on public.card_batches
  for delete to authenticated using (public.has_org_role(organization_id, 'org_admin'));

-- id_cards (status transitions beyond draft are guarded by trigger above)
create policy cards_select on public.id_cards
  for select to authenticated using (public.is_org_member(organization_id));
create policy cards_insert on public.id_cards
  for insert to authenticated with check (public.has_org_role(organization_id, 'org_staff'));
create policy cards_update on public.id_cards
  for update to authenticated
  using (public.has_org_role(organization_id, 'org_staff'))
  with check (public.has_org_role(organization_id, 'org_staff'));
create policy cards_delete on public.id_cards
  for delete to authenticated using (
    public.has_org_role(organization_id, 'org_admin') and status = 'draft'
  );

-- verification_credentials: admins/staff may create; hashes are readable by admins only.
create policy creds_select on public.verification_credentials
  for select to authenticated using (public.has_org_role(organization_id, 'org_admin'));
create policy creds_insert on public.verification_credentials
  for insert to authenticated with check (public.has_org_role(organization_id, 'org_staff'));

-- batch_records
create policy brec_select on public.batch_records
  for select to authenticated using (public.is_org_member(organization_id));
create policy brec_write on public.batch_records
  for all to authenticated
  using (public.has_org_role(organization_id, 'org_staff'))
  with check (public.has_org_role(organization_id, 'org_staff'));

-- card_status_history: readable by org members; written only by the trigger.
create policy csh_select on public.card_status_history
  for select to authenticated using (public.is_org_member(organization_id));

-- verification_events: org admins read their own org's events; inserts via RPC/service role only.
create policy verif_select_org on public.verification_events
  for select to authenticated using (
    organization_id is not null and public.has_org_role(organization_id, 'org_admin')
  );
create policy verif_select_platform on public.verification_events
  for select to authenticated using (public.is_platform_admin());

-- audit_logs: append-only for members; readable by admins. No update/delete policies exist.
create policy audit_select_admin on public.audit_logs
  for select to authenticated using (
    organization_id is not null and public.has_org_role(organization_id, 'org_admin')
  );
create policy audit_select_platform on public.audit_logs
  for select to authenticated using (public.is_platform_admin());
create policy audit_insert_member on public.audit_logs
  for insert to authenticated with check (
    actor_id = auth.uid()
    and organization_id is not null
    and public.has_org_role(organization_id, 'org_staff')
  );

-- Revoke blanket table privileges added by Supabase defaults where clients must not write.
revoke insert, update, delete on public.card_status_history  from anon, authenticated;
revoke insert, update, delete on public.verification_events  from anon, authenticated;
revoke update, delete         on public.audit_logs           from anon, authenticated;
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;
-- Anonymous (signed-out) users get no direct table access at all.
revoke all on all tables in schema public from anon;
