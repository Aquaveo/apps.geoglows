---
title: Rich user profiles — schema, library types/components, portal UI
type: feat
status: active
date: 2026-04-28
revised: 2026-04-28
---

# Rich user profiles — schema, library types/components, portal UI

## Overview

Extends the minimal `profiles` schema (id, email, display_name,
created_at) with structured names and a small set of optional contact
fields, behind strict per-user RLS so no profile is ever visible to any
other user. Drops the abandoned `organizations` / `org_memberships`
tables that were carried over from the Cognito era. Adds a vanilla-JS
profile-edit view in the portal with a soft completion reminder that
only appears on the profile page itself, plus a parallel set of React
components in `@aquaveo/geoglows-auth` so aquiferx and future React
consumers can use the same flows.

This plan spans two repos:

- **`apps.geoglows`** — owns the Supabase schema migrations, the
  vanilla-JS profile UI, and the workspace page changes.
- **`@aquaveo/geoglows-auth`** — gains updated `Profile` types, helper
  functions, and three React components.

## Problem Frame

The current `profiles` table holds only `id`, `email`, `display_name`,
`created_at`. After the Cognito → Supabase Auth migration, OAuth
sign-ins (Google, GitHub) populate `display_name` from the provider
metadata but no other contact info is captured. The product needs:

- **Structured names** (first / last) so first-time users without an
  OAuth-provided full name can identify themselves.
- **Optional contact metadata** (phone, address, user link, user type)
  for users who want to share more — but **never visible to other
  users** in v1.
- **A profile-edit page** so users can update their info after sign-up.
- **Reusable React components** in the auth library so aquiferx (and
  future React consumers) inherit the same UI without rebuilding it.
- **Removal of the abandoned organizations feature** so the data model
  reflects what the product actually does today (single-user accounts,
  no org concept).

## Requirements Trace

- **R1.** Sign-up via email/password collects only: first name *,
  last name *, email *, password *. Other profile fields are filled
  in from the profile page.
- **R2.** OAuth sign-up (Google / GitHub) creates a profile row from
  whatever metadata the provider supplies. Missing required fields
  trigger the same completion prompt as any other incomplete profile.
- **R3.** **No profile data is visible across users.** RLS on
  `profiles` continues to allow each user to read only their own row.
  No "directory" or member listing in v1.
- **R4.** Users can view and edit their own profile from a dedicated
  profile page.
- **R5.** A completion reminder (soft, dismissible) appears **only on
  the profile page**, not on the home / app library page. The home
  page stays clean.
- **R6.** The `organizations`, `org_memberships`, related helper
  functions, and the workspace-page UI for creating orgs are removed.
  Schema-level removal happens via a Supabase migration.
- **R7.** Library (`@aquaveo/geoglows-auth`) ships React components:
  `<ProfileSetupForm>`, `<ProfileEditForm>`, `<ProfileCompletionBanner>`.
- **R8.** Library ships a typed `Profile` interface, helpers
  `updateProfile` and `isProfileComplete`. `ensureProfile` is updated
  to never overwrite fields a user has filled in.
- **R9.** Library version bumps to `0.3.0` (additive types and
  components; some breaking removals from the org-helper surface — see
  decision below).
- **R10.** Existing rows in `profiles` (3 rows) are preserved through
  the migration; their new columns default to NULL.

## Scope Boundaries

- **No cross-user visibility of any kind.** No directory, no member
  list, no profile-card-of-other-users. Period.
- **No organization concept.** The `organizations` and
  `org_memberships` tables and all org-related code are removed in
  this iteration. A future feature can re-introduce orgs with a
  fresh design.
- **No avatar upload UI.** OAuth providers may supply `avatar_url`;
  we store it but don't add a custom-upload form. Future iteration.
- **No password-reset, no email-change, no account deletion.** Out
  of scope; left for future iterations.
- **No email/phone/address verification.** Free-text fields, no SMS
  or email verification flow.

### Deferred to Separate Tasks

