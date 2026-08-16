begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.friendship_status as enum ('pending', 'accepted');
create type public.group_role as enum ('owner', 'admin', 'member');
create type public.sock_visibility_mode as enum ('all_friends', 'selected_groups', 'private');
create type public.notification_event as enum ('sock_up');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_path text,
  group_stats_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username = lower(username)
    and username ~ '^[a-z0-9_]{3,24}$'
  ),
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 60
  ),
  constraint profiles_avatar_path_length check (
    avatar_path is null or char_length(avatar_path) <= 300
  )
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  user_low uuid generated always as (least(requester_id, addressee_id)) stored,
  user_high uuid generated always as (greatest(requester_id, addressee_id)) stored,
  status public.friendship_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_pair_unique unique (user_low, user_high),
  constraint friendships_response_consistency check (
    (status = 'pending' and responded_at is null)
    or (status = 'accepted' and responded_at is not null)
  )
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_length check (char_length(trim(name)) between 1 and 50)
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.group_role not null default 'member',
  added_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.sock_visibility_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mode public.sock_visibility_mode not null default 'all_friends',
  updated_at timestamptz not null default now()
);

create table public.sock_visibility_groups (
  user_id uuid not null references public.sock_visibility_settings(user_id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

create table public.sock_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sock_sessions_valid_duration check (ended_at is null or ended_at >= started_at)
);

create unique index sock_sessions_one_active_per_user
  on public.sock_sessions(user_id)
  where ended_at is null;

create table public.sock_statuses (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sock_up_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_tokens_platform check (platform in ('ios', 'android')),
  constraint device_tokens_token_format check (
    char_length(expo_push_token) between 20 and 255
    and expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\\[[^]]+\\]$'
  )
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sock_sessions(id) on delete cascade,
  event public.notification_event not null,
  sent_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  constraint notification_outbox_not_self check (actor_id <> recipient_id),
  constraint notification_outbox_attempts check (attempt_count between 0 and 10),
  constraint notification_outbox_unique_event unique (recipient_id, session_id, event)
);

create index profiles_username_prefix_idx
  on public.profiles (lower(username) text_pattern_ops);
create index friendships_requester_status_idx
  on public.friendships (requester_id, status);
create index friendships_addressee_status_idx
  on public.friendships (addressee_id, status);
create index group_members_user_idx
  on public.group_members (user_id, group_id);
create index sock_visibility_groups_group_idx
  on public.sock_visibility_groups (group_id, user_id);
create index sock_sessions_user_started_idx
  on public.sock_sessions (user_id, started_at desc);
create index sock_statuses_active_idx
  on public.sock_statuses (user_id)
  where is_active;
create index device_tokens_user_idx
  on public.device_tokens (user_id);
create index notification_outbox_pending_idx
  on public.notification_outbox (actor_id, session_id, created_at)
  where sent_at is null;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger groups_touch_updated_at
before update on public.groups
for each row execute function private.touch_updated_at();
create trigger visibility_touch_updated_at
before update on public.sock_visibility_settings
for each row execute function private.touch_updated_at();
create trigger preferences_touch_updated_at
before update on public.notification_preferences
for each row execute function private.touch_updated_at();
create trigger device_tokens_touch_updated_at
before update on public.device_tokens
for each row execute function private.touch_updated_at();

create or replace function private.guard_friendship_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.id := gen_random_uuid();
    new.status := 'pending';
    new.responded_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id <> old.id
    or new.requester_id <> old.requester_id
    or new.addressee_id <> old.addressee_id
    or new.created_at <> old.created_at then
    raise exception 'Friendship participants are immutable';
  end if;

  if old.status <> 'pending' or new.status <> 'accepted' then
    raise exception 'Invalid friendship status transition';
  end if;

  new.responded_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger friendships_guard_write
before insert or update on public.friendships
for each row execute function private.guard_friendship_write();

create or replace function private.guard_group_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id <> old.id or new.owner_id <> old.owner_id or new.created_at <> old.created_at then
    raise exception 'Group identity and ownership are immutable';
  end if;
  new.name := trim(new.name);
  return new;
end;
$$;

create trigger groups_guard_write
before update on public.groups
for each row execute function private.guard_group_write();

create or replace function private.add_group_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role, added_by)
  values (new.id, new.owner_id, 'owner', new.owner_id);
  return new;
end;
$$;

create trigger groups_add_owner
after insert on public.groups
for each row execute function private.add_group_owner();

create or replace function private.guard_group_member_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      raise exception 'The group owner cannot leave; delete the group instead';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.group_id <> old.group_id or new.user_id <> old.user_id or new.joined_at <> old.joined_at then
      raise exception 'Group membership identity is immutable';
    end if;
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'Ownership cannot be changed through group membership';
    end if;
  end if;

  return new;
