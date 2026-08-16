# Sock

Sock is a mobile status app for trusted friends and groups. A user can put a sock up, share that live state with the audience they chose, and later see private or aggregated usage statistics without exposing exact session history to other users.

The MVP is built with Expo SDK 57, React Native, TypeScript, Expo Router, TanStack Query, and Supabase Auth, Postgres, Realtime, Storage, and Edge Functions.

## What is implemented

- Email/password signup, login, protected routes, encrypted mobile session storage, and logout cleanup
- Unique usernames, display names, and private avatar storage
- Debounced, text-ranked friend search (exact username, prefix, display name, then indexed partial matches) and pending/accepted request workflows
- Groups, roles, membership management, group activity, and group Wrapped rankings
- Server-authoritative sock up/down sessions with live friend updates over Supabase Realtime on web, Android, and iOS
- `all_friends`, `selected_groups`, and `private` visibility modes enforced in Postgres RLS
- Personal Wrapped statistics and opt-in aggregated group statistics
- Per-device push-token registration and a privacy-rechecking, batch notification sender
- Loading, empty, recoverable error, and offline states; accessible controls; keyboard-safe forms

## Local setup

Requirements: Node.js 20+, npm, and an iOS simulator, Android emulator, or physical device.

```bash
npm ci
cp .env.example .env.local
npm run verify
npm run dev
```

`npm run dev` checks the hosted Supabase backend and starts Expo against it. Use an Expo development build for native notification testing; Expo Go does not support remote push notifications for this SDK.

Hosted Supabase email confirmation is enabled. A successful hosted signup returns to the login page and asks the person to confirm their email before logging in; validation and Supabase failures stay visible on the signup form. Local development deliberately remains auto-confirmed with no email delivery, so tests and seeded accounts are ready immediately.

On the web, Supabase Auth stores its refreshable session in browser `localStorage`, so refreshing Chrome keeps the user signed in until they log out or the session expires. Realtime subscriptions invalidate the active-friends and group queries whenever a visible sock status changes, so web users see updates without refreshing.

For a fully local frontend and backend, start Docker Desktop (or another Docker-compatible runtime), then run:

```bash
npm run dev:local
```

Local mode starts only the services the app needs: Postgres, Auth, Realtime, Storage, the API gateway, and PostgREST. It excludes Studio, Mailpit, analytics, vector services, image transforms, the pooler, and Edge Functions. Email/password accounts are confirmed immediately; no confirmation email is generated. SMS, OAuth, webhooks, push permissions, push registration, push delivery, Expo network access/telemetry, and all other external callbacks are disabled. The runner applies pending migrations, injects temporary local credentials without writing them to disk, preserves database data, and stops containers it started when Expo exits.

Local mode is best suited to web and simulators because physical devices cannot reach a host's `127.0.0.1` services without additional network configuration.

To populate the local database with demo data, run `npm run seed:local`. It creates or reuses three confirmed accounts (`alice@sock.test`, `ben@sock.test`, and `chloe@sock.test`), two groups, accepted friendships, memberships, and an active sock for Ben. All three accounts use `SockTest123!`. The seed is local-only, repeatable, preserves other database data, and never writes credentials into the frontend or `.env.local`.

Useful variations:

```bash
npm run frontend              # Expo using .env.local
npm run backend:local         # leave the local backend running
npm run seed:local            # add repeatable local demo accounts/groups
npm run dev:local:check       # migrations + real signup/login smoke check
npm run test:db               # pgTAP RLS/privacy suite
npm run dev -- --web          # hosted backend + web
npm run dev -- --check        # hosted backend health check only
npm run deploy:vercel         # export web + deploy a Vercel preview
npm run deploy:vercel:prod    # export web + deploy the production Vercel site
```

Set these values in `.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-uuid
```

The checked-out workspace already has a git-ignored Supabase URL and publishable key for the provisioned Sock project. The EAS project is linked in `app.config.js` and `eas.json`; run `npx eas-cli@latest build --profile development --platform android` or `--platform ios` to create a native development build before testing push notifications on a physical device.

## Supabase

