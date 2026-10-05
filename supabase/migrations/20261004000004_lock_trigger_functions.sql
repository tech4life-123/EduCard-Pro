-- Trigger-only SECURITY DEFINER functions must not be callable through the REST API (/rest/v1/rpc/...).
-- Triggers fire without the caller holding EXECUTE, so this does not affect their operation.
revoke all on function public.guard_last_owner()       from public, anon, authenticated;
revoke all on function public.handle_new_user()        from public, anon, authenticated;
revoke all on function public.log_card_status_change() from public, anon, authenticated;

-- Supabase-provided helper (event trigger). Only present on hosted projects.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
