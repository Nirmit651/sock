# Sock security review

Review date: 2026-08-16
Scope: Expo/React Native client, Supabase Auth/Postgres/Realtime/Storage, Edge Function, local orchestration, configuration, and production dependency graph.

## Executive summary

No critical application or database-policy finding remains open. The recovered migration history is aligned locally and in the live Supabase project, and the push function is active with platform JWT verification. The local pgTAP suite passes 38 adversarial assertions, while Jest passes 41 tests across 12 suites.

The live Supabase security advisor reports two warnings: leaked-password protection is disabled (a Free-plan limitation), and the intentionally callable `send_friend_request` rate-limit RPC uses `SECURITY DEFINER` to access its private limiter table. The RPC has a caller check, fixed search path, explicit grants, and no client write access to its underlying table. The production npm audit reports 23 upstream findings (8 moderate, 15 high) in Expo build tooling; Sock does not invoke the affected APIs at runtime, and npm's proposed force fix is an unsafe framework downgrade.

Local development was verified with only `db`, `auth`, `realtime`, `storage`, `rest`, and `kong` containers running. Signup returned an immediately confirmed session and those credentials successfully logged in, with no mail server or Edge runtime present. Client-side push registration and invocation are also fail-closed in local mode. Hosted Supabase email confirmation is enabled; successful signup is handled as a confirmation-pending state rather than an error.

## Remediated findings

### SEC-001 — Exact session history was visible to an authorized viewer (High, resolved)

- Location: `supabase/migrations/20260816025137_make_session_history_owner_only.sql:1-10`
- Risk: the original session SELECT policy allowed an authorized friend to read an active session row and its exact `started_at` timestamp.
- Resolution: every `sock_sessions` row is owner-only. Other authorized users receive only the current boolean `sock_statuses` projection. pgTAP separately verifies visible status and hidden history (`supabase/tests/rls_security.sql:147-176`, `234-247`).

### SEC-002 — Privacy changes could leave another client stale (High, resolved)

- Location: `supabase/migrations/20260816050515_complete_mvp_hardening.sql:22-270`, `491-545`; `src/hooks/use-sock-realtime.ts:13-38`
- Risk: a friendship, membership, visibility, or session change could leave an already-open client displaying a status it was no longer authorized to see.
- Resolution: trigger-maintained, per-viewer invalidation rows increment without identifying the changed actor. RLS exposes only the caller's row; Realtime updates invalidate all affected user-scoped queries. The live catalog confirms RLS and Realtime publication are enabled.

### SEC-003 — Logout could delete other-device tokens and retain sensitive cache data (High, resolved)

- Location: `supabase/migrations/20260816050515_complete_mvp_hardening.sql:3-17`; `src/lib/notifications.ts:20-70`; `src/providers/auth-provider.tsx:45-51`, `133-140`; `src/hooks/use-data.ts:27-41`
- Risk: account-wide token deletion broke other installations, while unscoped React Query data could survive a logout or account switch.
- Resolution: each installation receives a stable UUID and its own token row. Logout deletes only that installation, uses local-session signout, and clears the entire query cache. Every sensitive query key includes the current user ID. Jest and pgTAP verify both cache clearing and multi-device preservation.

### SEC-004 — Push delivery was race-prone and could become unauthorized before send (High, resolved)

- Location: `supabase/migrations/20260816050515_complete_mvp_hardening.sql:421-489`, `504-511`; `supabase/functions/push-sock-notification/index.ts:41-181`
- Risk: concurrent invocations could duplicate work, and queued recipients could become unauthorized after an audience change.
- Resolution: a service-role-only RPC rechecks the session state and current privacy policy, closes unauthorized rows, and atomically claims eligible rows with `FOR UPDATE SKIP LOCKED`. Delivery is batched to Expo and the payload identifies only the actor display name plus the event (`USER put a sock up` or `USER took their sock down`). Authenticated clients cannot execute the claim RPC. The deployed function is ACTIVE and rejects missing JWTs at the gateway with HTTP 401.

### SEC-005 — Avatar metadata did not enforce owner paths (Medium, resolved)

- Location: `supabase/migrations/20260816050515_complete_mvp_hardening.sql:272-291`; `src/services/api.ts:44-72`
- Risk: storage-object RLS protected file operations, but a profile could point its `avatar_path` at a malformed or foreign owner path.
- Resolution: a database trigger requires the profile UUID prefix and an allowed image extension. Uploads allow only JPEG, PNG, or WebP up to 5 MB, generate a UUID filename, and remove the new object if profile mutation fails.

