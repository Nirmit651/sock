begin;

create index group_members_added_by_idx
  on public.group_members (added_by)
  where added_by is not null;

create index groups_owner_id_idx
  on public.groups (owner_id);

create index notification_outbox_session_id_idx
  on public.notification_outbox (session_id);

-- The outbox is backend-only. This explicit policy documents and enforces that
-- authenticated clients cannot read or mutate queued push notification work.
create policy notification_outbox_backend_only
on public.notification_outbox
for all
to authenticated
using (false)
with check (false);

commit;
