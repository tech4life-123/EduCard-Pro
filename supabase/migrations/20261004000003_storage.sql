-- EduCard Pro — storage buckets and policies (Phase 1)
-- Path convention: <bucket>/<organization_id>/...  The first folder is the tenant boundary.
-- Private buckets are never reachable by plain URL; use short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('org-assets',                'org-assets',                false,  2097152, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('member-photos-original',    'member-photos-original',    false,  8388608, array['image/jpeg','image/png','image/webp']),
  ('member-photos-processed',   'member-photos-processed',   false,  1048576, array['image/jpeg','image/png','image/webp']),
  ('card-files',                'card-files',                false, 52428800, array['application/pdf','image/png','image/jpeg']),
  ('batch-imports',             'batch-imports',             false, 26214400, array['text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip']),
  ('template-assets',           'template-assets',           true,   5242880, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Safe uuid cast: a malformed folder name yields NULL (deny) instead of an error.
create or replace function public.storage_org_id(object_name text)
returns uuid
language plpgsql immutable
set search_path = ''
as $$
declare
  first_folder text := split_part(object_name, '/', 1);
begin
  return first_folder::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function public.storage_org_id(text) to authenticated;

-- Tenant buckets: members read; staff write; admins delete.
do $$
declare
  b text;
begin
  foreach b in array array['org-assets','member-photos-original','member-photos-processed','card-files','batch-imports']
  loop
    execute format($f$
      create policy "%1$s read" on storage.objects
        for select to authenticated
        using (bucket_id = %2$L and public.is_org_member(public.storage_org_id(name)));
      create policy "%1$s insert" on storage.objects
        for insert to authenticated
        with check (bucket_id = %2$L and public.has_org_role(public.storage_org_id(name), 'org_staff'));
      create policy "%1$s update" on storage.objects
        for update to authenticated
        using (bucket_id = %2$L and public.has_org_role(public.storage_org_id(name), 'org_staff'))
        with check (bucket_id = %2$L and public.has_org_role(public.storage_org_id(name), 'org_staff'));
      create policy "%1$s delete" on storage.objects
        for delete to authenticated
        using (bucket_id = %2$L and public.has_org_role(public.storage_org_id(name), 'org_admin'));
    $f$, b, b);
  end loop;
end
$$;

-- Org logos/signatures must be managed by admins, not staff.
drop policy "org-assets insert" on storage.objects;
drop policy "org-assets update" on storage.objects;
create policy "org-assets insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'org-assets' and public.has_org_role(public.storage_org_id(name), 'org_admin'));
create policy "org-assets update" on storage.objects
  for update to authenticated
  using (bucket_id = 'org-assets' and public.has_org_role(public.storage_org_id(name), 'org_admin'))
  with check (bucket_id = 'org-assets' and public.has_org_role(public.storage_org_id(name), 'org_admin'));

-- template-assets: public read (no personal data allowed here), platform admins write.
create policy "template-assets public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'template-assets');
create policy "template-assets platform write" on storage.objects
  for all to authenticated
  using (bucket_id = 'template-assets' and public.is_platform_admin())
  with check (bucket_id = 'template-assets' and public.is_platform_admin());