- **Organizations v2**: a future plan can re-introduce the concept
  with whatever shape the product wants by then. Not blocked by this
  plan; explicitly cleared out.
- **Aquiferx adoption** of the new React components: separate plan
  in `aquiferx/docs/plans/`. This plan ships the components; aquiferx
  consumes them as a follow-up.
- **Account-management features** (delete, email change, password
  reset): future iteration.

## Context & Research

### Relevant Code and Patterns

**`apps.geoglows`:**
- `supabase/migrations/20260323214658_auth.sql` — defines the current
  `profiles`, `organizations`, `org_memberships` schema. New
  migration adds columns to profiles and drops the org tables.
- `supabase/migrations/20260323214730_rls.sql` — current RLS. The
  `profiles_select_own` policy stays. Org-related policies and
  helper functions are dropped along with the tables.
- `src/main.js` — drives the `appState` state machine. The
  `currentPage` flag adds a `profile` value alongside `apps` and
  `workspace`.
- `src/ui/workspacePage.js` — currently shows the "Create
  organization" form and org-membership UI. **Replaced** by a
  profile page (or the org section is stripped and the page is
  renamed).
- `src/ui/navbar.js` — has a "Workspace" link in the user menu.
  Renamed to "Profile" (or a new entry added).
- `src/ui/signInModal.js` — sign-up branch needs to collect
  first_name and last_name in addition to email + password.
- `src/profile.js`, `src/account.js` — wrap the library's helpers.
  Org-related wrappers (`createOrganization`, `selectActiveOrg`,
  `loadAccountSummary` org parts) are dropped.
- `src/events.js` — handlers for `#orgSelector`, `#createOrgForm`
  are dropped.

**`@aquaveo/geoglows-auth`:**
- `src/types.ts` — `Profile` gains structured name + contact fields.
  `Organization`, `OrgMembership`, `OrgRole` types are removed
  (deprecated and removed cleanly in 0.3.0). `AuthContextValue`
  loses `memberships`, `organizations`, `activeOrgId`, `activeOrg`,
  `activeRole`, `setActiveOrgId`.
- `src/core/profile.ts` — `ensureProfile` hardened. New
  `updateProfile`, `isProfileComplete`. `loadOrganizations` removed.
- `src/core/account.ts` — substantially shrunk. `loadAccountSummary`
  returns `{ profile }` only; `createOrganization`, `selectActiveOrg`,
  `getActiveOrgId`, `setActiveOrgId`, `clearActiveOrgId` removed.
- `src/core/session.ts` — `bootstrapSession` returns a session with
  no org data. `SessionState.account` shape simplifies.
- `src/react/AuthProvider.tsx` — context value sheds org fields.
  `useOrg` hook is removed.
- `src/react/OrgSelector.tsx`, `src/react/OrgSettings.tsx` — removed.
- `src/react/SidebarAuth.tsx` — depends on org context; either
  drops the org section or is removed if no longer useful.

### Pattern References

- `src/react/SupabaseAuthUI.tsx` is the established style for new
  React form components (controlled inputs, generic errors, inline
  styles, `onSuccess` / `onError` callbacks).
- `src/ui/signInModal.js` is the vanilla-JS counterpart pattern.
- The current `auth.sql` and `rls.sql` migrations show the project's
  SQL style.

## Key Technical Decisions

- **Decision A: RLS on `profiles` stays as `profiles_select_own`**
  (each user reads only their own row). No directory, no public
  visibility, no column-level RLS gymnastics.
  **Rationale:** Per the product requirement. The simplest possible
  policy is also the safest. If a future iteration needs cross-user
  visibility, it can add column-level RLS or a separate `directory`
  view at that time — out of scope now.

- **Decision B: New columns on `profiles` are all optional.**
  Required fields are enforced **at the application layer** (the
  sign-up form and the completion predicate), not via NOT NULL
  constraints. Schema-level NOT NULL would block backfilling
  existing rows and OAuth users who skip the setup step.
  **Rationale:** Database constraints model invariants; "the user
  must fill this in to consider their profile complete" is product
  policy, not a DB invariant. The completion predicate
  (`isProfileComplete`) lives in code where it can evolve.

