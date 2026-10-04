-- EduCard Pro — core schema (Phase 1)
-- Every tenant-owned table carries organization_id. RLS is enabled in the next migration.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.org_type as enum
  ('community','school','church','association','business','ngo','club','other');

create type public.org_role as enum ('org_staff','org_admin','org_owner');

create type public.card_status as enum
  ('draft','active','expired','revoked','suspended','lost','replaced');

create type public.batch_status as enum
  ('draft','validating','ready','generating','completed','failed','archived');

create type public.record_severity as enum ('ok','warning','error');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Rows must never be moved between organizations.
create or replace function public.prevent_org_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Platform super admins are deliberately separate from organization roles.
create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(name) between 2 and 120),
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  org_type              public.org_type not null default 'other',
  status                text not null default 'active' check (status in ('active','suspended')),
  card_prefix           text not null check (card_prefix ~ '^[A-Z0-9]{2,8}$'),
  logo_path             text,
  signature_path        text,
  primary_color         text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color       text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  contact_email         text,
  contact_phone         text,
  address               text,
  verification_wording  text check (verification_wording is null or char_length(verification_wording) <= 300),
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_users (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             public.org_role not null default 'org_staff',
  created_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index idx_org_users_user on public.organization_users (user_id);
create trigger trg_org_users_noorg before update on public.organization_users
  for each row execute function public.prevent_org_change();

create table public.organization_settings (
  organization_id        uuid primary key references public.organizations(id) on delete cascade,
  default_template_id    uuid,
  card_validity_months   int not null default 12 check (card_validity_months between 1 and 120),
  -- Opt-in list of member fields shown on the public verify page. Default: none.
  public_verify_fields   text[] not null default '{}',
  card_number_seq        bigint not null default 0,
  member_number_seq      bigint not null default 0,
  updated_at             timestamptz not null default now()
);
create trigger trg_org_settings_updated before update on public.organization_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
create table public.member_custom_field_defs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  key              text not null check (key ~ '^[a-z][a-z0-9_]{0,40}$'),
  label            text not null,
  field_type       text not null default 'text' check (field_type in ('text','number','date','boolean','select')),
  options          jsonb,
  required         boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  unique (organization_id, key)
);
create trigger trg_cfd_noorg before update on public.member_custom_field_defs
  for each row execute function public.prevent_org_change();

create table public.members (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  member_number         text not null,
  first_name            text not null check (char_length(first_name) between 1 and 80),
  middle_name           text,
  last_name             text not null check (char_length(last_name) between 1 and 80),
  full_name             text generated always as
                          (btrim(first_name || coalesce(' ' || nullif(btrim(middle_name), ''), '') || ' ' || last_name)) stored,
  date_of_birth         date,
  gender                text,
  phone                 text,
  address               text,
  role_title            text,
  department            text,
  class_name            text,
  section               text,
  grade_level           text,
  academic_year         text,
  student_number        text,
  employee_number       text,
  photo_original_path   text,
  photo_processed_path  text,
  custom_fields         jsonb not null default '{}'::jsonb,
  status                text not null default 'active' check (status in ('active','inactive','archived')),
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, member_number)
);
create unique index uq_members_student_no  on public.members (organization_id, student_number)  where student_number  is not null;
create unique index uq_members_employee_no on public.members (organization_id, employee_number) where employee_number is not null;
create index idx_members_org        on public.members (organization_id);
create index idx_members_org_status on public.members (organization_id, status);
create index idx_members_org_created on public.members (organization_id, created_at desc);
create trigger trg_members_updated before update on public.members
  for each row execute function public.set_updated_at();
create trigger trg_members_noorg before update on public.members
  for each row execute function public.prevent_org_change();

-- ---------------------------------------------------------------------------
-- Templates (data-driven; org_id null = global template)
-- ---------------------------------------------------------------------------
create table public.card_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete cascade,
  slug             text not null,
  name             text not null,
  category         text not null,
  orientation      text not null default 'landscape' check (orientation in ('landscape','portrait')),
  width_mm         numeric(6,2) not null default 85.60 check (width_mm between 30 and 200),
  height_mm        numeric(6,2) not null default 53.98 check (height_mm between 30 and 200),
  bleed_mm         numeric(4,2) not null default 1.00 check (bleed_mm between 0 and 5),
  safe_zone_mm     numeric(4,2) not null default 3.00 check (safe_zone_mm between 0 and 10),
  photo_width_mm   numeric(5,2) not null default 25.00,
  photo_height_mm  numeric(5,2) not null default 32.00,
  front_design     jsonb not null default '{}'::jsonb,
  back_design      jsonb not null default '{}'::jsonb,
  version          int not null default 1,
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index uq_templates_global_slug on public.card_templates (slug) where organization_id is null;
create unique index uq_templates_org_slug    on public.card_templates (organization_id, slug) where organization_id is not null;
create index idx_templates_category on public.card_templates (category) where is_active;
create trigger trg_templates_updated before update on public.card_templates
  for each row execute function public.set_updated_at();

