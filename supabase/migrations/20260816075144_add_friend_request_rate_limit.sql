begin;

create table private.friend_request_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1)
);

revoke all on table private.friend_request_limits from public, anon, authenticated;

create or replace function public.send_friend_request(target_user_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  request_time timestamptz := clock_timestamp();
  requests integer;
  friendship_id uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if target_user_id is null or target_user_id = caller then
    raise exception 'Choose another user';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'User was not found';
  end if;

  insert into private.friend_request_limits as limits (user_id, window_started_at, request_count)
  values (caller, request_time, 1)
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
  returning request_count into requests;

  if requests > 20 then
    raise exception 'Friend request limit reached; try again shortly';
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (caller, target_user_id)
  returning id into friendship_id;

  return friendship_id;
end;
$$;

revoke all on function public.send_friend_request(uuid) from public, anon, authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
revoke insert on public.friendships from authenticated;

commit;