### SEC-006 — Selected-group privacy accepted an empty audience (Medium, resolved)

- Location: `supabase/migrations/20260816050525_enforce_selected_group_visibility.sql:3-70`
- Risk: malformed clients could select no groups or groups they had not joined, creating confusing or unintended privacy state.
- Resolution: the atomic RPC rejects an empty/null selection and compares every requested group with caller membership before replacing the old selection. pgTAP covers valid, empty, and unauthorized inputs (`supabase/tests/rls_security.sql:263-278`).

### SEC-007 — Query failures appeared as legitimate empty data (Medium, resolved)

- Location: `src/components/ui/error-state.tsx:1-34`; `src/app/(tabs)/index.tsx:82-154`; `src/app/(tabs)/profile.tsx:121-250`
- Risk: a network or authorization failure could look like “no friends/groups/status,” inviting incorrect user actions.
- Resolution: loading, error, retry, and empty states are distinct. Sock mutation is unavailable when authoritative active-session state is unknown, and backend errors are mapped to safe user-facing messages rather than rendered verbatim.

### SEC-008 — Local development could contact production integrations (Medium, resolved)

- Location: `supabase/config.toml:92-148`, `218-261`, `323-389`; `scripts/dev.mjs:87-119`, `205-286`; `src/lib/runtime.ts:1-30`
- Risk: local testing could send confirmation email, register or invoke push, run a webhook/Edge callback, or accidentally point at hosted Supabase.
- Resolution: local accounts auto-confirm; Mailpit/SMTP, SMS, OAuth, webhooks, Edge runtime, analytics, push, and Expo network access/telemetry are disabled. The runner refuses non-loopback Supabase URLs, and runtime detection also treats any loopback URL as local. A real local signup smoke test passed without a mail service.

### SEC-009 — Username search enabled low-cost enumeration (Medium, resolved)

- Location: `supabase/migrations/20260816023742_harden_notifications_and_search.sql:3-67`; `supabase/migrations/20260816023901_fix_search_rate_limit_timestamp.sql:1-55`; `supabase/migrations/20260816075847_improve_profile_search_ranking.sql:1-75`
- Risk: unrestricted prefix search could enumerate usernames and profile metadata.
- Resolution: authenticated search accepts 3–60 normalized letters/numbers/spaces, returns at most ten rows, conditionally reveals avatars, ranks only text relevance (exact, prefix, then indexed trigram contains), and enforces 30 requests per user per rolling minute. The client debounces search-as-you-type requests by 350 ms; no user-activity or friend-based personalization is used.

### SEC-014 — Friend-request abuse (Medium, resolved)

- Location: `supabase/migrations/20260816075144_add_friend_request_rate_limit.sql:1-65`; `src/services/api.ts:162-166`
- Risk: direct client inserts could otherwise send unlimited friend requests and create notification/relationship spam.
- Resolution: friend requests now use a server-enforced security-definer RPC capped at 20 requests per user per rolling minute; direct authenticated INSERT access to `public.friendships` is revoked and the pgTAP suite verifies the boundary.

### SEC-010 — Confirmation-required signup was treated as a failure (Medium, resolved)

- Location: `src/services/auth.ts:14-60`; `src/app/(auth)/signup.tsx:25-50`; `src/app/(auth)/login.tsx:61-68`
- Risk: hosted Supabase correctly returns a user but no session when email confirmation is enabled. The prior app rejected that valid response, so users could not create accounts.
- Resolution: email confirmation remains enabled in the hosted project (`mailer_autoconfirm: false`). Signup now treats a returned user with no session as a successful confirmation-pending account and routes to a clear login-page message. The non-persisting signup client never stores a session during this flow; local Auth remains auto-confirmed and callback-free.

## Open operational findings

### SEC-011 — Leaked-password protection is unavailable on the current plan (Medium, accepted)

- Evidence: the post-deployment Supabase security advisor reports `auth_leaked_password_protection` as WARN.
- Exposure: users can choose passwords present in known breach corpora.
- Constraint: Supabase leaked-password protection requires a higher plan; the project is currently on Free.
- Recommendation: upgrade and enable the control before public launch. Until then, retain client/server minimum-strength rules and avoid suggesting reused passwords. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### SEC-015 — Friend-request limiter uses an intentional security-definer RPC (Low, accepted)

