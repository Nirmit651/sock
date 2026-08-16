# Signup and privacy security review

Reviewed August 16, 2026. This is an engineering review, not a certification or legal-compliance opinion.

## Implemented controls

- The signup form requires an unchecked affirmative Terms/Privacy checkbox. The public documents are reachable at `/terms` and `/privacy` without an authenticated session.
- The client includes the document versions shown to the user, but the server reads the current versions from a private server-owned table. A forged or stale version is rejected.
- The hosted Supabase Auth **Before User Created** hook independently validates required legal acceptance and the 13+ date-of-birth rule before an Auth user exists. It returns a generic ineligible message for a child account.
- The `private.handle_new_user` trigger repeats the eligibility and legal-version checks. This defense-in-depth barrier prevents profile creation if the hook is accidentally disabled or bypassed.
- The trigger removes full birth date and temporary clickwrap values from Auth user metadata and stores only eligibility/acceptance evidence.
- Account deletion is a signed-in Supabase Edge Function. It resolves the caller from the bearer token, deletes the caller's private avatar objects, and only then invokes the Supabase admin deletion API for that same user. It does not accept a target user ID from the client.
- Existing database Row Level Security continues to protect application data, and private avatar objects remain scoped to user folders.

## Required launch verification

1. Apply `20260816112622_signup_legal_age_gate.sql` to production.
2. Enable the hosted Auth hook with URI `pg-functions://postgres/public/enforce_signup_eligibility` and verify it is enabled in project configuration.
3. Deploy the `delete-account` Edge Function with JWT verification enabled.
4. Confirm the production Terms/Privacy links, real operator name, legal/privacy contacts, governing law, processor retention periods, and regional disclosures with qualified counsel.
5. Perform a production smoke test for: under-13 rejection, exactly-13 acceptance, missing clickwrap rejection, stale-document rejection, legal-record persistence without DOB, and account deletion.

## Remaining risks / decisions for the operator

- Web sessions are stored by Supabase in browser local storage. This is a normal Supabase React Native web persistence configuration but increases the importance of maintaining a restrictive Content Security Policy and avoiding script injection. The existing Vercel headers should be supplemented with a tested CSP before public launch.
- Third-party infrastructure providers may retain security, email-delivery, or backup data outside the app database. The operator must document their retention/deletion commitments and include them in the final Privacy Policy.
- No implementation can establish legal compliance by itself. Counsel should review COPPA applicability, youth safety obligations, privacy rights laws, contract terms, jurisdiction, liability limits, support process, and incident response before launch.
