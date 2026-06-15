---
title: Upgrade @aquaveo/geoglows-auth to ^0.2.0
type: chore
status: superseded
superseded_by: docs/plans/2026-04-28-002-refactor-cognito-to-supabase-auth-plan.md
date: 2026-04-28
---

> **Superseded.** This plan was written under a wrong premise (that
> `apps.geoglows` would stay on Cognito). The real goal is migrating
> to Supabase Auth — see the linked plan above.


# Upgrade `@aquaveo/geoglows-auth` to `^0.2.0`

## Overview

`@aquaveo/geoglows-auth@0.2.0` ships a new Supabase Auth adapter, a rewritten
`<SupabaseAuthUI>` form, and removes two deprecated peer dependencies. None of
those changes affect `apps.geoglows`'s actual usage — the portal is a vanilla
JavaScript Vite app that consumes only the **core** module (Cognito adapter,
Supabase factory, profile/account helpers, session bootstrap, display utils).
This plan covers the minimal mechanical work needed to pick up the new version
on the consumer side.

## Problem Frame

`apps.geoglows` currently pins `"@aquaveo/geoglows-auth": "^0.1.2"`. Under
SemVer rules for pre-1.0 packages, `^0.1.2` resolves to `>=0.1.2 <0.2.0`, so
`npm install` will not pick up `0.2.0` automatically. The dependency must be
bumped explicitly. After the bump, no application code changes are required —
the Cognito-only paths used by this consumer are fully backward compatible
in `0.2.0`.

## Requirements Trace

- **R1.** `apps.geoglows` resolves `@aquaveo/geoglows-auth@^0.2.0` (or pinned
  `0.2.0`) after `npm install`.
- **R2.** No application source files require modification — the Cognito
  adapter API, Supabase factory signature for the `auth`-provided case, and
  every `core/*` import (`bootstrapSession`, `ensureProfile`,
  `loadAccountSummary`, `createOrganization`, `setActiveOrgId`,
  `getUserDisplayInfo`) are unchanged.
- **R3.** The portal builds successfully (`npm run build`) and runs locally
  (`npm run dev`) with the upgraded library.
- **R4.** Sign-in via Cognito hosted UI continues to work end-to-end (no
  regression in `bootstrapSession` flow or the post-sign-in `refresh()`
  cycle).

## Scope Boundaries

- **Not adopting** `createSupabaseAuthAdapter` or `<SupabaseAuthUI>` — the
  portal stays on Cognito.
- **Not changing** Cognito configuration, redirect URIs, or any environment
  variables.
- **Not adding** the `@supabase/auth-ui-react` / `@supabase/auth-ui-shared`
  packages — they were never required by `apps.geoglows` and remain
  irrelevant.
- **Not modifying** the React UI components that ship inside the library
  (the portal does not import any `/react` subpath).

## Context & Research

### Relevant Code and Patterns

- `package.json` — single line to update: the `dependencies` entry for
  `@aquaveo/geoglows-auth`.
- `package-lock.json` — currently references `"file:../geoglows-auth"`
  (workspace-style local link). When bumping, decide whether to keep the
  local link or switch to the published registry version.
- `src/auth.js` — wraps `createOidcAuthAdapter`. The adapter's interface
  and config shape are identical between `0.1.x` and `0.2.0`.
- `src/supabase.js` — calls `createGeoglowsSupabaseClient({ url,
  publishableKey, auth, useIdToken: true })`. The `auth` argument is now
  optional in `0.2.0` but still accepts the existing call shape.
- `src/main.js`, `src/profile.js`, `src/account.js`,
  `src/ui/workspacePage.js`, `src/ui/navbar.js` — all import only from
  `@aquaveo/geoglows-auth/core`. None of these surfaces changed in `0.2.0`.

### Library Migration Notes Reference

- `geoglows-auth/docs/adapters.md` § "Upgrading from `0.1.x` to `0.2.x`"
  — the upstream migration guide. Most of it (prop changes, `onAuthEvent`,
  visible error contract) is React-UI-only and does not apply to
  `apps.geoglows`. The relevant sections are: "Removed peer dependencies"
  (informational; never installed here) and the implicit unchanged-Cognito
  path (no migration needed).

## Key Technical Decisions

- **Decision:** Bump the version specifier to `^0.2.0` rather than pinning
  to `0.2.0` exactly.
  **Rationale:** Allows automatic uptake of patch releases (`0.2.x` bug
  fixes) without manual intervention while still locking out the next
  breaking minor (`0.3.0`).

