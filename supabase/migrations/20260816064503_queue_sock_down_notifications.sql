create or replace function private.sync_sock_status_and_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_event public.notification_event;
begin
  if tg_op = 'INSERT' then
    update public.sock_statuses
    set is_active = true, updated_at = now()
    where user_id = new.user_id;
    notification_event := 'sock_up';
  elsif old.ended_at is null and new.ended_at is not null then
    update public.sock_statuses
    set is_active = false, updated_at = now()
    where user_id = new.user_id;
    notification_event := 'sock_down';
  else
    return new;
  end if;

  insert into public.notification_outbox (actor_id, recipient_id, session_id, event)
  select new.user_id, recipients.user_id, new.id, notification_event
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

  return new;
end;
$$;

drop function public.can_deliver_sock_notification(uuid, uuid, uuid);
drop function public.claim_sock_notification_batch(uuid, uuid, integer);

create function public.can_deliver_sock_notification(
  actor_id uuid,
  recipient_id uuid,
  session_id uuid,
  notification_event public.notification_event default 'sock_up'
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
      and preference.sock_up_enabled
      and private.can_view_sock(actor_id, recipient_id)
      and (
        (notification_event = 'sock_up' and session.ended_at is null)
        or (notification_event = 'sock_down' and session.ended_at is not null)
      )
  );
$$;

create or replace function public.claim_sock_notification_batch(
  p_actor_id uuid,
  p_session_id uuid,
  p_event public.notification_event default 'sock_up',
  p_batch_size integer default 200
)
returns table(outbox_id uuid, recipient_id uuid, event public.notification_event)
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
      and (
        (p_event = 'sock_up' and session.ended_at is null)
        or (p_event = 'sock_down' and session.ended_at is not null)
      )
  ) then
    return;
  end if;

  update public.notification_outbox as outbox
  set sent_at = clock_timestamp(),
      processing_started_at = null,
      last_error = 'Recipient no longer authorized'
  where outbox.actor_id = p_actor_id
    and outbox.session_id = p_session_id
    and outbox.event = p_event
    and outbox.sent_at is null
    and not public.can_deliver_sock_notification(
      p_actor_id, outbox.recipient_id, p_session_id, p_event
    );

  return query
  with candidates as (
    select outbox.id
    from public.notification_outbox as outbox
    where outbox.actor_id = p_actor_id
      and outbox.session_id = p_session_id
      and outbox.event = p_event
      and outbox.sent_at is null
      and outbox.attempt_count < 5
      and (
        outbox.processing_started_at is null
        or outbox.processing_started_at < clock_timestamp() - interval '5 minutes'
      )
      and public.can_deliver_sock_notification(
        p_actor_id, outbox.recipient_id, p_session_id, p_event
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
    returning outbox.id, outbox.recipient_id, outbox.event
  )
  select claimed.id, claimed.recipient_id, claimed.event
  from claimed;
end;
$$;

revoke all on function public.can_deliver_sock_notification(uuid, uuid, uuid, public.notification_event)
  from public, anon, authenticated;
grant execute on function public.can_deliver_sock_notification(uuid, uuid, uuid, public.notification_event)
  to service_role;
revoke all on function public.claim_sock_notification_batch(uuid, uuid, public.notification_event, integer)
  from public, anon, authenticated;
grant execute on function public.claim_sock_notification_batch(uuid, uuid, public.notification_event, integer)
  to service_role;