- **Decision C: `user_type` is a Postgres enum.** Initial values:
  `researcher`, `student`, `agency_staff`, `industry_professional`,
  `public`, `other`. Adjustable via `ALTER TYPE ... ADD VALUE`.
  **Rationale:** Type safety for the dropdown, stable source of truth
  for the UI options list. Free-text would let typos in.

- **Decision D: The `organizations`, `org_memberships` tables and
  related code are dropped, not deprecated-but-kept.** Migration drops
  the tables, helper functions (`is_org_member`, `is_org_admin`,
  `create_organization_with_admin`), and policies.
  **Rationale:** Per user request. Clean slate. If org concept comes
  back, it can be designed fresh with whatever shape the product
  needs by then. Existing org-table data, if any, is small / test
  data from the Cognito era and can be lost.

- **Decision E: Sign-up modal grows by exactly two fields:
  first_name and last_name.** The other profile fields (phone, address,
  user_type, link) are filled in from the profile page after sign-up.
  Email and password remain.
  **Rationale:** Keeps the sign-up modal short and OAuth-symmetric
  (OAuth users provide email + name; password users provide email +
  name + password). Other fields are profile-page work, not sign-up
  work.

- **Decision F: Profile-completion banner appears only on the
  profile page**, not on the home page or app library page.
  **Rationale:** Per user request. Users browsing the App Library
  shouldn't see a nag every visit. The banner is contextual: when
  the user IS on their profile, the prompt makes sense.

- **Decision G: Workspace page is renamed / repurposed as the
  Profile page.** The current "Create organization" UI and "Set up
  your workspace" copy are removed.
  **Rationale:** With orgs gone, "workspace" has no meaning beyond
  "your profile". One page, one purpose.

- **Decision H: Library version bump to `0.3.0` is a minor with
  some breaking removals.**
  - **Additive (non-breaking):** new `Profile` fields,
    `updateProfile`, `isProfileComplete`, three new React components.
  - **Breaking removals:** `Organization`, `OrgMembership`, `OrgRole`
    types; `loadOrganizations`, `createOrganization`,
    `selectActiveOrg`, `getActiveOrgId`, `setActiveOrgId`,
    `clearActiveOrgId`, `loadAccountSummary`'s org fields; `useOrg`
    hook; `<OrgSelector>`, `<OrgSettings>` components.

  Pre-1.0 semver tolerates breaking changes in a minor bump. The
  removals affect only consumers actively using the org features —
  currently apps.geoglows is the sole consumer and is being updated
  in lockstep.
  **Rationale:** Removing dead surface area is healthier than
  carrying it forward indefinitely. Aquiferx hasn't adopted the org
  helpers yet, so timing is good.

- **Decision I: `ensureProfile` hardened.** On insert, sets `id`,
  `email`, `first_name` (if available from OAuth), `last_name` (if
  available), `display_name`, `avatar_url`. On conflict (existing
  row), updates only `email` and `avatar_url` (which can legitimately
  change at the auth provider). Never overwrites user-edited fields.
  **Rationale:** The user's structured names and contact info are
  authoritative once entered. Clobbering them on every
  `bootstrapSession` would silently destroy data.

## Open Questions

### Resolved During Planning

- **RLS posture:** strict per-user (Decision A).
- **Org fields:** removed entirely (Decision D).
- **Required signup fields:** first_name, last_name, email, password
  (R1, Decision E).
- **Completion banner placement:** profile page only (Decision F).

### Deferred to Implementation

- **Final `user_type` enum values** — Decision C's defaults are a
  starting point. Adjust during Unit 1 if the team has a better list.
- **Whether the profile page is `#profile` route, or rendered inline
  on the workspace page** — implementer's call. Hash routing matches
  the existing `#workspace` / `#apps` model. Recommend `#profile`.