- **Decision:** Resolve from the npm registry, not from the local
  `file:../geoglows-auth` link.
  **Rationale:** Production deploys (Vercel) install from npm. The local
  link is convenient for in-progress development but means CI builds use
  whatever the local checkout looks like at install time — a portability
  hazard. After publishing `0.2.0` to npm, switch this consumer to the
  registry version so the deployed artifact matches the published version.

- **Decision:** No code changes are made to `src/`.
  **Rationale:** R2. Every API the consumer touches is unchanged in
  `0.2.0`. Touching code that does not need to change introduces risk
  without benefit.

## Open Questions

### Resolved During Planning

- **Does `apps.geoglows` import anything from `/react`?** No. Confirmed
  via grep — all imports use the `/core` subpath.
- **Does `apps.geoglows` rely on `onAuthEvent`, `<SupabaseAuthUI>`, or
  `appearance`?** No. None of these surfaces are referenced.
- **Will the `auth`-provided path of `createGeoglowsSupabaseClient` keep
  the same behavior?** Yes. The factory now branches on whether `auth` is
  provided; the Cognito-using path (where `auth` is passed) is unchanged.

### Deferred to Implementation

- **Whether to publish `0.2.0` to npm before bumping the consumer.** This
  plan assumes the registry has `0.2.0` available. If the npm publish is
  blocked (e.g., publish-permissions issue on the `@aquaveo` scope),
  either: (a) hold this consumer upgrade until the publish lands, or (b)
  keep the `file:../geoglows-auth` local link and bump when the registry
  publishes. Decide at execution time based on the publish status.
- **Whether to also delete the local `file:` link in `package-lock.json`
  for clarity.** Depends on the developer workflow. If multiple
  contributors expect to develop the auth library in lockstep with the
  portal, keep the link; otherwise prefer the registry version.

## Implementation Units

- [ ] **Unit 1: Bump dependency version**

**Goal:** Update `package.json` to require `^0.2.0` and refresh the lockfile.

**Requirements:** R1

