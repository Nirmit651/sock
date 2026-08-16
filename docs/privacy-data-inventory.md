# Sock data inventory and child-safety response

Last reviewed: August 16, 2026. This is an engineering inventory, not legal advice. The operator, legal contact, privacy contact, retention schedule, and jurisdictional requirements remain launch-blocking TODOs for qualified counsel.

## Data inventory

| Data category | Examples | Purpose | Main processor/storage | User-facing control or deletion |
| --- | --- | --- | --- | --- |
| Auth account | email, password hash, confirmation/recovery state | sign-in, email confirmation, password reset | Supabase Auth; Resend via Supabase SMTP for email delivery | Delete account in Settings; provider logs/backups may have separate retention |
| Profile | username, optional display name, avatar path | identity and social features | Supabase Postgres; private `avatars` storage | Edit profile; delete account deletes rows and avatar objects |
| Age eligibility evidence | `13-plus-v1`, rule version, confirmation time | demonstrate the age gate without retaining a full birth date | Supabase Postgres `profiles` | Delete account |
| Legal acceptance | Terms/Privacy versions and accepted/acknowledged times | demonstrate clickwrap acceptance | Supabase Postgres `profiles` | Delete account |
| Social graph | friend requests, friendships, groups, memberships | friends/groups and visibility | Supabase Postgres | Manage groups/friends; delete account cascades deletes |
| Sock activity | status state, session start/end times, visibility setting | current status, private history, group-Wrapped aggregate | Supabase Postgres | visibility controls; delete account |
| Notifications | preference, Expo push token, delivery-outbox metadata | deliver opt-in status notifications | Supabase Postgres; Expo Push Service | notification switch; delete account |
| Technical operations | IP address, request metadata, browser/device details, service/security logs | host, secure, troubleshoot, and prevent abuse | Supabase, Vercel, Resend, Expo and network providers | exact retention and privacy contact are TODO before launch |

The current repository contains no contacts import, precise-location collection, advertising SDK, behavioral analytics SDK, or third-party error-monitoring SDK.

## Date-of-birth minimization

The signup client sends a full date of birth only to the server-side Auth signup flow so it can determine eligibility. A Supabase **Before User Created** hook checks that the person is at least 13 on the exact calendar anniversary. The profile-creation trigger repeats the check as a second barrier. It then removes the full birth date and temporary clickwrap fields from `auth.users.raw_user_meta_data`.

The durable app record retains only `age_eligibility_version`, `age_eligibility_confirmed_at`, Terms version/time, and Privacy Policy version/time. This design intentionally avoids storing a full date of birth in Sock's application tables. The full date may still be transiently processed in provider request/audit systems; provider log retention needs counsel-approved documentation before launch.

## When Sock learns an account belongs to a child under 13

1. Treat the report as urgent. Do not request more personal information than is necessary to identify the account.
2. An authorized operator should immediately disable the account using a protected Supabase admin workflow, revoke active access, and preserve only the minimum incident record required by counsel.
3. Delete the account using the same protected admin workflow or the authenticated in-app deletion path. Auth-user deletion cascades the Sock database records. Delete private avatar storage objects for the account prefix as part of the workflow.
4. Remove/revoke device-token records and stop future notifications. A notification already delivered by Expo cannot be recalled.
5. Handle any necessary parent/guardian communication through the final published privacy contact. Do not publicly disclose the child’s information.
6. Record the date, authorized responder, account identifier, action taken, and any legally required retention decision in a restricted incident log. Do not copy the child’s full date of birth into the incident log unless counsel requires it.
7. Review processor retention: Supabase backups/logs, Resend email-delivery logs, Vercel logs, and Expo delivery records may retain limited operational data under provider terms. Obtain the applicable deletion/retention procedure from each provider and document it before launch.

Only authorized personnel may use service-role credentials or Supabase administrative controls. Never place them in the app, client bundle, support ticket, or this repository.