- **Backfill strategy for existing 3 rows** — leave new columns NULL.
  Users complete on next sign-in via the profile page.
- **What to do with the existing rows in `organizations` and
  `org_memberships`** — drop with the tables (per Decision D). If
  any rows turn out to be load-bearing, that surfaces as a forced
  follow-up; for now assume they're test data from the Cognito era.

## Implementation Units

### Phase 1: Schema and cleanup — `apps.geoglows`

- [ ] **Unit 1: Migration — add profile columns + drop org tables**

**Goal:** Extend `profiles` with new columns, create the `user_type`
enum, drop the `organizations` / `org_memberships` tables and related
helpers and policies.

**Requirements:** R1, R2, R6, R10

**Dependencies:** None.

**Files (target repo: `apps.geoglows`):**
- Create: `supabase/migrations/<timestamp>_rich_user_profiles.sql`

**Approach:**
- Drop org-related code first (so dependent objects are cleaned up
  before profiles changes):
  - `DROP POLICY` for each org-related policy.
  - `DROP FUNCTION` `is_org_member`, `is_org_admin`,
    `create_organization_with_admin`.
  - `DROP TABLE org_memberships CASCADE; DROP TABLE organizations CASCADE;`
- Create `user_type` enum (Decision C).
- `ALTER TABLE public.profiles ADD COLUMN` for each of:
  `first_name text`, `middle_name text`, `last_name text`,
  `phone_number text`, `user_type public.user_type`,
  `address text`, `user_link text`, `avatar_url text`.
- All new columns nullable (Decision B).
- Add a `check (user_link IS NULL OR user_link ~* '^https?://')`
  constraint.

**Patterns to follow:**
- Existing `auth.sql` and `rls.sql` migrations for SQL style.

**Test scenarios:**
- Happy path: After migration, `\d profiles` shows new columns
  nullable; the existing 3 rows are unchanged with new columns set
  to NULL.
- Edge case: `user_link = 'javascript:alert(1)'` → check rejects.
- Edge case: `user_type = 'invalid'` → enum rejects.
- Verification: `SELECT * FROM organizations` returns "relation does
  not exist" (table dropped).

**Verification:**
- Migration applies cleanly with `supabase db push`.
- Existing profile rows remain readable.
- A test INSERT with new columns populated succeeds.

---

### Phase 2: Library types and helpers — `@aquaveo/geoglows-auth`

- [ ] **Unit 2: Update `Profile` type, harden `ensureProfile`, drop org surface**

**Goal:** Reflect the new schema in TypeScript types, add
`updateProfile` and `isProfileComplete`, harden `ensureProfile`, and
remove all org-related helpers and types.

**Requirements:** R8, R9 (breaking removals)

**Dependencies:** Unit 1.

**Files (target repo: `@aquaveo/geoglows-auth`):**
- Modify: `src/types.ts` — extend `Profile`; add `UserType` union;
  delete `Organization`, `OrgMembership`, `OrgRole`; trim
  `AuthContextValue`.
- Modify: `src/core/profile.ts` — add `updateProfile` and
  `isProfileComplete`; harden `ensureProfile`; remove
  `loadOrganizations`.
- Modify: `src/core/account.ts` — strip org logic. `loadAccountSummary`
  returns `{ profile }` only.
- Modify: `src/core/session.ts` — `SessionState.account` shape
  follows the simplified `loadAccountSummary` return.
- Delete: nothing (everything stays inside the modified files).
- Test: `tests/core/profile.test.ts` — new file.
- Test: `tests/core/account.test.ts` — update existing if any.

**Approach:**
- `Profile` interface gains `first_name?, middle_name?, last_name?,
  phone_number?, user_type?, address?, user_link?, avatar_url?` — all
  optional.
- `UserType` is a string union matching the Postgres enum.
- `ensureProfile`: on conflict, updates only `email` and
  `avatar_url`. On insert, populates id, email, and any name fields
  available from OAuth metadata.
- `updateProfile(supabase, profile)`: explicit UPDATE; respects
  `profiles_update_own` RLS.