**Dependencies:** `@aquaveo/geoglows-auth@0.2.0` available on npm registry
(blocked on the publish). If publish is delayed, run from the local link
(see Decision #2 + Deferred questions).

**Files:**
- Modify: `package.json` (single line in `dependencies`)
- Modify: `package-lock.json` (regenerated)

**Approach:**
- Change the version specifier from `"^0.1.2"` to `"^0.2.0"`.
- Run `npm install` to refresh the lockfile from the registry. If the
  current lockfile uses `"file:../geoglows-auth"`, this also moves the
  resolution to the npm registry (matching the production behavior).

**Test expectation:** none -- pure dependency bump.

**Verification:**
- `npm ls @aquaveo/geoglows-auth` shows `0.2.0` (or a `0.2.x` patch).
- `package-lock.json` no longer contains `"file:../geoglows-auth"` for
  the `@aquaveo/geoglows-auth` entry.

---

- [ ] **Unit 2: Verify build and runtime smoke test**

**Goal:** Confirm the portal builds and runs unchanged after the upgrade.

**Requirements:** R3, R4

**Dependencies:** Unit 1.

**Files:**
- No source changes.

**Approach:**
- Run `npm run build` and confirm Vite emits the bundle without errors or
  type warnings related to the auth library.
- Run `npm run dev` and walk through:
  1. Land on `/`. The portal home renders.
  2. Click "Sign in" → Cognito hosted UI redirect fires.
  3. Complete sign-in → return to the portal at `/?code=...`.
  4. `bootstrapSession` walks `bootstrapping → processing_callback →
     authenticated → loading_profile → loading_account → ready`.
  5. Profile/org data appears in the navbar / workspace page.
- Sign out via the user menu and confirm the redirect.

**Test scenarios:**
- Integration: Cognito sign-in flow completes end-to-end against the
  upgraded library — same behavior as `0.1.2`.
- Edge case: Anonymous user (no session) lands on the portal home and
  sees the sign-in CTA, no console errors.

**Verification:**
- Build emits with no library-related warnings.
- Manual sign-in / sign-out flow succeeds in the dev server.
- Browser console shows no breakage in the AuthProvider lifecycle.

---

- [ ] **Unit 3: Verify aquiferx sub-app still loads through the portal rewrite**

**Goal:** Confirm the portal's `/aquifer-analyst/*` rewrite to the aquiferx
deployment still works after the upgrade. Aquiferx will (separately) be
upgraded to use the same `0.2.0` library.

**Requirements:** R3, R4

**Dependencies:** Unit 1, Unit 2.

**Files:**
- No source changes.

**Approach:**
- Run `npm run dev` and navigate to `/aquifer-analyst/`. The Vercel rewrite
  is production-only; in dev, the portal home alone is sufficient — but
  the navbar's link to aquiferx should still point at the right path.
- After deploying to a preview environment, click into Aquifer Analyst from
  the portal and confirm the cross-app session is still seamless (single
  sign-on still works because both apps use the same Cognito client and
  share `localStorage` on the parent domain).

**Test scenarios:**
- Integration: Sign in on the portal, navigate to `/aquifer-analyst/` —
  the user is signed in there too without re-prompting. (This depends on
  aquiferx using a compatible auth library version; once aquiferx is also
  bumped to `0.2.0`, the SSO behavior is preserved by construction.)

**Verification:**
- The portal's link to aquiferx still navigates correctly.
- After aquiferx is upgraded separately, signed-in state persists across
  the two apps (verified manually on a preview deploy).

## System-Wide Impact

- **Interaction graph:** No callbacks, middleware, or observers on the
  `apps.geoglows` side change. The library's internal seams are unchanged
  for Cognito-using consumers.
- **Error propagation:** No change. `bootstrapSession`'s `'error'` state
  semantics are identical between `0.1.x` and `0.2.0`.
- **State lifecycle risks:** None. localStorage keys (`oidc.user:*` for
  Cognito, `geoglows.activeOrgId` for the active-org cookie) are
  unchanged.
- **API surface parity:** No public surface of `apps.geoglows` changes;
  this is a pure dependency upgrade.
- **Integration coverage:** The cross-app SSO flow (portal ⇄ aquiferx)
  depends on both apps being on a compatible library version. Bumping
  one without the other should still work (the Cognito JWT and
  localStorage layout are unchanged), but the safest sequencing is to
  upgrade both consumers in close succession.
- **Unchanged invariants:** Cognito redirect URIs, env vars, the
  `profiles`/`org_memberships`/`organizations` schema in Supabase, and
  the RLS policies are all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| The npm publish for `@aquaveo/geoglows-auth@0.2.0` is blocked (publish-permissions issue on the `@aquaveo` scope). | The upgrade can still proceed against the local `file:../geoglows-auth` link until the publish lands. Bump `package.json` to `0.2.0`, but keep `package-lock.json` resolution as-is until the registry has the version. |
| Aquiferx is on `0.1.x` while the portal is on `0.2.0` (or vice versa). | The two apps share Cognito sessions via `localStorage`, which is unchanged between versions. SSO remains intact. The mismatch is only a maintenance concern — schedule the aquiferx upgrade as a follow-up. |
| Vercel build fails because the local `file:` link is not present in CI. | After publishing to npm and `npm install`-ing locally, the lockfile's `resolved` field switches to the registry URL. Verify with `cat package-lock.json | grep aquaveo/geoglows-auth | head -3` before pushing. |
| A patch release introduces a regression. | `^0.2.0` allows patch updates; if an issue surfaces, pin to the last-good `0.2.x` version with `"@aquaveo/geoglows-auth": "0.2.0"` until investigated. |

## Documentation / Operational Notes

- **Aquiferx companion upgrade.** A parallel plan is needed for `aquiferx`
  to bump the same dependency. Aquiferx uses both `/core` and `/react`
  subpaths, so its upgrade has a slightly larger surface — but in the
  current code (looked at earlier in this branch), it imports
  `createOidcAuthAdapter` and `createGeoglowsSupabaseClient` from `/core`
  and does not yet use `<SupabaseAuthUI>`. So aquiferx is also a pure
  dependency-bump upgrade today, with the option to adopt the new UI
  later.
- **No deploy-config changes required.** Vercel project env vars,
  `vercel.json`, build commands, and routing rules are unaffected.
- **No CHANGELOG to update on this side.** The library's own
  `docs/adapters.md` carries the migration notes; consumers reference
  it rather than maintaining their own copy.

## Sources & References

- Library plan: `../geoglows-auth/docs/plans/2026-04-23-001-feat-supabase-auth-adapter-plan.md`
- Library refactor plan: `../geoglows-auth/docs/plans/2026-04-28-001-refactor-supabase-auth-ui-form-plan.md`
- Migration guide: `../geoglows-auth/docs/adapters.md` § "Upgrading from `0.1.x` to `0.2.x`"
- Library v0.2.0 merge commit: `Aquaveo/geoglows-auth@398843f`
