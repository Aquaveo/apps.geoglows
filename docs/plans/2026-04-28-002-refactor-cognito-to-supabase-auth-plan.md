---
title: Migrate apps.geoglows from Cognito to Supabase Auth
type: refactor
status: active
date: 2026-04-28
---

# Migrate `apps.geoglows` from Cognito to Supabase Auth

## Overview

`apps.geoglows` currently uses AWS Cognito as its identity provider, with
Supabase as the data layer. This plan migrates the portal to use Supabase
Auth as both identity and data — eliminating Cognito entirely.

The library (`@aquaveo/geoglows-auth@0.2.0`) already supports both adapter
modes; the work here is on the consumer side: swap the adapter, replace the
hosted-UI redirect with an inline sign-in flow (vanilla JS, since the portal
is not a React app), drop Cognito environment variables, update Supabase
RLS policies, and document a migration plan for existing users.

## Problem Frame

The product decision has been made to consolidate on Supabase as the single
auth provider. Drivers (per the prior architecture discussion):

- Reduces operational surface (one console, one bill, one set of credentials)
- Up to 50,000 MAU on Supabase's free tier covers the GEOGloWS user base
- Removes AWS Cognito setup overhead for new contributors / forks
- The library's `AuthAdapter` seam was designed precisely for this swap

The migration is non-trivial because:
- The portal is **vanilla JavaScript** — the library's React `<SupabaseAuthUI>`
  component does not apply. A vanilla JS sign-in UI must be built.
- Existing users in `profiles` are keyed on Cognito sub UUIDs that won't
  match any Supabase Auth user id. A user-data decision is required.
- RLS policies on the Supabase project currently verify Cognito JWTs via
  `auth.jwt() ->> 'sub'`. They must switch to `auth.uid()`.
- `aquiferx` is the second consumer; it currently uses Cognito too, so
  cross-app SSO is at risk during the transition window.

## Requirements Trace

- **R1.** `apps.geoglows` authenticates users via Supabase Auth, with no
  remaining references to Cognito in source, env vars, or `package.json`.
- **R2.** A vanilla JS sign-in surface exists that supports Google OAuth,
  GitHub OAuth, and email/password (in that order of UX prominence).
- **R3.** Sign-out terminates the Supabase session and returns the user to
  an anonymous portal home.
- **R4.** Profile and organization data continues to load correctly after
  sign-in via the existing `loadAccountSummary` helper.
- **R5.** RLS policies on Supabase tables (`profiles`, `org_memberships`,
  `organizations`) are rewritten to use `auth.uid()` and verified against
  manual sign-in.
- **R6.** The library upgrade to `@aquaveo/geoglows-auth@0.2.0` is the
  enabling step, but NOT a blocker on the npm registry — `0.2.0` is
  already published.
- **R7.** A documented user-migration approach exists. Default path
  (per assumption D below): no migration; existing accounts re-sign-up.
- **R8.** Cognito user pool, app client, and associated AWS resources are
  decommissioned after cutover. Vercel env vars for Cognito are removed.

## Scope Boundaries

- **Not migrating aquiferx in this plan.** A parallel plan covers
  aquiferx; SSO across apps is a cross-cutting concern flagged in
  Risks but resolved by the parallel plan.
- **Not building a password-reset flow** in v1 of the inline UI. Supabase
  exposes `resetPasswordForEmail`; consumer can adopt later.
- **Not building a sign-up form distinct from sign-in.** Use OAuth providers
  for sign-up; email-password sign-in surfaces "create account" via
  Supabase's `signUp` only if needed.
- **No data migration of existing Cognito-backed `profiles` / org rows**
  (per assumption D). Existing rows remain and become orphaned. A separate
  plan can add a backfill if the product changes its mind.
- **No admin / role-management UI** in this plan. Org admins continue using
  the existing `createOrganization` flow.

### Deferred to Separate Tasks

- **Aquiferx Cognito → Supabase Auth migration**: separate plan in
  `aquiferx/docs/plans/`. Required for cross-app SSO post-cutover.
- **User-data migration backfill** (if reversed): a follow-up plan can
  add a Cognito-sub → Supabase-user-id mapping table and rewire foreign
  keys.
