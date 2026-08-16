begin;

alter table public.device_tokens
  drop constraint device_tokens_token_format;

alter table public.device_tokens
  add constraint device_tokens_token_format check (
    char_length(expo_push_token) between 20 and 255
    and expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'
  );

commit;