The connected project is `kodrnyuuoqilvklawhyg` in `us-east-2`. Its schema is reproducible from [supabase/migrations](./supabase/migrations), and the generated client types are in [src/types/database.ts](./src/types/database.ts).

To apply the schema to another project:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

The checked-in migration history is aligned with the linked project. RLS protects every user-facing table, all session rows are owner-only, notification tokens/outbox rows are private, and Realtime exposes a per-viewer invalidation row without identifying who changed. The pgTAP adversarial suite is at [supabase/tests/rls_security.sql](./supabase/tests/rls_security.sql).

### Push function

The sender at [supabase/functions/push-sock-notification](./supabase/functions/push-sock-notification) is deployed and active on the connected project with JWT verification enabled. It revalidates the current audience, atomically claims pending outbox rows, batches Expo requests, supports multiple devices per account, and removes tokens Expo reports as unregistered. Mobile notifications say `USER put a sock up` or `USER took their sock down`; web clients receive the same change immediately through Realtime.

To redeploy it after a source change:

```bash
npx supabase functions deploy push-sock-notification --project-ref kodrnyuuoqilvklawhyg
```

The function requires JWT verification. Supabase supplies `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, and `SUPABASE_SECRET_KEYS`; the code retains temporary legacy-key fallback for existing deployments. `EXPO_ACCESS_TOKEN` is optional when Expo push access security is enabled. Deploy the function after applying the latest migrations so the `sock_down` event is available remotely.

## Verification

```bash
npm run verify
npm run verify:full
npm run audit:production
```

`npm run export:all` produces verified Android, iOS, and static web bundles in `dist/verify`. Open the web build with any static host or use `npm run dev:local -- --web` for Chrome during development. Native push requires an EAS development/production build; Expo Go cannot receive remote push notifications for this SDK.

The Jest suite covers login and signup screens, confirmation-required and auto-confirmed signup redirects, visible failures, protected-route redirects, auth restoration/logout behavior, local callback suppression, runtime isolation, input validation, friendship state classification, duration formatting, safe error mapping, and encrypted-session chunking/removal. The pgTAP database suite exercises RLS, RPC visibility, session ownership, group administration, device isolation, avatar ownership, notification creation and permissions, and Realtime invalidation inside a rolled-back transaction.

The production dependency audit currently reports no critical issues. Its remaining high/moderate entries trace to `image-size` and `uuid` in Expo 57's Metro/xcode build tooling; compatible patched releases do not yet exist in those pinned semver ranges. npm proposes downgrading Expo and React Native, which is not a safe remediation. See [security_best_practices_report.md](./security_best_practices_report.md).

Profile search is limited to 30 requests per user per minute and uses PostgreSQL B-tree prefix indexes plus a `pg_trgm` GIN index for efficient 3+ character partial matches. It does not personalize results using friend history or user activity. Friend requests are limited to 20 per user per minute through a server-enforced RPC; direct table inserts are not granted to clients. The Vercel deployment adds clickjacking, MIME-sniffing, referrer, and browser-permission headers.

## Architecture

- `src/app` — routes and screens
- `src/components` — shared visual primitives and the animated sock control
- `src/hooks` — query mutations, notification registration, and Realtime lifecycle
- `src/lib` — Supabase client, encrypted storage adapter, notifications, formatting, and safe errors
- `src/services/api.ts` — typed data-access boundary
- `supabase/migrations` — schema, constraints, triggers, RPCs, grants, RLS, and Realtime publication
- `supabase/functions` — authenticated push sender

The app uses warm cream, ink, and safety orange with Space Grotesk and generated original Sock artwork in `assets/images`.

## Security notes

- Only the publishable Supabase key belongs in the client. Never add a service-role key to any `EXPO_PUBLIC_*` variable.
- Mobile auth state is chunked into `expo-secure-store`; web auth state uses browser `localStorage` so refreshes restore the Supabase session. Never persist sensitive application data outside the session token managed by Supabase.
- Database policy is the source of truth. UI visibility checks are convenience, not authorization.
- Logout removes only the current installation's push token and ends only the local session; other signed-in devices continue working.
- Do not force npm's suggested dependency downgrades. Re-audit when Expo publishes a compatible Metro/xcode chain.

## License

MIT — see [LICENSE](./LICENSE).