- `isProfileComplete(profile)`: returns true when `first_name`,
  `last_name` are both present and non-empty. (Email is implicit —
  it's required at the auth layer.)

**Patterns to follow:**
- Existing `src/core/profile.ts` for the upsert / select shape.
- Existing `tests/core/supabase.test.ts` for the mock-supabase test
  shape.

**Test scenarios:**
- Happy path: `ensureProfile` on a fresh user inserts a row with
  email, id, optionally first/last from OAuth metadata.
- Happy path: `ensureProfile` on a user with `first_name='Gio'`
  set does NOT overwrite `first_name` when called again with a
  different `user.name`.
- Happy path: `updateProfile` writes user-supplied fields; null
  fields clear the column.
- Happy path: `isProfileComplete({first_name: 'Gio', last_name: 'R'})`
  → true. Missing either → false.
- Error path: `updateProfile` with an invalid `user_type` →
  Supabase rejects (enum violation); helper surfaces the error.

**Verification:**
- All existing tests pass after org-helper removals (existing tests
  may need to be updated — there were no org-specific tests in the
  current suite, so this is mostly a delete operation).
- New profile.test.ts tests pass.
- Type-check clean. Build emits the slimmer surface.

---

- [ ] **Unit 3: Drop org React components and `useOrg` hook**

**Goal:** Remove the React surface for orgs.

**Requirements:** R9

**Dependencies:** Unit 2.

**Files (target repo: `@aquaveo/geoglows-auth`):**
- Delete: `src/react/OrgSelector.tsx`, `src/react/OrgSettings.tsx`.
- Modify: `src/react/AuthProvider.tsx` — drop org context fields,
  drop `useOrg` hook export.
- Modify: `src/react/SidebarAuth.tsx` — drop the org section if
  present, or delete the file entirely if no longer useful.
- Modify: `src/react/index.ts` — remove deleted re-exports.

**Test expectation:** none — pure deletions.

**Verification:**
- Build succeeds.
- A grep for `useOrg`, `OrgSelector`, `OrgSettings` in the source
  returns no results.

---

### Phase 3: Library React components — `@aquaveo/geoglows-auth`

- [ ] **Unit 4: `<ProfileSetupForm>` component**

**Goal:** A React form for new users to fill in their profile after
sign-up. Pre-populated from any OAuth metadata that came with the
account.

**Requirements:** R7

**Dependencies:** Unit 2.

**Files (target repo: `@aquaveo/geoglows-auth`):**
- Create: `src/react/ProfileSetupForm.tsx`
- Modify: `src/react/index.ts` — re-export.
- Test: `tests/react/ProfileSetupForm.test.tsx`

**Approach:**
- Props: `supabase` (the Supabase client), `existingProfile` (the
  user's current row, may be partial), `onSuccess?(profile)`,
  `onError?(error)`, optional `onCancel?` for an "I'll do this
  later" path.
- Fields rendered:
  - First name * (text)
  - Last name * (text)
  - Middle name (text)
  - Phone number (text)
  - User type (select, options from `UserType`)
  - Address (textarea)
  - User link (text, validated against `^https?://`)
- Email is read-only (taken from the auth user).
- Submit calls `updateProfile(supabase, {...formData, id: user.sub})`.
- Generic error UI on submit failure.
- Inline-styled.

**Patterns to follow:**
- `src/react/SupabaseAuthUI.tsx` for layout and validation.

**Test scenarios:**
- Happy path: Fill required fields, submit → `updateProfile` called
  with the right payload, `onSuccess` fires.
- Happy path with `existingProfile` pre-fill: form renders with
  values populated.
- Edge case: Submit with empty first_name → validation alert; adapter
  not called.
- Edge case: Submit with `user_link = "javascript:alert(1)"` →
  validation rejects.
- Error path: `updateProfile` rejects → generic message rendered;
  raw error passed to `onError`; submit button re-enabled.

**Verification:**
- All test scenarios pass.
- Build emits `ProfileSetupForm` from `@aquaveo/geoglows-auth/react`.

---

- [ ] **Unit 5: `<ProfileEditForm>` component**

**Goal:** A React form for users to edit their existing profile.

**Requirements:** R7

**Dependencies:** Unit 4.

**Files (target repo: `@aquaveo/geoglows-auth`):**
- Create: `src/react/ProfileEditForm.tsx`
- Modify: `src/react/index.ts` — re-export.
- Test: `tests/react/ProfileEditForm.test.tsx`

**Approach:**
- Same field set as `<ProfileSetupForm>`. If the field markup is
  identical, extract a `ProfileFields` internal helper used by both.
- Always pre-filled from `profile` prop (required, non-optional).
- Adds a "Cancel" button alongside "Save".
- "Save" disabled when no fields have changed (UX nicety).

**Test scenarios:**
- Happy path: Pre-filled form, edit one field, submit → `updateProfile`
  called with the changes.
- Happy path: Cancel → `onCancel` fires; no adapter call.
- Edge case: Pre-fill with all fields blank (legacy row) → form
  renders the full set of empty inputs.
- Error path: Same as Unit 4.

**Verification:**
- All test scenarios pass.

---

- [ ] **Unit 6: `<ProfileCompletionBanner>` component**

**Goal:** A banner that renders when the user's profile is missing
required fields. Has a CTA button that triggers an `onComplete`
callback.

**Requirements:** R7

**Dependencies:** Unit 2.

**Files (target repo: `@aquaveo/geoglows-auth`):**
- Create: `src/react/ProfileCompletionBanner.tsx`
- Modify: `src/react/index.ts` — re-export.
- Test: `tests/react/ProfileCompletionBanner.test.tsx`

**Approach:**
- Props: `profile` (Profile, may be partial), `onComplete?()`,
  `onDismiss?()`, `dismissible?` (default true), `message?`,
  `ctaLabel?`.
- Internally calls `isProfileComplete(profile)`. If true, returns
  null (renders nothing). If false, renders an inline banner.
- Customizable copy via `message` and `ctaLabel`.
- `role="alert"` and `aria-label` for accessibility.

**Test scenarios:**
- Happy path: Complete profile → banner returns null.
- Happy path: Incomplete profile → banner renders; click CTA →
  `onComplete` fires.
- Edge case: `dismissible={false}` → no dismiss button; banner
  persists.
- Edge case: Click dismiss → `onDismiss` fires.

**Verification:**
- All test scenarios pass.

---

- [ ] **Unit 7: Library version bump and publish**

**Goal:** Cut `@aquaveo/geoglows-auth@0.3.0` and publish.

**Requirements:** R9

**Dependencies:** Units 2, 3, 4, 5, 6.

**Files (target repo: `@aquaveo/geoglows-auth`):**
- Modify: `package.json` — `0.2.0` → `0.3.0`.
- Modify: `README.md` — note the additions and the breaking removals.
- Modify: `docs/adapters.md` — add a "What's new in 0.3.0" section
  listing both new fields/components AND the removed org surface.

**Approach:**
- Conventional version-bump commit.
- `npm publish`. Tag `v0.3.0`.

**Test expectation:** none — release work.

**Verification:**
- `npm view @aquaveo/geoglows-auth versions` includes `0.3.0`.

---

### Phase 4: Portal vanilla UI — `apps.geoglows`

- [ ] **Unit 8: Sign-up modal — collect first_name and last_name**

**Goal:** Add two text fields to the email/password sign-up branch
of the modal. OAuth flow is unchanged (provider-supplied names flow
through `ensureProfile` automatically).

**Requirements:** R1

**Dependencies:** Units 1, 2.

**Files (target repo: `apps.geoglows`):**
- Modify: `src/ui/signInModal.js` — in the `mode === "signUp"`
  branch, render First Name + Last Name inputs above the email
  input. Pass them to `supabase.auth.signUp({ email, password,
  options: { data: { first_name, last_name } } })`. The
  `ensureProfile` call after sign-in will pick those up from
  `user_metadata` and populate the profile row.

**Approach:**
- Validation: required, trim, non-empty.
- Submit payload includes `options.data.first_name` and
  `options.data.last_name`.
- The modal stays compact (4 fields total in sign-up mode: first,
  last, email, password).
- Sign-in mode (existing user) stays at 2 fields.

**Test scenarios:**
- Happy path: Fill all 4 fields, submit → `signUp` called with
  the right options.data; `onAuthStateChange` SIGNED_IN fires;
  `ensureProfile` writes the profile with first/last set.
- Edge case: Empty first_name → validation alert; signUp not called.
- Edge case: Switch to "Sign in" mode → only email + password
  visible.

**Verification:**
- Manual end-to-end on a Vercel preview.

---

- [ ] **Unit 9: Profile page (replaces / repurposes the workspace page)**

**Goal:** A dedicated profile page where users view and edit their
profile data. Replaces the org-centric workspace page.

**Requirements:** R4, R5, R6, R7

**Dependencies:** Units 1, 2, 8.

**Files (target repo: `apps.geoglows`):**
- Modify (or rename): `src/ui/workspacePage.js` →
  `src/ui/profilePage.js`. Remove the "Create organization" and
  membership UI; keep the shape of the page (header, content
  blocks).
- Modify: `src/main.js` — switch `currentPage` value `workspace` →
  `profile`. Hash route `#workspace` → `#profile`. Optional: keep
  `#workspace` redirecting to `#profile` for any old bookmarks.
- Modify: `src/ui/navbar.js` — rename the user-menu link
  "Workspace" → "Profile".
- Modify: `src/events.js` — drop org event handlers. Add the
  profile-edit event handlers.

**Approach:**
- Profile page sections:
  1. Header: avatar + display name + email
  2. Profile fields display (first, middle, last, phone, user type,
     address, link)
  3. "Edit profile" button → opens an edit form (modal or inline)
  4. Completion banner at the top of the page if
     `isProfileComplete(profile)` is false. Includes a "Complete
     profile" CTA that scrolls to / opens the edit form.
- Edit form HTML: same field set as the React `<ProfileEditForm>`
  but vanilla JS. Submit calls `updateProfile`.
- After save, refresh `appState.account.profile` so the page
  re-renders with new values.

**Test scenarios:**
- Manual: Navigate to `#profile` → page shows current profile or
  "complete your profile" banner if incomplete.
- Manual: Click "Edit profile" → form opens pre-filled.
- Manual: Edit a field, save → form closes, page reflects the new
  value.
- Manual: User with incomplete profile → banner visible; click CTA →
  edit form opens.
- Manual: Home page (`#apps`) shows NO banner.

**Verification:**
- Manual end-to-end on a Vercel preview.

---

- [ ] **Unit 10: Bump `@aquaveo/geoglows-auth` to `^0.3.0` in apps.geoglows**

**Goal:** Pick up the new library version and remove the local code
that referenced removed exports.

**Requirements:** R9 (consumer side)

**Dependencies:** Units 7, 9.

**Files (target repo: `apps.geoglows`):**
- Modify: `package.json` — `^0.2.0` → `^0.3.0`.
- Modify: `package-lock.json` — regenerated.
- Modify: `src/account.js` — drop `createOrganization`,
  `selectActiveOrg`, `loadAccountSummary` org parts (which now
  return only `{ profile }`). Drop import of `OrgRole` etc.
- Modify: `src/profile.js` — re-export `updateProfile`,
  `isProfileComplete` from the library.

**Test expectation:** none — dependency bump.

**Verification:**
- `npm install` resolves `0.3.0`.
- Build clean.
- Manual end-to-end works.

## System-Wide Impact

- **Interaction graph:** `bootstrapSession` continues to call
  `ensureProfile`. The hardened `ensureProfile` (Unit 2) does not
  overwrite user-edited fields. Verified by Phase 2 tests.
- **Error propagation:** `updateProfile` errors propagate to the
  form's `onError` callback. The form surfaces a generic message;
  consumers can log the raw error.
- **State lifecycle risks:** None. New columns are nullable and
  additive. Existing rows remain valid.
- **API surface parity:** The library's React forms and the
  vanilla portal forms must keep their field sets in sync. Drift
  surfaces as "feature works in aquiferx but not the portal" or
  vice versa. The shared `Profile` type catches schema-level drift
  at compile time.
- **Integration coverage:** `bootstrapSession` after profile update
  is not automatic — the form's success path explicitly refreshes
  `appState`. Test scenario in Unit 9 covers it.
- **Unchanged invariants:** Auth flow (sign-in modal,
  OAuth redirect, sign-out) is largely unchanged; only the sign-up
  mode adds two fields. RLS for `profiles` stays per-user. The
  `bootstrapSession`, `getUserDisplayInfo`, `signInWithOAuth`,
  `signInWithPassword`, `signInWithMagicLink` APIs all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| **Dropping `organizations` / `org_memberships` is destructive.** Any rows in those tables are lost. | Confirm with the user (or check via SQL) that the existing rows are test data from the Cognito era. If any are load-bearing, write a small backup-export step before the migration. |
| **`ensureProfile` hardening regresses something.** If the OAuth provider updates the user's email, we want it propagated; if we updated too much, user-edited names get clobbered. | Test scenarios in Unit 2 lock down the contract: `email` and `avatar_url` update on conflict; everything else does not. |
| **Library `0.3.0` removes types and helpers some consumer might be using.** Apps.geoglows is the only known consumer; aquiferx hasn't adopted org helpers. But a third-party fork might. | The breaking removals are documented in the release notes (`docs/adapters.md` "What's new in 0.3.0"). Consumers pin `^0.2.0` so they don't auto-upgrade. The next aquiferx adoption is a deliberate version bump. |
| **Form drift between React and vanilla.** Two implementations of the same form will eventually drift. | Shared `Profile` type catches schema-level drift. UI drift is acceptable for v1; can extract a JSON form schema later. |
| **OAuth users skip the profile setup flow.** They sign in via Google, the navbar shows their name (from `display_name`), but `first_name` / `last_name` are still null because the provider's `full_name` doesn't always split cleanly. | The completion banner on the profile page nags them. Acceptable for v1. If users avoid the profile page, they live with `display_name` and that's fine — no feature requires structured names. |

## Documentation / Operational Notes

- **Library v0.3.0 release notes** in `docs/adapters.md` — both the
  additions (new fields, components, helpers) and the breaking
  removals (org surface).
- **Schema migration**: `supabase db push` should apply the new
  migration cleanly from a clean state. Run on a staging Supabase
  project first to verify the org-table drops don't surface anything
  unexpected.
- **No env-var changes** for either repo.
- **Deployment order:**
  1. Apply schema migration (Unit 1) to production Supabase.
  2. Publish library `0.3.0` (Unit 7).
  3. Bump portal dependency to `^0.3.0` and ship Phase 4 changes.
  4. Aquiferx adoption (separate plan).

## Sources & References

- Origin: User clarification of plan 003's earlier draft, asking for
  per-user RLS, removal of orgs, and minimal required signup fields.
- Sign-up form mock:
  `/mnt/c/Users/gromero/Documents/ShareX/Screenshots/2026-04/msedge_MOIRnSSgua.png`
  (used to identify candidate fields; org section now ignored
  per Decision D).
- Workspace screenshot:
  `/mnt/c/Users/gromero/Documents/ShareX/Screenshots/2026-04/msedge_4Y6KfE5Htk.png`
  (the page being repurposed as Profile).
- Migration plan that this builds on:
  `docs/plans/2026-04-28-002-refactor-cognito-to-supabase-auth-plan.md`
- Library types: `../../../geoglows-auth/src/types.ts`
- Library docs: `../../../geoglows-auth/docs/adapters.md`