end;
$$;

create trigger group_members_guard_write
before update or delete on public.group_members
for each row execute function private.guard_group_member_write();

create or replace function private.normalize_sock_session()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.id := gen_random_uuid();
    new.started_at := now();
    new.ended_at := null;
    new.created_at := now();
    return new;
  end if;

  if new.id <> old.id
    or new.user_id <> old.user_id
    or new.started_at <> old.started_at
    or new.created_at <> old.created_at then
    raise exception 'Sock session identity and start time are immutable';
  end if;

  if old.ended_at is not null then
    raise exception 'A completed sock session cannot be changed';
  end if;

  new.ended_at := greatest(now(), old.started_at);
  return new;
end;
$$;

create trigger sock_sessions_normalize
before insert or update on public.sock_sessions
for each row execute function private.normalize_sock_session();

create or replace function private.are_friends(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and f.user_low = least(user_a, user_b)
      and f.user_high = greatest(user_a, user_b)
  );
$$;

create or replace function private.is_group_member(target_group uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group and gm.user_id = target_user
  );
$$;

create or replace function private.is_group_admin(target_group uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group
      and gm.user_id = target_user
      and gm.role in ('owner', 'admin')
  );
$$;

create or replace function private.is_group_owner(target_group uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g
    where g.id = target_group and g.owner_id = target_user
  );
$$;