- **Password reset flow**: future iteration if email/password sign-in
  becomes primary.

## Context & Research

### Relevant Code and Patterns

- `src/auth.js` — Wraps `createOidcAuthAdapter` and exposes named functions
  (`signInRedirect`, `getCurrentUser`, etc.). Replace the import and
  internal adapter; the exported names should stay the same so consumer
  files (`main.js`, `events.js`, etc.) need minimal changes.
- `src/supabase.js` — Calls `createGeoglowsSupabaseClient({ url,
  publishableKey, auth, useIdToken: true })`. With Supabase Auth, the
  `auth` argument is omitted and the client is created first (because
  the new adapter wraps it).
- `src/main.js` — Drives `bootstrapSession` and an `appState` state
  machine. No changes needed if `auth` keeps the same exported shape.
- `src/events.js` — Wires `signIn` and `signOut` button click handlers
  to `auth.signInRedirect()` and `auth.signOutRedirect()`. The sign-in
  handler must change: instead of redirecting, it opens an inline modal.
- `src/ui/navbar.js` — Renders the "Sign in" button when no user is
  present, and a user menu with "Log out" when signed in. No structural
  change; the click target stays the same.
- `src/ui/appsPage.js`, `src/ui/workspacePage.js`, `src/ui/footer.js` —
  No changes; they consume `appState` only.

### Existing Sign-in Surface

The current portal has no inline sign-in UI — clicking "Sign in" redirects
to the Cognito hosted UI. Building an inline modal is greenfield UI work.
The existing CSS uses Tailwind utility classes (the navbar already shows
this pattern), so the new modal can match that style.

### Library API Reference

- `createSupabaseAuthAdapter({ supabase, defaultRedirectTo?, logoutRedirectTo? })`
  → returns `SupabaseAuthAdapter` with the standard `AuthAdapter` interface
  plus `signInWithPassword`, `signInWithMagicLink`, `signInWithOAuth`
  extension methods.
- `createGeoglowsSupabaseClient({ url, publishableKey })` → in Supabase Auth
  mode, omit `auth`. Supabase manages its own session.
