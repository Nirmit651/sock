begin;

create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-00000000000a', 'alice-rls@sock.test', '{"username":"alice_test"}', '{"provider":"email"}', now()),
  ('00000000-0000-0000-0000-00000000000b', 'bob-rls@sock.test', '{"username":"bob_test"}', '{"provider":"email"}', now()),
  ('00000000-0000-0000-0000-00000000000c', 'casey-rls@sock.test', '{"username":"casey_test"}', '{"provider":"email"}', now()),
  ('00000000-0000-0000-0000-00000000000d', 'drew-rls@sock.test', '{"username":"drew_test"}', '{"provider":"email"}', now());

select is(
  (select count(*)::integer from public.profiles where id::text like '00000000-0000-0000-0000-00000000000%'),
  4,
  'new auth users receive profiles automatically'
);
select is(
  (select count(*)::integer from public.sock_feed_invalidations where user_id::text like '00000000-0000-0000-0000-00000000000%'),
  4,
  'new profiles receive private feed invalidation rows'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sock_feed_invalidations'::regclass),
  'feed invalidations have RLS enabled'
);

insert into public.friendships (requester_id, addressee_id)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
update public.friendships
set status = 'accepted'
where user_low = '00000000-0000-0000-0000-00000000000a'
  and user_high = '00000000-0000-0000-0000-00000000000b';

insert into public.groups (id, owner_id, name)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000000a',
  'RLS Test Group'
);
insert into public.group_members (group_id, user_id, role, added_by)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000000b',
  'member',
  '00000000-0000-0000-0000-00000000000a'
);

update public.sock_visibility_settings
set mode = 'all_friends'
where user_id = '00000000-0000-0000-0000-00000000000a';
insert into public.sock_sessions (user_id)
values ('00000000-0000-0000-0000-00000000000a');
select is(
  (
    select count(*)::integer
    from public.notification_outbox
    where actor_id = '00000000-0000-0000-0000-00000000000a'
      and recipient_id = '00000000-0000-0000-0000-00000000000b'
      and session_id = (
        select id
        from public.sock_sessions
        where user_id = '00000000-0000-0000-0000-00000000000a' and ended_at is null
      )
      and event = 'sock_up'
  ),
  1,
  'putting a sock up queues a notification for an accepted friend'
);
update public.sock_sessions
set ended_at = now()
where user_id = '00000000-0000-0000-0000-00000000000a' and ended_at is null;
select is(
  (
    select count(*)::integer
    from public.notification_outbox
    where actor_id = '00000000-0000-0000-0000-00000000000a'
      and recipient_id = '00000000-0000-0000-0000-00000000000b'
      and event = 'sock_down'
      and session_id = (
        select id from public.sock_sessions
        where user_id = '00000000-0000-0000-0000-00000000000a'
        order by started_at desc limit 1
      )
  ),
  1,
  'taking a sock down queues a notification for an accepted friend'
);

update public.sock_visibility_settings
set mode = 'selected_groups'
where user_id = '00000000-0000-0000-0000-00000000000a';
insert into public.sock_visibility_groups (user_id, group_id)
values (
  '00000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-000000000001'
);
insert into public.sock_sessions (user_id)
values ('00000000-0000-0000-0000-00000000000a');
select is(
  (
    select count(*)::integer
    from public.notification_outbox
    where actor_id = '00000000-0000-0000-0000-00000000000a'
      and recipient_id = '00000000-0000-0000-0000-00000000000b'
      and session_id = (
        select id
        from public.sock_sessions
        where user_id = '00000000-0000-0000-0000-00000000000a' and ended_at is null
      )
      and event = 'sock_up'
  ),
  1,
  'putting a sock up queues a notification for a selected-group member'
);
update public.sock_sessions
set ended_at = now()
where user_id = '00000000-0000-0000-0000-00000000000a' and ended_at is null;
delete from public.sock_visibility_groups
where user_id = '00000000-0000-0000-0000-00000000000a';

update public.sock_visibility_settings
set mode = 'private'
where user_id = '00000000-0000-0000-0000-00000000000a';

insert into public.sock_sessions (user_id)
values ('00000000-0000-0000-0000-00000000000a');
insert into public.sock_sessions (user_id)
values ('00000000-0000-0000-0000-00000000000b');
update public.sock_sessions
set ended_at = now()
where user_id = '00000000-0000-0000-0000-00000000000b' and ended_at is null;

