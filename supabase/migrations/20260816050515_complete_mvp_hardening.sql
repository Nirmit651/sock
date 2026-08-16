begin;

-- One installation can own one push-token row per account. Existing rows use their
-- row id as a stable backfill so this migration is safe on the live project.
alter table public.device_tokens
  add column installation_id uuid;

update public.device_tokens
set installation_id = id
where installation_id is null;

alter table public.device_tokens
  alter column installation_id set not null;

alter table public.device_tokens
  add constraint device_tokens_user_installation_unique
  unique (user_id, installation_id);

alter table public.notification_outbox
  add column processing_started_at timestamptz;

-- Every client listens only to its own row. The version says "refresh your feed"
-- without revealing which user, friendship, or group caused the change.
create table public.sock_feed_invalidations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint sock_feed_invalidations_version_nonnegative check (version >= 0)
);

insert into public.sock_feed_invalidations (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function private.create_sock_feed_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sock_feed_invalidations (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger profiles_create_sock_feed_invalidation
after insert on public.profiles
for each row execute function private.create_sock_feed_invalidation();

create or replace function private.bump_sock_feeds(target_users uuid[])
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.sock_feed_invalidations as invalidation
  set version = invalidation.version + 1,
      updated_at = clock_timestamp()
  where invalidation.user_id = any(coalesce(target_users, array[]::uuid[]));
$$;

create or replace function private.bump_sock_audience(
  sock_owner uuid,
  audience_mode public.sock_visibility_mode
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_users uuid[];
begin
  select coalesce(array_agg(distinct audience.user_id), array[]::uuid[])
  into target_users
  from (
    select sock_owner as user_id

    union all

    select case
      when friendship.requester_id = sock_owner then friendship.addressee_id
      else friendship.requester_id
    end
    from public.friendships as friendship
    where audience_mode = 'all_friends'
      and friendship.status = 'accepted'
      and sock_owner in (friendship.requester_id, friendship.addressee_id)

    union all

    select member.user_id
    from public.sock_visibility_groups as visibility_group
    join public.group_members as owner_member
      on owner_member.group_id = visibility_group.group_id
     and owner_member.user_id = sock_owner
    join public.group_members as member
      on member.group_id = visibility_group.group_id
    where audience_mode = 'selected_groups'
      and visibility_group.user_id = sock_owner
  ) as audience;

  perform private.bump_sock_feeds(target_users);
end;
$$;

create or replace function private.bump_feed_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sock_owner uuid;
  audience_mode public.sock_visibility_mode;
begin
  if tg_op = 'DELETE' then
    sock_owner := old.user_id;
  else
    sock_owner := new.user_id;
  end if;

  select mode into audience_mode
  from public.sock_visibility_settings
  where user_id = sock_owner;

  perform private.bump_sock_audience(sock_owner, coalesce(audience_mode, 'private'));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger sock_statuses_bump_feed
after insert or update or delete on public.sock_statuses
for each row execute function private.bump_feed_after_status_change();

create or replace function private.bump_feed_after_friendship_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.bump_sock_feeds(array[old.requester_id, old.addressee_id]);
    return old;
  end if;

  perform private.bump_sock_feeds(array[new.requester_id, new.addressee_id]);
  return new;
end;
$$;

create trigger friendships_bump_feed
after insert or update or delete on public.friendships
for each row execute function private.bump_feed_after_friendship_change();

create or replace function private.bump_feed_after_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
  previous_user uuid;
  next_user uuid;
  target_users uuid[];
begin
  if tg_op = 'INSERT' then
    target_group := new.group_id;
    next_user := new.user_id;
  elsif tg_op = 'DELETE' then
    target_group := old.group_id;
    previous_user := old.user_id;
  else
    target_group := new.group_id;
    previous_user := old.user_id;
    next_user := new.user_id;
  end if;

  select coalesce(array_agg(distinct affected.user_id), array[]::uuid[])
  into target_users
  from (
    select member.user_id
    from public.group_members as member
    where member.group_id = target_group
    union all select previous_user where previous_user is not null
    union all select next_user where next_user is not null
  ) as affected;

  perform private.bump_sock_feeds(target_users);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger group_members_bump_feed
after insert or update or delete on public.group_members
for each row execute function private.bump_feed_after_membership_change();

create or replace function private.bump_feed_after_visibility_setting_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.bump_sock_audience(new.user_id, old.mode);
  if new.mode <> old.mode then
    perform private.bump_sock_audience(new.user_id, new.mode);
  end if;
  return new;
end;
$$;

create trigger visibility_settings_bump_feed
after update on public.sock_visibility_settings
for each row execute function private.bump_feed_after_visibility_setting_change();

create or replace function private.bump_feed_after_visibility_group_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sock_owner uuid;
  target_group uuid;
  target_users uuid[];
begin
  if tg_op = 'DELETE' then
    sock_owner := old.user_id;
    target_group := old.group_id;
  else
    sock_owner := new.user_id;
    target_group := new.group_id;
  end if;

  select coalesce(array_agg(distinct affected.user_id), array[]::uuid[])
  into target_users
  from (
    select sock_owner as user_id
    union all
    select member.user_id
    from public.group_members as member
    where member.group_id = target_group
  ) as affected;

  perform private.bump_sock_feeds(target_users);
  perform private.bump_sock_audience(sock_owner, 'selected_groups');
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger visibility_groups_bump_feed
after insert or delete on public.sock_visibility_groups
for each row execute function private.bump_feed_after_visibility_group_change();

create or replace function private.guard_profile_avatar_path()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.avatar_path is not null
    and new.avatar_path !~ (
      '^' || new.id::text || '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$'
    ) then
    raise exception 'Avatar path must belong to the profile owner';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_avatar_path
before insert or update of avatar_path on public.profiles
for each row execute function private.guard_profile_avatar_path();

create or replace function private.bump_feed_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audience_mode public.sock_visibility_mode;
begin
  select mode into audience_mode
  from public.sock_visibility_settings
  where user_id = new.id;

  perform private.bump_sock_audience(new.id, coalesce(audience_mode, 'private'));
  return new;
end;
$$;

create trigger profiles_bump_feed
after update of username, display_name, avatar_path on public.profiles
for each row execute function private.bump_feed_after_profile_change();

create or replace function public.get_visible_active_profiles()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select profile.id, profile.username, profile.display_name, profile.avatar_path
  from public.sock_statuses as status
  join public.profiles as profile on profile.id = status.user_id
  where status.is_active
    and status.user_id <> (select auth.uid())
  order by profile.username;
$$;

create or replace function public.get_my_group_summaries()
returns table (
  id uuid,
  owner_id uuid,
  name text,
  created_at timestamptz,
  updated_at timestamptz,
  member_count bigint,
  active_count bigint,
  role public.group_role
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    target_group.id,
    target_group.owner_id,
    target_group.name,
    target_group.created_at,
    target_group.updated_at,
    count(member.user_id)::bigint as member_count,
    count(status.user_id) filter (where status.is_active)::bigint as active_count,
    mine.role
  from public.group_members as mine
  join public.groups as target_group on target_group.id = mine.group_id
  join public.group_members as member on member.group_id = target_group.id
  left join public.sock_statuses as status on status.user_id = member.user_id
  where mine.user_id = (select auth.uid())
  group by target_group.id, mine.role
  order by target_group.name;
$$;

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

create or replace function public.claim_sock_notification_batch(
  p_actor_id uuid,
  p_session_id uuid,
  p_batch_size integer default 200
)
returns table (outbox_id uuid, recipient_id uuid)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.sock_sessions as session
    where session.id = p_session_id
      and session.user_id = p_actor_id
      and session.ended_at is null
  ) then
    return;
  end if;

  update public.notification_outbox as outbox
  set sent_at = clock_timestamp(),
      processing_started_at = null,
      last_error = 'Recipient no longer authorized'
  where outbox.actor_id = p_actor_id
    and outbox.session_id = p_session_id
    and outbox.sent_at is null
    and not public.can_deliver_sock_notification(
      p_actor_id,
      outbox.recipient_id,
      p_session_id
    );

  return query
  with candidates as (
    select outbox.id
    from public.notification_outbox as outbox
    where outbox.actor_id = p_actor_id
      and outbox.session_id = p_session_id
      and outbox.sent_at is null
      and outbox.attempt_count < 5
      and (
        outbox.processing_started_at is null
        or outbox.processing_started_at < clock_timestamp() - interval '5 minutes'
      )
      and public.can_deliver_sock_notification(
        p_actor_id,
        outbox.recipient_id,
        p_session_id
      )
    order by outbox.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_batch_size, 200), 200))
  ),
  claimed as (
    update public.notification_outbox as outbox
    set attempt_count = outbox.attempt_count + 1,
        processing_started_at = clock_timestamp(),
        last_error = null
    from candidates
    where outbox.id = candidates.id
    returning outbox.id, outbox.recipient_id
  )
  select claimed.id, claimed.recipient_id
  from claimed;
