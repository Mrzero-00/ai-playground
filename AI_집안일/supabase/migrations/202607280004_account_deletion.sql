create or replace function public.delete_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owned_home record;
  next_owner_id text;
begin
  if not exists (select 1 from public.app_users where id = p_user_id) then
    return;
  end if;

  for owned_home in
    select home_id
    from public.home_members
    where user_id = p_user_id and role = 'owner'
  loop
    select id into next_owner_id
    from public.home_members
    where home_id = owned_home.home_id and user_id <> p_user_id
    order by joined_at asc
    limit 1;

    if next_owner_id is null then
      delete from public.homes where id = owned_home.home_id;
    else
      update public.home_members
      set role = 'owner'
      where id = next_owner_id;
    end if;
    next_owner_id := null;
  end loop;

  delete from public.chore_history where performed_by_user_id = p_user_id;
  delete from public.home_members where user_id = p_user_id;
  delete from public.app_users where id = p_user_id;
end;
$$;

revoke all on function public.delete_user_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_account(uuid) to service_role;

comment on function public.delete_user_account(uuid)
  is 'Deletes a user, their personal records, and sole-member homes; transfers shared-home ownership first.';