create or replace function private.can_view_profile(profile_owner uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select profile_owner = viewer
    or exists (
      select 1 from public.friendships f
      where f.user_low = least(profile_owner, viewer)
        and f.user_high = greatest(profile_owner, viewer)
    )
    or exists (
      select 1
      from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = viewer and theirs.user_id = profile_owner
    );
$$;

create or replace function private.can_view_sock(sock_owner uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select sock_owner = viewer
    or exists (
      select 1
      from public.sock_visibility_settings s
      where s.user_id = sock_owner
        and (
          (s.mode = 'all_friends' and private.are_friends(sock_owner, viewer))
          or (
            s.mode = 'selected_groups'
            and exists (
              select 1
              from public.sock_visibility_groups vg
              join public.group_members owner_member
                on owner_member.group_id = vg.group_id and owner_member.user_id = sock_owner
              join public.group_members viewer_member
                on viewer_member.group_id = vg.group_id and viewer_member.user_id = viewer
              where vg.user_id = sock_owner
            )
          )
        )
    );
$$;

create or replace function private.can_view_avatar(owner_folder text, viewer uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if owner_folder is null or owner_folder !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  return private.can_view_profile(owner_folder::uuid, viewer);
exception when invalid_text_representation then
  return false;
end;
$$;

create or replace function private.sync_sock_status_and_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.sock_statuses
    set is_active = true, updated_at = now()
    where user_id = new.user_id;

    insert into public.notification_outbox (actor_id, recipient_id, session_id, event)
    select new.user_id, recipients.user_id, new.id, 'sock_up'
    from (
      select case
        when f.requester_id = new.user_id then f.addressee_id
        else f.requester_id
      end as user_id
      from public.friendships f
      join public.sock_visibility_settings s on s.user_id = new.user_id
      where s.mode = 'all_friends'
        and f.status = 'accepted'
        and (f.requester_id = new.user_id or f.addressee_id = new.user_id)

      union

      select gm.user_id
      from public.sock_visibility_groups vg
      join public.sock_visibility_settings s
        on s.user_id = vg.user_id and s.mode = 'selected_groups'
      join public.group_members owner_member
        on owner_member.group_id = vg.group_id and owner_member.user_id = new.user_id
      join public.group_members gm on gm.group_id = vg.group_id
      where vg.user_id = new.user_id and gm.user_id <> new.user_id
    ) recipients
    join public.notification_preferences np on np.user_id = recipients.user_id
    where np.sock_up_enabled
    on conflict (recipient_id, session_id, event) do nothing;
  elsif old.ended_at is null and new.ended_at is not null then
    update public.sock_statuses
    set is_active = false, updated_at = now()
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

create trigger sock_sessions_sync_status
after insert or update on public.sock_sessions
for each row execute function private.sync_sock_status_and_notifications();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  chosen_display_name text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  if chosen_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 characters using letters, numbers, or underscores';
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, chosen_username, chosen_display_name);

  insert into public.sock_visibility_settings (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.sock_statuses (user_id) values (new.id);
  return new;
end;
$$;

create trigger auth_user_created_create_sock_profile
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.search_profiles_impl(caller uuid, search_term text)
returns table (id uuid, username text, display_name text, avatar_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized text := lower(trim(search_term));
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if char_length(normalized) < 3 or char_length(normalized) > 24
    or normalized !~ '^[a-z0-9_]+$' then
    raise exception 'Search with 3-24 username characters';
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
stable
security invoker
set search_path = ''
as $$
  select * from private.search_profiles_impl((select auth.uid()), search_term);
$$;

create or replace function public.get_my_sock_wrapped()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive completed as (
    select
      s.started_at,
      s.ended_at,
      extract(epoch from (s.ended_at - s.started_at))::bigint as seconds,
      (s.started_at at time zone 'UTC')::date as active_day
    from public.sock_sessions s
    where s.user_id = (select auth.uid()) and s.ended_at is not null
  ),
  days as (
    select distinct active_day from completed
  ),
  recent as (
    select max(active_day) as last_day from days
  ),
  streak(day, count) as (
    select last_day, 1
    from recent
    where last_day >= (current_date - 1)
    union all
    select streak.day - 1, streak.count + 1
    from streak
    where exists (select 1 from days where active_day = streak.day - 1)
  )
  select jsonb_build_object(
    'session_count', count(*),
    'total_seconds', coalesce(sum(seconds), 0),
    'average_seconds', coalesce(round(avg(seconds)), 0),
    'longest_seconds', coalesce(max(seconds), 0),
    'favorite_weekday', coalesce((
      select trim(to_char((started_at at time zone 'UTC'), 'Day'))
      from completed
      group by 1 order by count(*) desc, 1 limit 1
    ), '—'),
    'favorite_time_range', coalesce((
      select case
        when extract(hour from started_at at time zone 'UTC') < 6 then 'Late night'
        when extract(hour from started_at at time zone 'UTC') < 12 then 'Morning'
        when extract(hour from started_at at time zone 'UTC') < 18 then 'Afternoon'
        else 'Evening'
      end
      from completed
      group by 1 order by count(*) desc, 1 limit 1
    ), '—'),
    'most_active_month', coalesce((
      select to_char(date_trunc('month', started_at at time zone 'UTC'), 'Mon YYYY')
      from completed
      group by 1 order by count(*) desc, 1 desc limit 1
    ), '—'),
    'current_streak', coalesce((select max(count) from streak), 0)
  )
  from completed;
$$;

create or replace function private.get_group_sock_wrapped_impl(caller uuid, target_group uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if caller is null or not private.is_group_member(target_group, caller) then
    raise exception 'Group membership required';
  end if;

  with eligible as (
    select p.id, p.username, p.display_name
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    where gm.group_id = target_group and p.group_stats_opt_in
  ),
  totals as (
    select
      e.id,
      e.username,
      e.display_name,
      count(s.id)::bigint as session_count,
      coalesce(sum(extract(epoch from (s.ended_at - s.started_at))), 0)::bigint as total_seconds
    from eligible e
    left join public.sock_sessions s on s.user_id = e.id and s.ended_at is not null
    group by e.id, e.username, e.display_name
  )
  select jsonb_build_object(
    'group_total_sessions', coalesce(sum(session_count), 0),
    'group_total_seconds', coalesce(sum(total_seconds), 0),
    'member_rankings', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', id,
          'username', username,
          'display_name', display_name,
          'session_count', session_count,
          'total_seconds', total_seconds
        ) order by session_count desc, total_seconds desc, username
      ),
      '[]'::jsonb
    )
  ) into result
  from totals;

  return coalesce(result, jsonb_build_object(
    'group_total_sessions', 0,
    'group_total_seconds', 0,
    'member_rankings', '[]'::jsonb
  ));
end;
$$;

create or replace function public.get_group_sock_wrapped(group_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_group_sock_wrapped_impl((select auth.uid()), group_id);
$$;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.sock_visibility_settings enable row level security;
alter table public.sock_visibility_groups enable row level security;
alter table public.sock_sessions enable row level security;
alter table public.sock_statuses enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.device_tokens enable row level security;
alter table public.notification_outbox enable row level security;

create policy profiles_select_visible
on public.profiles for select to authenticated
using (private.can_view_profile(id, (select auth.uid())));

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy friendships_select_participant
on public.friendships for select to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));

create policy friendships_insert_requester
on public.friendships for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and addressee_id <> (select auth.uid())
  and status = 'pending'
);

create policy friendships_accept_addressee
on public.friendships for update to authenticated
using (addressee_id = (select auth.uid()) and status = 'pending')
with check (addressee_id = (select auth.uid()) and status = 'accepted');

create policy friendships_delete_participant
on public.friendships for delete to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));

create policy groups_select_member
on public.groups for select to authenticated
using (private.is_group_member(id, (select auth.uid())));