end;
$$;

alter table public.sock_feed_invalidations enable row level security;

create policy sock_feed_invalidations_select_self
on public.sock_feed_invalidations for select to authenticated
using (user_id = (select auth.uid()));

revoke all on public.sock_feed_invalidations from public, anon, authenticated;
grant select on public.sock_feed_invalidations to authenticated;

revoke all on function public.get_visible_active_profiles() from public, anon;
revoke all on function public.get_my_group_summaries() from public, anon;
revoke all on function public.set_sock_visibility(public.sock_visibility_mode, uuid[])
  from public, anon;
revoke all on function public.claim_sock_notification_batch(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_visible_active_profiles() to authenticated;
grant execute on function public.get_my_group_summaries() to authenticated;
grant execute on function public.set_sock_visibility(public.sock_visibility_mode, uuid[])
  to authenticated;
grant execute on function public.claim_sock_notification_batch(uuid, uuid, integer)
  to service_role;

revoke all on function private.create_sock_feed_invalidation()
  from public, anon, authenticated;
revoke all on function private.bump_sock_feeds(uuid[])
  from public, anon, authenticated;
revoke all on function private.bump_sock_audience(uuid, public.sock_visibility_mode)
  from public, anon, authenticated;
revoke all on function private.bump_feed_after_status_change()
  from public, anon, authenticated;
revoke all on function private.bump_feed_after_friendship_change()
  from public, anon, authenticated;
revoke all on function private.bump_feed_after_membership_change()
  from public, anon, authenticated;
revoke all on function private.bump_feed_after_visibility_setting_change()
  from public, anon, authenticated;
revoke all on function private.bump_feed_after_visibility_group_change()
  from public, anon, authenticated;
revoke all on function private.guard_profile_avatar_path()
  from public, anon, authenticated;
revoke all on function private.bump_feed_after_profile_change()
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'sock_feed_invalidations'
    ) then
    alter publication supabase_realtime add table public.sock_feed_invalidations;
  end if;
end;
$$;

commit;
