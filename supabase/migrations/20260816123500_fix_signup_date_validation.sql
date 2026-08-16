begin;

-- Correct the date format expression in the initial age-gate migration. A
-- numeric character class avoids regex escape interpretation differences.
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

  if date_of_birth_text is null or date_of_birth_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
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
