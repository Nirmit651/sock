begin;

create extension if not exists pg_trgm with schema extensions;

create index if not exists profiles_search_text_trgm_idx
  on public.profiles using gin (
    (lower(username || ' ' || coalesce(display_name, ''))) extensions.gin_trgm_ops
  );

create or replace function private.search_profiles_impl(caller uuid, search_term text)
returns table (id uuid, username text, display_name text, avatar_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized text := regexp_replace(lower(trim(search_term)), '\s+', ' ', 'g');
  escaped text := replace(replace(normalized, '\\', '\\\\'), '_', '\\_');
  searches integer;
  request_time timestamptz := clock_timestamp();
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if char_length(normalized) < 3 or char_length(normalized) > 60
    or normalized !~ '^[a-z0-9_ ]+$' then
    raise exception 'Search with 3-60 letters, numbers, spaces, or underscores';
  end if;

  insert into private.username_search_limits as limits (user_id, window_started_at, request_count)
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
  returning request_count into searches;

  if searches > 30 then
    raise exception 'Username search limit reached; try again shortly';
  end if;

  return query
  select p.id, p.username, p.display_name,
    case when private.can_view_profile(p.id, caller) then p.avatar_path else null end
  from public.profiles p
  where p.id <> caller
    and (
      p.username like escaped || '%'
      or lower(coalesce(p.display_name, '')) like escaped || '%'
      or lower(p.username || ' ' || coalesce(p.display_name, '')) like '%' || escaped || '%'
    )
  order by
    case
      when p.username = normalized then 0
      when p.username like escaped || '%' then 1
      when lower(coalesce(p.display_name, '')) = normalized then 2
      when lower(coalesce(p.display_name, '')) like escaped || '%' then 3
      else 4
    end,
    p.username
  limit 10;
end;
$$;

commit;
