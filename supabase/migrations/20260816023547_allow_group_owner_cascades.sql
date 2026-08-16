begin;

create or replace function private.guard_group_member_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Direct owner-row deletion remains blocked by the RLS delete policy. Allow
  -- cascades here so deleting a group/account can clean up membership rows.
  if tg_op = 'DELETE' then
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

commit;
