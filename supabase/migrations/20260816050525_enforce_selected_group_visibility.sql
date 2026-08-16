begin;

create or replace function public.set_sock_visibility(
  visibility_mode public.sock_visibility_mode,
  group_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  if visibility_mode = 'selected_groups'
    and (
      cardinality(coalesce(group_ids, array[]::uuid[])) = 0
      or exists (
        select 1
        from unnest(coalesce(group_ids, array[]::uuid[])) as requested(group_id)
        where requested.group_id is null
      )
    ) then
    raise exception 'Select at least one group';
  end if;

  update public.sock_visibility_settings
  set mode = visibility_mode
  where user_id = caller;

  if not found then
    raise exception 'Visibility settings were not found';
  end if;

  delete from public.sock_visibility_groups
  where user_id = caller;

  if visibility_mode = 'selected_groups' then
    if (
      select count(distinct requested.group_id)
      from unnest(coalesce(group_ids, array[]::uuid[])) as requested(group_id)
    ) <> (
      select count(distinct membership.group_id)
      from public.group_members as membership
      where membership.user_id = caller
        and membership.group_id = any(coalesce(group_ids, array[]::uuid[]))
    ) then
      raise exception 'Selected group membership required';
    end if;

    insert into public.sock_visibility_groups (user_id, group_id)
    select caller, requested.group_id
    from unnest(coalesce(group_ids, array[]::uuid[])) as requested(group_id)
    join public.group_members as membership
      on membership.group_id = requested.group_id
     and membership.user_id = caller
    on conflict (user_id, group_id) do nothing;
  end if;
end;
$$;

revoke all on function public.set_sock_visibility(public.sock_visibility_mode, uuid[])
  from public, anon;
grant execute on function public.set_sock_visibility(public.sock_visibility_mode, uuid[])
  to authenticated;

commit;
