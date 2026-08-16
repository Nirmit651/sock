-- PostgREST evaluates the SELECT policy when returning an inserted row.
-- The owner-membership trigger runs after the group row is created, so the
-- owner must be readable directly as well as through group membership.
drop policy if exists groups_select_member on public.groups;

create policy groups_select_member
on public.groups for select to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_group_member(id, (select auth.uid()))
);