-- Optional normalized element rows (for the future visual editor); the renderer
-- reads front_design/back_design JSON, so this table is not required for rendering.
create table public.template_elements (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.card_templates(id) on delete cascade,
  side         text not null check (side in ('front','back')),
  element_type text not null check (element_type in ('text','field','photo','qr','logo','image','shape','signature')),
  props        jsonb not null default '{}'::jsonb,
  z_index      int not null default 0
);
create index idx_template_elements_template on public.template_elements (template_id);

alter table public.organization_settings
  add constraint fk_settings_default_template
  foreign key (default_template_id) references public.card_templates(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Batches
-- ---------------------------------------------------------------------------
create table public.card_batches (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  template_id      uuid references public.card_templates(id) on delete set null,
  status           public.batch_status not null default 'draft',
  total_records    int not null default 0,
  generated_count  int not null default 0,
  error_message    text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index idx_batches_org on public.card_batches (organization_id, created_at desc);
create trigger trg_batches_noorg before update on public.card_batches
  for each row execute function public.prevent_org_change();

-- ---------------------------------------------------------------------------
-- ID cards
-- ---------------------------------------------------------------------------
create table public.id_cards (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  member_id           uuid not null references public.members(id) on delete restrict,
  template_id         uuid references public.card_templates(id) on delete set null,
  batch_id            uuid references public.card_batches(id) on delete set null,
  card_number         text not null,
  status              public.card_status not null default 'draft',
  issue_date          date,
  expiry_date         date,
  replacement_number  int not null default 1 check (replacement_number >= 1),
  replaces_card_id    uuid references public.id_cards(id) on delete set null,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, card_number),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);
create index idx_cards_org_status on public.id_cards (organization_id, status);
create index idx_cards_member     on public.id_cards (member_id);
create index idx_cards_batch      on public.id_cards (batch_id);
create index idx_cards_created    on public.id_cards (organization_id, created_at desc);
create trigger trg_cards_updated before update on public.id_cards
  for each row execute function public.set_updated_at();
create trigger trg_cards_noorg before update on public.id_cards
  for each row execute function public.prevent_org_change();

-- Only the SHA-256 hash of the QR token is stored; the plaintext token is shown once at issuance.
create table public.verification_credentials (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  card_id          uuid not null unique references public.id_cards(id) on delete cascade,
  credential_hash  text not null unique check (credential_hash ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz not null default now()
);
create index idx_credentials_org on public.verification_credentials (organization_id);

create table public.batch_records (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  batch_id         uuid not null references public.card_batches(id) on delete cascade,
  row_number       int not null,
  raw_data         jsonb not null,
  member_id        uuid references public.members(id) on delete set null,
  card_id          uuid references public.id_cards(id) on delete set null,
  photo_path       text,
  severity         public.record_severity not null default 'ok',
  issues           jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  unique (batch_id, row_number)
);
create index idx_batch_records_batch on public.batch_records (batch_id, severity);
create index idx_batch_records_org   on public.batch_records (organization_id);

-- ---------------------------------------------------------------------------
-- History, events, audit
-- ---------------------------------------------------------------------------
create table public.card_status_history (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  card_id          uuid not null references public.id_cards(id) on delete cascade,
  old_status       public.card_status,
  new_status       public.card_status not null,
  reason           text,
  changed_by       uuid,
  created_at       timestamptz not null default now()
);
create index idx_status_history_card on public.card_status_history (card_id, created_at desc);

create or replace function public.log_card_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.card_status_history (organization_id, card_id, old_status, new_status, changed_by)
    values (new.organization_id, new.id,
            case when tg_op = 'INSERT' then null else old.status end,
            new.status, auth.uid());
  end if;
  return new;
end;
$$;
create trigger trg_cards_status_history
  after insert or update on public.id_cards
  for each row execute function public.log_card_status_change();

create table public.verification_events (
  id               bigint generated always as identity primary key,
  organization_id  uuid references public.organizations(id) on delete set null,
  card_id          uuid references public.id_cards(id) on delete set null,
  result           text not null,
  ip_hash          text,
  created_at       timestamptz not null default now()
);
create index idx_verif_events_org     on public.verification_events (organization_id, created_at desc);
create index idx_verif_events_card    on public.verification_events (card_id, created_at desc);
create index idx_verif_events_ip_time on public.verification_events (ip_hash, created_at desc);

create table public.audit_logs (
  id               bigint generated always as identity primary key,
  organization_id  uuid references public.organizations(id) on delete set null,
  actor_id         uuid,
  action           text not null,
  entity_type      text,
  entity_id        text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index idx_audit_org_time on public.audit_logs (organization_id, created_at desc);
