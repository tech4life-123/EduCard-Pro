-- Verification result now includes the card's expiry month (display only).
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
    'expires',       to_char(rec.expiry_date, 'FMMonth YYYY'),
    'wording',       rec.verification_wording,
    'public_fields', pub
  );
end;
$$;