insert into public.device_tokens (user_id, installation_id, expo_push_token, platform)
values
  (
    '00000000-0000-0000-0000-00000000000a',
    '20000000-0000-4000-8000-000000000001',
    'ExpoPushToken[aaaaaaaaaaaaaaaaaaaaaaaa]',
    'ios'
  ),
  (
    '00000000-0000-0000-0000-00000000000a',
    '20000000-0000-4000-8000-000000000002',
    'ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbbbb]',
    'android'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'a user can read their own profile'
);
select is(
  (select count(*)::integer from public.search_profiles('bob')),
  1,
  'username search returns a limited matching profile'
);
select throws_ok(
  $$insert into public.friendships (requester_id, addressee_id)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c')$$,
  '42501',
  null,
  'friend requests must use the rate-limited RPC'
);
select is(
  (select count(*)::integer from public.sock_feed_invalidations),
  1,
  'a user can read only their own invalidation row'
);
update public.profiles set display_name = 'tampered'
where id = '00000000-0000-0000-0000-00000000000b';
select ok(
  (select display_name is distinct from 'tampered' from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'a user cannot update another profile'
);
select throws_ok(
  $$insert into public.sock_sessions (user_id) values ('00000000-0000-0000-0000-00000000000a')$$,
  '23505',
  null,
  'only one active session is allowed per user'
);
select throws_ok(
  $$select * from public.claim_sock_notification_batch(
    '00000000-0000-0000-0000-00000000000a',
    (select id from public.sock_sessions where user_id = '00000000-0000-0000-0000-00000000000a' and ended_at is null),
    'sock_up',
    10
  )$$,
  '42501',
  null,
  'authenticated users cannot claim backend notification work'
);
select throws_ok(
  $$select public.send_friend_request('00000000-0000-0000-0000-00000000000b')$$,
  '23505',
  null,
  'rate-limited friend-request RPC preserves unordered pair uniqueness'
);
select throws_ok(
  $$update public.profiles
    set avatar_path = '00000000-0000-0000-0000-00000000000b/not-owned.jpg'
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  'P0001',
  null,
  'profile avatar paths must stay in the owner folder'
);

delete from public.device_tokens
where user_id = '00000000-0000-0000-0000-00000000000a'
  and installation_id = '20000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.device_tokens),
  1,
  'logging out one installation preserves the other device token'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.sock_statuses where user_id = '00000000-0000-0000-0000-00000000000a' and is_active),
  0,
  'private active status is hidden from a friend'
);
select is(
  (select count(*)::integer from public.get_visible_active_profiles() where id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'the active-profile RPC respects private mode'
);
select is(
  (select count(*)::integer from public.sock_sessions where user_id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'all session rows remain owner-only'
);
update public.sock_sessions set ended_at = now()
where user_id = '00000000-0000-0000-0000-00000000000a' and ended_at is null;
reset role;
select is(
  (select count(*)::integer from public.sock_sessions
   where user_id = '00000000-0000-0000-0000-00000000000a' and ended_at is null),
  1,
  'a friend cannot end another user session'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (select count(*)::integer from public.device_tokens),
  0,
  'device tokens are private to their owner'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.groups where id = '10000000-0000-0000-0000-000000000001'),
  0,
  'a non-member cannot read a group'
);
select throws_ok(
  $$insert into public.group_members (group_id, user_id, role, added_by)
    values (
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-00000000000c',
      'member',
      '00000000-0000-0000-0000-00000000000c'
    )$$,
  '42501',
  null,
  'a non-member cannot add themselves to a group'
);
select throws_ok(
  $$select count(*) from public.notification_outbox$$,
  '42501',
  null,
  'the notification outbox is backend-only'
);

reset role;
update public.profiles
set group_stats_opt_in = false
where id = '00000000-0000-0000-0000-00000000000b';
update public.sock_visibility_settings
set mode = 'selected_groups'
where user_id = '00000000-0000-0000-0000-00000000000a';
insert into public.sock_visibility_groups (user_id, group_id)
values (
  '00000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-000000000001'
);

select ok(
  public.can_deliver_sock_notification(
    '00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000b',
    (select id from public.sock_sessions where user_id = '00000000-0000-0000-0000-00000000000a' and ended_at is null)
  ),
  'the backend delivery check honors the current selected-group audience'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.sock_statuses where user_id = '00000000-0000-0000-0000-00000000000a' and is_active),
  1,
  'a selected-group member sees the active boolean status'
);
select is(
  (select count(*)::integer from public.get_visible_active_profiles() where id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'the active-profile RPC returns an authorized active friend'
);
select is(
  (select count(*)::integer from public.sock_sessions where user_id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'selected-group access still does not expose session rows'
);
select is(
  (select count(*)::integer from public.get_my_group_summaries()),
  1,
  'group summaries return only the caller groups'
);
select is(
  (select active_count::integer from public.get_my_group_summaries() where id = '10000000-0000-0000-0000-000000000001'),
  1,
  'group summaries count only visible active statuses'
);
select ok(
  (select version > 0 from public.sock_feed_invalidations where user_id = '00000000-0000-0000-0000-00000000000b'),
  'privacy and status changes bump the viewer invalidation version'
);
select lives_ok(
  $$select public.set_sock_visibility('selected_groups', array['10000000-0000-0000-0000-000000000001']::uuid[])$$,
  'the atomic visibility RPC accepts groups the caller belongs to'
);
select throws_ok(
  $$select public.set_sock_visibility('selected_groups', array[]::uuid[])$$,
  'P0001',
  null,
  'selected-group visibility requires at least one group'
);
select throws_ok(
  $$select public.set_sock_visibility('selected_groups', array['10000000-0000-0000-0000-000000000099']::uuid[])$$,
  'P0001',
  null,
  'selected-group visibility rejects groups the caller has not joined'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_group_sock_wrapped('10000000-0000-0000-0000-000000000001') -> 'member_rankings'
    ) as ranking
    where ranking ->> 'user_id' = '00000000-0000-0000-0000-00000000000b'
  ),
  'group Wrapped excludes opted-out members'
);
delete from public.group_members
where group_id = '10000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-00000000000a';
reset role;
select ok(
  exists (
    select 1 from public.group_members
    where group_id = '10000000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-00000000000a'
  ),
  'a group owner cannot leave without deleting the group'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.sock_sessions (user_id)
values ('00000000-0000-0000-0000-00000000000d');
select ok(
  exists (
    select 1 from public.sock_statuses
    where user_id = '00000000-0000-0000-0000-00000000000d' and is_active
  ),
  'putting a sock up updates the boolean status projection'
);
update public.sock_sessions
set ended_at = now()
where user_id = '00000000-0000-0000-0000-00000000000d' and ended_at is null;
select ok(
  exists (
    select 1 from public.sock_statuses
    where user_id = '00000000-0000-0000-0000-00000000000d' and not is_active
  ),
  'taking a sock down updates the boolean status projection'
);

reset role;
select * from finish();
rollback;