- Evidence: the Supabase security advisor warns that authenticated users can execute `public.send_friend_request(target_user_id uuid)`.
- Rationale: the endpoint must atomically write a private per-user rate-limit table before creating a friendship row, which cannot be expressed as a client table insert under RLS.
- Safeguards: it checks `auth.uid()`, validates the target, uses a fixed empty `search_path` with qualified references, is revoked from `PUBLIC` and `anon`, is granted only to `authenticated`, and direct client INSERT into `public.friendships` is revoked.
- Recommendation: retain the endpoint only while it remains the sole friend-request write path; rerun the advisor after any function or privilege change. See [Supabase database linter guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### SEC-012 — Upstream Expo build-tool advisories (High audit rating, constrained)

- Location: `package-lock.json`; dependency paths include Metro's `image-size` and Expo config tooling's `uuid`/`xcode` chain.
- Evidence: `npm audit` reports 23 findings: 8 moderate and 15 high, with no critical finding.
- Exposure: the affected packages run during trusted local/CI bundling and native-project generation; Sock does not call the vulnerable APIs in application business logic.
- Constraint: npm's force fix downgrades Expo 57 and React Native, while patched versions do not fit the upstream pinned ranges.
- Recommendation: keep build inputs trusted and CI isolated, then upgrade as soon as Expo ships a compatible dependency chain. Track [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), and [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

### SEC-013 — Web security headers depend on the future hosting layer (Low, resolved for Vercel)

- Location: static web output produced by `expo export`; no hosting configuration is present.
- Exposure: a web deployment without CSP, clickjacking protection, MIME sniffing protection, and a restrictive permissions policy has weaker browser hardening.
- Resolution: `vercel.json` configures `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy` for the Vercel deployment. A full CSP remains a follow-up because Expo's generated web runtime needs a reviewed allowlist for its scripts and Supabase WebSocket endpoint. This does not affect native iOS/Android builds.

## Verified controls

- Mobile sessions use `expo-secure-store` with bounded chunk counts and fail-closed recovery; the web app uses browser `localStorage` through Supabase's storage adapter so the authenticated session persists across a refresh.
- The client contains only a Supabase publishable key. Service credentials are read exclusively inside the hosted Edge runtime.
- All user-facing public tables use RLS; the outbox is backend-only and token rows are owner-only.
- Security-definer helpers use an empty `search_path` and explicit schema qualification. Public RPCs use security-invoker behavior; privileged notification claim execution is granted only to `service_role`.
- The schema enforces one active session per user, unordered friendship uniqueness, immutable session identity/timestamps, role constraints, visibility constraints, and foreign keys.
- The avatar bucket is private, with owner-folder mutation policies and viewer-aware read policy.
- Active scans found no `eval`, `new Function`, `dangerouslySetInnerHTML`, DOM injection sink, persistent web token storage, hard-coded secret, or client-side service-role use outside ignored dependencies/build output.
- `.env.local` is git-ignored; `.env.example` contains placeholders only.

## Verification record

- `npm run verify`: passed after the confirmation-flow adjustment (lint, TypeScript, 12 Jest suites / 41 tests).
- `npm run test:db`: passed (38 pgTAP assertions, rolled back), including friend-request authorization/rate limiting and notification outbox creation for both sock-up and sock-down events.
- `npm run export:all`: passed for Android, iOS, and static web.
- `npm run dev:local:check`: passed migrations, loopback connectivity, immediate confirmed signup, logout, and password login.
- Local Docker inventory: only Postgres, Auth, Realtime, Storage, PostgREST, and Kong were running.
- Live schema smoke check: new RPCs/columns/table present; invalidation RLS/publication enabled; authenticated claim privilege false; service-role claim privilege true.
- Live Edge smoke check: unauthenticated invocation returned HTTP 401 before function execution.
- Live advisors: one leaked-password warning and two informational unused-index notices (`notification_outbox_pending_idx`, `profiles_username_prefix_idx`). Those indexes serve expected production query paths and should be reevaluated after representative traffic.

## Release recommendations

1. Configure the hosted Auth Site URL and allowed redirect URLs to include the production Vercel URL before inviting users, so email confirmation returns to Sock.
2. Link the app to EAS and run push smoke tests on one physical iOS device and one physical Android device.
3. Complete a two-account live workflow: signup/login, friendship, group membership, each privacy mode, Sock up/down, live revocation, avatar, logout, and second-device retention.
4. Upgrade the Supabase plan and enable leaked-password protection before public launch.
5. Re-run the full verification, dependency audit, and Supabase advisors for every schema or dependency release.