create policy groups_insert_owner
on public.groups for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy groups_update_admin
on public.groups for update to authenticated
using (private.is_group_admin(id, (select auth.uid())))
with check (private.is_group_admin(id, (select auth.uid())));

create policy groups_delete_owner
on public.groups for delete to authenticated
using (owner_id = (select auth.uid()));

create policy group_members_select_member
on public.group_members for select to authenticated
using (private.is_group_member(group_id, (select auth.uid())));

create policy group_members_insert_admin
on public.group_members for insert to authenticated
with check (
  private.is_group_admin(group_id, (select auth.uid()))
  and private.are_friends((select auth.uid()), user_id)
  and role in ('admin', 'member')
  and added_by = (select auth.uid())
);

create policy group_members_update_owner
on public.group_members for update to authenticated
using (private.is_group_owner(group_id, (select auth.uid())) and role <> 'owner')
with check (
  private.is_group_owner(group_id, (select auth.uid()))
  and role in ('admin', 'member')
);

create policy group_members_delete_self_or_admin
on public.group_members for delete to authenticated
using (
  role <> 'owner'
  and (
    user_id = (select auth.uid())
    or private.is_group_admin(group_id, (select auth.uid()))
  )
);

create policy visibility_settings_select_self
on public.sock_visibility_settings for select to authenticated
using (user_id = (select auth.uid()));

create policy visibility_settings_insert_self
on public.sock_visibility_settings for insert to authenticated
with check (user_id = (select auth.uid()));

create policy visibility_settings_update_self
on public.sock_visibility_settings for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy visibility_groups_select_self
on public.sock_visibility_groups for select to authenticated
using (user_id = (select auth.uid()));

create policy visibility_groups_insert_self_member
on public.sock_visibility_groups for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_group_member(group_id, (select auth.uid()))
);

create policy visibility_groups_delete_self
on public.sock_visibility_groups for delete to authenticated
using (user_id = (select auth.uid()));

create policy sock_sessions_select_owner_or_visible_active
on public.sock_sessions for select to authenticated
using (
  user_id = (select auth.uid())
  or (ended_at is null and private.can_view_sock(user_id, (select auth.uid())))
);

create policy sock_sessions_insert_self
on public.sock_sessions for insert to authenticated
with check (user_id = (select auth.uid()) and ended_at is null);

create policy sock_sessions_end_self
on public.sock_sessions for update to authenticated
using (user_id = (select auth.uid()) and ended_at is null)
with check (user_id = (select auth.uid()) and ended_at is not null);

create policy sock_statuses_select_visible
on public.sock_statuses for select to authenticated
using (private.can_view_sock(user_id, (select auth.uid())));

create policy notification_preferences_select_self
on public.notification_preferences for select to authenticated
using (user_id = (select auth.uid()));

create policy notification_preferences_update_self
on public.notification_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy device_tokens_select_self
on public.device_tokens for select to authenticated
using (user_id = (select auth.uid()));

create policy device_tokens_insert_self
on public.device_tokens for insert to authenticated
with check (user_id = (select auth.uid()));

create policy device_tokens_update_self
on public.device_tokens for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy device_tokens_delete_self
on public.device_tokens for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select, insert, update on public.sock_visibility_settings to authenticated;
grant select, insert, delete on public.sock_visibility_groups to authenticated;
grant select, insert, update on public.sock_sessions to authenticated;
grant select on public.sock_statuses to authenticated;
grant select, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.device_tokens to authenticated;

revoke all on function public.search_profiles(text) from public, anon;
revoke all on function public.get_my_sock_wrapped() from public, anon;
revoke all on function public.get_group_sock_wrapped(uuid) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.get_my_sock_wrapped() to authenticated;
grant execute on function public.get_group_sock_wrapped(uuid) to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.are_friends(uuid, uuid) to authenticated;
grant execute on function private.is_group_member(uuid, uuid) to authenticated;
grant execute on function private.is_group_admin(uuid, uuid) to authenticated;
grant execute on function private.is_group_owner(uuid, uuid) to authenticated;
grant execute on function private.can_view_profile(uuid, uuid) to authenticated;
grant execute on function private.can_view_sock(uuid, uuid) to authenticated;
grant execute on function private.can_view_avatar(text, uuid) to authenticated;
grant execute on function private.search_profiles_impl(uuid, text) to authenticated;
grant execute on function private.get_group_sock_wrapped_impl(uuid, uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_select_visible_profiles
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and private.can_view_avatar((storage.foldername(name))[1], (select auth.uid()))
);

create policy avatars_insert_own_folder
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy avatars_update_own_folder
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy avatars_delete_own_folder
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'sock_statuses'
    ) then
    alter publication supabase_realtime add table public.sock_statuses;
  end if;
end;
$$;

commit;
