-- Phase 9 hardening.
-- Card numbers are only ever issued by admins, so staff must not be able to burn the sequence
-- by calling next_card_number directly through the API. Service-role calls (auth.uid() null) are unchanged.
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
  if auth.uid() is not null and not public.has_org_role(p_org, 'org_admin') then
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
grant execute on function public.next_card_number(uuid) to authenticated, service_role;

-- Print rate limit support: count recent print runs per organization quickly.
create index if not exists audit_logs_org_action_time_idx
  on public.audit_logs (organization_id, action, created_at desc);
