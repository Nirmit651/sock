begin;

create table private.username_search_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null,
  constraint username_search_limits_nonnegative check (request_count >= 1)
);

revoke all on table private.username_search_limits from public, anon, authenticated;

create or replace function private.search_profiles_impl(caller uuid, search_term text)
returns table (id uuid, username text, display_name text, avatar_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized text := lower(trim(search_term));
  searches integer;
  current_time timestamptz := clock_timestamp();
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if char_length(normalized) < 3 or char_length(normalized) > 24
    or normalized !~ '^[a-z0-9_]+$' then
    raise exception 'Search with 3-24 username characters';
  end if;

  insert into private.username_search_limits as limits (user_id, window_started_at, request_count)
  values (caller, current_time, 1)
  on conflict (user_id) do update
  set request_count = case
        when limits.window_started_at < excluded.window_started_at - interval '1 minute' then 1
        else limits.request_count + 1
      end,
      window_started_at = case
        when limits.window_started_at < excluded.window_started_at - interval '1 minute'
          then excluded.window_started_at
        else limits.window_started_at
      end
  returning request_count into searches;

  if searches > 30 then
    raise exception 'Username search limit reached; try again shortly';
  end if;

  return query
  select p.id, p.username, p.display_name,
    case when private.can_view_profile(p.id, caller) then p.avatar_path else null end
  from public.profiles p
  where p.id <> caller and p.username like normalized || '%'
  order by p.username
  limit 10;
end;
$$;

create or replace function public.search_profiles(search_term text)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.search_profiles_impl((select auth.uid()), search_term);
$$;

create or replace function public.can_deliver_sock_notification(
  actor_id uuid,
  recipient_id uuid,
  session_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.sock_sessions session
    join public.notification_preferences preference on preference.user_id = recipient_id
    where session.id = session_id
      and session.user_id = actor_id
      and session.ended_at is null
      and preference.sock_up_enabled
      and private.can_view_sock(actor_id, recipient_id)
  );
$$;

revoke all on function public.can_deliver_sock_notification(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.can_deliver_sock_notification(uuid, uuid, uuid)
  to service_role;

commit;