- Library docs: `geoglows-auth/docs/adapters.md` (especially the "Supabase
  Auth setup" and "Login UI option 3: custom (headless)" sections).

## Key Technical Decisions

- **Decision A: Inline sign-in surface, not a hosted Supabase UI redirect.**
  Build a vanilla-JS modal that opens over the portal home when the user
  clicks "Sign in". Three options inside the modal: Google OAuth, GitHub
  OAuth, and email/password.
  **Rationale:** Keeps the portal feel cohesive (no full-page redirect to
  a Supabase-branded screen). Supabase hosted auth pages exist but
  introduce a brand-shift jolt. The modal is ~150 lines of HTML+JS, which
  is manageable. Per assumption A above.

- **Decision B: OAuth providers default to Google + GitHub.**
  Email/password is supported but secondary in the UI hierarchy. Per
  assumption B above.
  **Rationale:** Matches the audience question raised earlier (most
  research/institutional users have Google or GitHub accounts; OAuth
  providers also bypass the password-reset UI burden).

- **Decision C: No data migration of existing Cognito-backed users.**
  Existing rows in `profiles` and `org_memberships` keyed on Cognito sub
  UUIDs are NOT re-pointed to new Supabase Auth user ids. New users go
  through a fresh sign-up; old rows become orphaned but are kept for
  archival.
  **Rationale:** The portal is in a development/early-adopter phase; the
  user count is small enough that a fresh start is acceptable. A backfill
  plan can be written later if the count grows or the decision reverses.
  Per assumption D above.

- **Decision D: Decommission Cognito immediately at cutover, no parallel run.**
  Remove `VITE_COGNITO_*` env vars from Vercel and `.env.local` in the same
  PR that lands the new adapter. The Cognito user pool itself can be left
  in AWS for archival (no cost while idle), but it stops receiving
  authentications.
  **Rationale:** Parallel-running two identity providers in one app is
  significant complexity (two adapter chains, two localStorage namespaces,
  two refresh paths). Given the small user base, a hard cutover is
  simpler and lower-risk than dual-provider gymnastics.

- **Decision E: `auth.js` keeps its exported function names unchanged.**
  Internally, the file swaps from `createOidcAuthAdapter` to
  `createSupabaseAuthAdapter`. `signInRedirect()` becomes a no-op or a
  trigger that opens the sign-in modal. `signOutRedirect()` calls
  Supabase's `signOut`.
  **Rationale:** Minimizes ripples through `events.js`, `main.js`, etc.
  Those files keep importing the same named exports.

- **Decision F: RLS policies are rewritten in a separate Supabase migration
  before code cutover.**
  Switch `(auth.jwt() ->> 'sub')::uuid = user_id` patterns to
  `auth.uid() = user_id`. Ship the policy change in a Supabase migration
  before deploying the new client.
  **Rationale:** Once Supabase Auth issues the `auth.uid()` JWT claim and
  the client uses native Supabase tokens (no external `accessToken`
  callback), the old policies stop matching. Sequencing matters.

## Open Questions

### Resolved During Planning (assumed)

- **Login UI:** Vanilla-JS modal with Google + GitHub + email/password.
  (Assumption A.)
- **OAuth providers:** Google + GitHub. (Assumption B.)
- **User migration:** None — fresh start. (Assumption D — needs explicit
  user confirmation; if reversed, this plan needs a major addition.)
- **Cognito decommission:** Hard cutover. (Assumption D.)

### Deferred to Implementation

- **Exact modal HTML structure / Tailwind class set** — implementer chooses.
- **Whether to expose a "Sign up" mode in the modal explicitly** — depends
  on how the email/password flow is wired. Default: `signUp` button next to
  `signIn` in the same form; or rely on Supabase's "Allow new sign-ups"
  setting.
- **Specific RLS policy SQL** — depends on the actual current policies.
  The migration is "swap `(auth.jwt() ->> 'sub')` for `auth.uid()`" but
  the exact policy text isn't a planning-time question.
- **Cognito user-pool teardown timeline** — operations decision; defer to
  cutover day.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for
> review, not implementation specification. The implementing agent should
> treat it as context, not code to reproduce.*

```
                     User clicks "Sign in" in navbar
                                  │
                                  ▼
                      Sign-in modal opens (vanilla JS)
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
        [Google button]   [GitHub button]   [Email + Password form]
                │                 │                 │
                ▼                 ▼                 ▼
      adapter.signInWithOAuth   adapter.signInWithOAuth   adapter.signInWithPassword
        ({ provider:           ({ provider:               ({ email, password })
        "google" })            "github" })
                │                 │                 │
                ▼                 ▼                 ▼
            Redirect to       Redirect to       Inline session
            Google →          GitHub →          (no redirect)
            callback          callback          │
                │                 │                 │
                └─────────────────┴─────────────────┘
                                  │
                                  ▼
                  supabase.auth.onAuthStateChange fires
                                  │
                                  ▼
                       bootstrapSession picks up new user
                                  │
                                  ▼
                     Modal closes; navbar shows user menu
```

## Implementation Units

- [ ] **Unit 1: Bump library to `^0.2.0` and rewire `src/auth.js` / `src/supabase.js`**

  **Goal:** Replace Cognito adapter with Supabase Auth adapter at the
  `auth.js` / `supabase.js` seams. Keep `auth.js` exports stable so
  downstream files don't ripple.

  **Requirements:** R1, R6

  **Dependencies:** None (the library is published).

  **Files:**
  - Modify: `package.json` (`"@aquaveo/geoglows-auth"` from `^0.1.2` to `^0.2.0`)
  - Modify: `package-lock.json` (regenerated)
  - Modify: `src/supabase.js` — create the Supabase client first; drop
    the `auth` and `useIdToken` arguments; client is now standalone.
  - Modify: `src/auth.js` — swap `createOidcAuthAdapter` for
    `createSupabaseAuthAdapter({ supabase: <client> })`. Re-export the
    same function names plus add `signInWithPassword`,
    `signInWithMagicLink`, `signInWithOAuth` for the new UI to use.
    `signInRedirect()` becomes a thin wrapper that opens the sign-in
    modal (defined in Unit 2).

  **Approach:**
  - The order flips: `supabase.js` no longer imports from `auth.js`.
    Instead, `auth.js` imports the Supabase client from `supabase.js`,
    wraps it in `createSupabaseAuthAdapter`, and exposes the adapter
    methods.
  - `signInRedirect()` is renamed in spirit but kept by name — it now
    triggers the modal open instead of a hosted-UI redirect. Existing
    callers in `events.js` keep working.

  **Patterns to follow:**
  - The library's `docs/adapters.md` § "Supabase Auth setup" code
    examples.
  - aquiferx's existing `auth.ts` (will need the same change) — but
    aquiferx upgrade is a separate plan.

  **Test scenarios:**
  - Happy path: After this unit lands, `npm run build` succeeds and
    `npm run dev` boots the portal. (Sign-in flow is broken until Unit 2,
    so don't test the click yet.)

  **Verification:**
  - No source file imports `createOidcAuthAdapter`.
  - No source file imports `VITE_COGNITO_*` env vars.
  - `auth.js` exports the same function names as before plus the
    new OAuth/password methods.

---

- [ ] **Unit 2: Build vanilla JS sign-in modal**

  **Goal:** Provide an inline modal that opens when the user clicks
  "Sign in", offering Google, GitHub, and email/password options.

  **Requirements:** R2

  **Dependencies:** Unit 1.

  **Files:**
  - Create: `src/ui/signInModal.js` (renders the modal HTML, attaches
    event handlers, exposes `open()` / `close()` functions).
  - Modify: `src/main.js` — mount the modal once at bootstrap; expose
    its `open()` to be called from the navbar click handler.
  - Modify: `src/events.js` — change the `#signIn` click handler from
    `auth.signInRedirect()` to `signInModal.open()`.

  **Approach:**
  - The modal is a `<dialog>` element appended to `document.body`. Tailwind
    utility classes match the existing portal aesthetic.
  - Three primary buttons stacked vertically: "Continue with Google",
    "Continue with GitHub", divider, then a collapsed email/password form
    (toggled open via "Use email and password instead" link).
  - Each OAuth button calls `auth.signInWithOAuth({ provider, redirectTo:
    window.location.origin })`. Supabase handles the redirect.
  - The email/password form has email + password inputs, a "Sign in" button
    that calls `auth.signInWithPassword({ email, password })`, and a
    "Create account" toggle that calls `supabase.auth.signUp({ email,
    password })` directly.
  - On successful inline sign-in, the modal closes and `bootstrapSession`
    re-fires (or `useAuth().refresh()` equivalent — for vanilla JS, call
    `bootstrapSession` again or listen on `supabase.auth.onAuthStateChange`).
  - On error, render a generic message in the modal: "Sign-in failed.
    Check your email and password and try again." Same generic-message
    rationale as the library's `<SupabaseAuthUI>`.

  **Patterns to follow:**
  - `src/ui/navbar.js` for HTML-template-as-a-string + Tailwind classes
    style.
  - The library's `<SupabaseAuthUI>` (`src/react/SupabaseAuthUI.tsx` in
    the library repo) for the form behaviors — same generic error
    handling, same password-clear-on-failure, same trim-validation.

  **Test scenarios:**
  - Happy path: Click "Sign in" → modal opens → click "Continue with
    Google" → page redirects to Google OAuth.
  - Happy path: Click "Sign in" → enter valid email + password → form
    submits, modal closes, navbar shows user menu.
  - Edge case: Submit empty email → inline validation message; adapter
    not called.
  - Edge case: Submit empty password (in password mode) → validation
    message.
  - Error path: Adapter rejects with bad credentials → generic message
    appears in modal; password input is cleared; submit re-enabled.
  - Edge case: Click outside modal or press Escape → modal closes;
    no auth side-effects.

  **Verification:**
  - Modal opens / closes via the navbar button.
  - All three sign-in paths work end-to-end against the local dev
    Supabase project.
  - No console errors in the auth state-change listener.

---

- [ ] **Unit 3: Update Supabase RLS policies for `auth.uid()`**

  **Goal:** Rewrite policies on `profiles`, `org_memberships`, and
  `organizations` to use `auth.uid()` instead of
  `(auth.jwt() ->> 'sub')::uuid`.

  **Requirements:** R5

  **Dependencies:** None — independent of code changes; can ship before
  or alongside Unit 1.

  **Files:**
  - Create: a new Supabase migration in the existing migrations directory
    (location depends on the Supabase project structure; likely
    `supabase/migrations/<timestamp>-supabase-auth-rls.sql` if the
    Supabase CLI is in use, or a manual change in the dashboard).

  **Approach:**
  - For each policy that currently references the JWT sub claim, swap to
    `auth.uid()`. Example transformation:
    - Before: `(auth.jwt() ->> 'sub')::uuid = user_id`
    - After: `auth.uid() = user_id`
  - Re-test each policy in the Supabase SQL editor by setting a sample
    JWT and running representative SELECT/INSERT/UPDATE statements.
  - If any policy referenced the JWT's `email` or other Cognito-specific
    claims, decide on the equivalent — Supabase Auth provides
    `auth.jwt() ->> 'email'` natively for both providers' tokens.

  **Test scenarios:**
  - Integration: After migration, a user signed in via Supabase Auth can
    SELECT their own `profiles` row.
  - Integration: A user CANNOT SELECT another user's `profiles` row
    (RLS enforces isolation).
  - Integration: Unauthenticated requests are rejected on protected
    tables.

  **Verification:**
  - Manual verification in the Supabase SQL editor with a test user.
  - The new portal end-to-end flow (after Units 1 + 2) successfully
    loads the user's profile and orgs.

---

- [ ] **Unit 4: Strip Cognito env vars and AWS references**

  **Goal:** Remove all references to `VITE_COGNITO_*` env vars from the
  codebase, the example env file (if any), and the Vercel project
  settings.

  **Requirements:** R1, R8

  **Dependencies:** Unit 1 (otherwise the build breaks because
  `auth.js` still references the missing vars).

  **Files:**
  - Modify: `.env.example` (if exists) or create one — should list
    only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as
    required.
  - Modify: `vercel.json` (verify no Cognito-related rewrites or env
    references remain).
  - **External (not in repo):** Vercel project Settings → Environment
    Variables → remove `VITE_COGNITO_AUTHORITY`, `VITE_COGNITO_CLIENT_ID`,
    `VITE_COGNITO_REDIRECT_URI`, `VITE_COGNITO_LOGOUT_URI`,
    `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_SCOPE`.

  **Test expectation:** none — pure cleanup.

  **Verification:**
  - `grep -r VITE_COGNITO src/` returns no matches.
  - `npm run build` succeeds with only Supabase env vars defined.
  - Vercel preview deploy succeeds with the stripped env config.

---

- [ ] **Unit 5: Configure Supabase Auth providers in the dashboard**

  **Goal:** Enable Google + GitHub OAuth providers in the Supabase
  project, configure redirect URLs, and add the email/password provider
  if not already on by default.

  **Requirements:** R2

  **Dependencies:** None (Supabase-side configuration; can run in
  parallel with Unit 1/2).

  **Files:** none in repo — Supabase dashboard configuration only.

  **Approach:**
  - Supabase dashboard → Authentication → Providers
  - Enable **Google**: register an OAuth app in Google Cloud Console,
    paste client ID + secret into Supabase, add the Supabase callback
    URL (`https://<project>.supabase.co/auth/v1/callback`) to Google's
    allowed redirect URIs.
  - Enable **GitHub**: register an OAuth app in GitHub Settings →
    Developer settings → OAuth Apps, paste client ID + secret into
    Supabase, add the same Supabase callback URL.
  - Authentication → URL Configuration: add `https://portal-dev.geoglows.org`
    and `http://localhost:5173` (or whatever the dev port is) to the
    allowed redirect URLs.
  - Authentication → Settings: confirm email/password is enabled. Decide
    whether to require email confirmation for new sign-ups.

  **Test expectation:** none — configuration only.

  **Verification:**
  - In dev, clicking "Continue with Google" successfully redirects through
    Google and lands back on the portal authenticated.
  - Same for GitHub.
  - Email signup creates a row in `auth.users`.

---

- [ ] **Unit 6: Verify aquiferx interaction during transition window**

  **Goal:** Confirm the portal's `/aquifer-analyst/*` rewrite still
  routes correctly even though aquiferx is on a different identity
  provider (Cognito) until its own migration plan ships.

  **Requirements:** R3, R4

  **Dependencies:** Units 1–5 deployed to a preview environment.

  **Files:** none in repo. Verification only.

  **Approach:**
  - Deploy the portal changes to a Vercel preview.
  - Sign in via Supabase Auth on the portal.
  - Navigate to `/aquifer-analyst/`. **Expected:** aquiferx still uses
    Cognito, so the user appears anonymous in aquiferx and is prompted to
    sign in there. SSO is broken during the transition window (acknowledged).
  - Confirm: clicking back to the portal home from aquiferx, the user
    is still signed in to the portal (Supabase session persists).
  - Document the transition behavior: "Until aquiferx migrates, users
    sign in twice (once per app)."

  **Test scenarios:**
  - Integration: Portal sign-in via Supabase Auth → portal home shows
    user menu. Navigate to `/aquifer-analyst/` → aquiferx prompts
    Cognito sign-in. Both sessions coexist in the same browser.
  - Edge case: User signs out of the portal → portal home reverts to
    anonymous; aquiferx Cognito session persists until separately
    signed out.

  **Verification:**
  - Both apps load without console errors.
  - The expected SSO break is documented in `docs/` for the team.
  - Aquiferx migration plan is queued as the next task.

---

- [ ] **Unit 7: Documentation, sign-up communication, cutover plan**

  **Goal:** Document the migration for users and the team. Decide and
  communicate the cutover date. Prepare a brief notice for existing
  users that they need to re-sign-up.

  **Requirements:** R7, R8

  **Dependencies:** Units 1–6 ready for cutover.

  **Files:**
  - Create / Modify: `apps.geoglows/README.md` (or equivalent
    contributor docs) — install instructions reflect the new env vars
    and the absence of Cognito setup.
  - Create: `docs/migration-2026-04.md` (or similar) — internal
    operations doc covering: cutover steps, rollback plan, user
    notification text, Cognito teardown checklist.
  - **External:** Send a notice to existing users (email or banner)
    that the sign-in system is changing and they need to register
    again. Schedule the change.

  **Approach:**
  - Define the cutover sequence:
    1. Deploy RLS migration (Unit 3) to production Supabase.
    2. Deploy code changes (Units 1, 2, 4, 5) to production Vercel.
    3. Notify users.
    4. Decommission Cognito user pool (or leave dormant).
  - Document the rollback plan: revert the Vercel deploy and the RLS
    migration; user accounts created in Supabase Auth between cutover
    and rollback are orphaned but harmless.

  **Test expectation:** none — documentation and ops only.

  **Verification:**
  - The cutover doc exists and is reviewed by another team member.
  - User notification has a clear date and "what to expect" section.
  - Rollback steps are written and a dry-run is mentally walked through.

## System-Wide Impact

- **Interaction graph:** The portal's auth-dependent surfaces are the
  navbar (sign-in/out buttons), the workspace page (which loads the
  user's account summary), and any future per-user feature. All consume
  `appState` set by `bootstrapSession`. Switching the underlying adapter
  preserves the state-machine contract — no surface needs functional
  changes beyond the sign-in click handler.
- **Error propagation:** OAuth failures redirect back with `?error=` query
  params; the modal must read these on portal load and render an error
  state. Email/password failures surface inline.
- **State lifecycle risks:** localStorage namespace switches from
  `oidc.user:*` (Cognito) to `sb-<project-ref>-auth-token` (Supabase).
  After cutover, the old namespace becomes garbage. Optional cleanup
  step: clear `oidc.user:*` keys on first portal load post-migration to
  free localStorage space.
- **API surface parity:** `auth.js`'s exported function names stay
  stable. `events.js`, `main.js`, `navbar.js` etc. need only the click
  handler change in `events.js`.
- **Integration coverage:** Cross-app SSO with aquiferx is broken until
  aquiferx migrates separately. This is acknowledged and documented.
- **Unchanged invariants:** `profiles`, `org_memberships`, `organizations`
  table schemas; the helpers `loadAccountSummary`, `createOrganization`,
  `setActiveOrgId`, `getUserDisplayInfo`, `bootstrapSession`,
  `ensureProfile`. The `appState` shape and the navbar/workspace UI.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| **Cross-app SSO break during transition window.** Portal on Supabase Auth + aquiferx on Cognito = users sign in twice. | Document the dual-sign-in expectation. Schedule aquiferx migration as the next task. The window is bounded by aquiferx's plan. |
| **Existing Cognito users lose access.** Per assumption D, no migration. Anyone who had a profile/org membership keyed on a Cognito sub UUID has to re-create their account. | Send the user-notification well ahead of cutover. Provide a clear sign-up path post-migration. Reserve the option to write a backfill plan if user count is larger than expected. |
| **RLS policies fail post-migration**, locking users out of their own data. | Test RLS migration in a staging Supabase project before applying to production. Have the SQL revert script ready. Run a sanity-check sign-in with a fresh user immediately after the policy migration. |
| **OAuth callback URL misconfiguration** — Supabase rejects the redirect, leaving the user stranded. | Configure callback URLs (Supabase, Google, GitHub) before code cutover. Test in a Vercel preview deployment. Include `localhost:5173` in the allow-list for dev. |
| **Sign-in modal CSP / origin issues** — OAuth redirects might be blocked by Content-Security-Policy headers. | The portal currently has no custom CSP. Verify by deploying to preview and watching Network tab. Add `connect-src https://*.supabase.co` if needed. |
| **Cognito decommission too early** — if rollback is required mid-cutover, the Cognito pool needs to still exist. | Leave the Cognito user pool in AWS for at least 30 days post-cutover. Cost is zero while idle. Decommission only after confidence is high. |
| **Email-confirmation requirement breaks self-sign-up flow.** | Decide explicitly in Unit 5 whether email confirmation is required. If yes, the sign-up flow must show a "Check your email" state. Default suggestion: disable email confirmation for v1; reconsider once volume grows. |
| **`bootstrapSession` re-runs after inline sign-in** — currently runs once at portal load. | Either re-call `bootstrapSession` after `onAuthStateChange` fires `SIGNED_IN`, or wire the modal's success path to call it directly. The library's `bootstrapSession` is idempotent for this purpose. |

## Documentation / Operational Notes

- **Vercel env var changes** must be coordinated with the deploy:
  add new Supabase vars before the Cognito ones are removed (no-op
  if they're already set), then remove Cognito vars right at cutover.
- **Cognito user pool teardown** is optional and reversible for ~30 days
  in AWS. Leave it idle as a safety net.
- **Slack / email notification template** should be drafted in Unit 7.
  Suggested timing: 1 week pre-cutover, 24 hours pre-cutover, day-of.
- **No CHANGELOG on the portal side** — the migration is documented in
  the cutover doc.

## Sources & References

- Library v0.2.0: `https://www.npmjs.com/package/@aquaveo/geoglows-auth/v/0.2.0`
- Library docs: `../geoglows-auth/docs/adapters.md`
  (especially "Supabase Auth setup" and "Login UI option 3: custom (headless)")
- Library plan: `../geoglows-auth/docs/plans/2026-04-23-001-feat-supabase-auth-adapter-plan.md`
- Architecture docs: `../ARCHITECTURE_FOR_CLIENTS.md` (for the
  Cognito-vs-Supabase-Auth comparison context)
- Supabase Auth provider config docs:
  - Google: `https://supabase.com/docs/guides/auth/social-login/auth-google`
  - GitHub: `https://supabase.com/docs/guides/auth/social-login/auth-github`
- Superseded plan:
  `docs/plans/2026-04-28-001-chore-upgrade-geoglows-auth-0.2.0-plan.md`
