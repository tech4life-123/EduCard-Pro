-- A batch record's batch, member and card must all belong to the record's organization.
-- (Foreign keys alone would allow a row in org B to point at org A's batch.)
create or replace function public.guard_batch_record_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.card_batches b where b.id = new.batch_id and b.organization_id = new.organization_id) then
    raise exception 'Batch does not belong to this organization.';
  end if;
  if new.member_id is not null and not exists (
       select 1 from public.members m where m.id = new.member_id and m.organization_id = new.organization_id) then
    raise exception 'Member does not belong to this organization.';
  end if;
  if new.card_id is not null and not exists (
       select 1 from public.id_cards c where c.id = new.card_id and c.organization_id = new.organization_id) then
    raise exception 'Card does not belong to this organization.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_batch_record_refs() from public, anon, authenticated;

create trigger trg_batch_records_guard
  before insert or update on public.batch_records
  for each row execute function public.guard_batch_record_refs();
