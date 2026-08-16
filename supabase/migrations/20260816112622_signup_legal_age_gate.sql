begin;

-- These are server-side source-of-truth versions. The client submits a version
-- only to state which document it was presented; the Auth hook validates it.
create table private.legal_document_versions (
  singleton boolean primary key default true check (singleton),
  terms_version text not null,
  privacy_policy_version text not null,
  effective_on date not null,
  updated_at timestamptz not null default now()
);

insert into private.legal_document_versions (
  singleton,
  terms_version,
  privacy_policy_version,
  effective_on
)
values (true, '2026-08-16', '2026-08-16', date '2026-08-16');

revoke all on table private.legal_document_versions from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant select on table private.legal_document_versions to supabase_auth_admin;

alter table public.profiles
  add column age_eligibility_version text,
  add column age_eligibility_confirmed_at timestamptz,
  add column terms_version text,
  add column terms_accepted_at timestamptz,
  add column privacy_policy_version text,
  add column privacy_acknowledged_at timestamptz;

-- This hook runs before auth.users is inserted. It independently checks the
-- submitted DOB and server-defined document versions, so direct Auth API calls
-- cannot create an account by omitting the app's signup UI.
create or replace function public.enforce_signup_eligibility(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(event -> 'user' -> 'user_metadata', '{}'::jsonb);
  date_of_birth_text text := metadata ->> 'date_of_birth';
  date_of_birth date;
  versions private.legal_document_versions%rowtype;
begin
  select * into versions
  from private.legal_document_versions
  where singleton;

  if not found then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 500, 'message', 'Signup is temporarily unavailable.')
    );
  end if;

  if metadata ->> 'legal_agreement' <> 'true'
    or metadata ->> 'terms_version' is distinct from versions.terms_version
    or metadata ->> 'privacy_policy_version' is distinct from versions.privacy_policy_version then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Review and accept the Terms of Service and Privacy Policy to create an account.'
      )
    );
  end if;

  if date_of_birth_text is null or date_of_birth_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 400, 'message', 'Enter a valid date of birth.')
    );
  end if;

  begin
    date_of_birth := date_of_birth_text::date;
  exception when others then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 400, 'message', 'Enter a valid date of birth.')
    );
  end;

  if date_of_birth > current_date
    or date_of_birth + interval '13 years' > current_date then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'You aren''t eligible to create a Sock account.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.enforce_signup_eligibility(jsonb) to supabase_auth_admin;
revoke execute on function public.enforce_signup_eligibility(jsonb) from public, anon, authenticated;

-- Preserve legal evidence in the user profile, then remove the full DOB and
-- clickwrap helper fields from auth.users metadata. This leaves no full DOB in
-- the application's durable account records.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  chosen_display_name text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  date_of_birth_text text := new.raw_user_meta_data ->> 'date_of_birth';
  date_of_birth date;
  versions private.legal_document_versions%rowtype;
begin
  select * into versions
  from private.legal_document_versions
  where singleton;

  if not found
    or new.raw_user_meta_data ->> 'legal_agreement' <> 'true'
    or new.raw_user_meta_data ->> 'terms_version' is distinct from versions.terms_version
    or new.raw_user_meta_data ->> 'privacy_policy_version' is distinct from versions.privacy_policy_version then
    raise exception 'Required signup eligibility information is missing';
  end if;

  if chosen_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 characters using letters, numbers, or underscores';
  end if;

  -- Keep this check in the profile trigger as a second barrier in case the
  -- Auth hook is accidentally disabled. The rejected insert rolls back the
  -- entire Auth user creation transaction, so no child account is retained.
  if date_of_birth_text is null or date_of_birth_text !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'You are not eligible to create a Sock account';
  end if;

  begin
    date_of_birth := date_of_birth_text::date;
  exception when others then
    raise exception 'You are not eligible to create a Sock account';
  end;

  if date_of_birth > current_date
    or date_of_birth + interval '13 years' > current_date then
    raise exception 'You are not eligible to create a Sock account';
  end if;

  insert into public.profiles (
    id,
    username,
    display_name,
    age_eligibility_version,
    age_eligibility_confirmed_at,
    terms_version,
    terms_accepted_at,
    privacy_policy_version,
    privacy_acknowledged_at
  )
  values (
    new.id,
    chosen_username,
    chosen_display_name,
    '13-plus-v1',
    clock_timestamp(),
    versions.terms_version,
    clock_timestamp(),
    versions.privacy_policy_version,
    clock_timestamp()
  );

  insert into public.sock_visibility_settings (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.sock_statuses (user_id) values (new.id);

  update auth.users
  set raw_user_meta_data = raw_user_meta_data
    - 'date_of_birth'
    - 'legal_agreement'
    - 'terms_version'
    - 'privacy_policy_version'
  where id = new.id;

  return new;
end;
$$;

commit;
