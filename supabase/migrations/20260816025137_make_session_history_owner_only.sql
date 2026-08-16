begin;

drop policy if exists sock_sessions_select_owner_or_visible_active
  on public.sock_sessions;

create policy sock_sessions_select_owner_only
on public.sock_sessions for select to authenticated
using (user_id = (select auth.uid()));

commit;
