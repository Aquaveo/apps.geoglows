---
title: "feat: Add forgot-password flow to aquiferx (React surface)"
type: feat
status: complete
date: 2026-04-30
reviewed: 2026-04-30
completed: 2026-04-30
origin: docs/plans/2026-04-30-002-feat-forgot-password-flow-plan.md
---

# feat: Add forgot-password flow to aquiferx (React surface)

## Overview

Extend `@aquaveo/geoglows-auth` with React-side primitives for the password-recovery flow that shipped vanilla in 1.2.0, then wire aquiferx to use them. The vanilla plan ([origin](2026-04-30-002-feat-forgot-password-flow-plan.md)) explicitly deferred aquiferx because `<SupabaseAuthUI>` is a separate React component with a different state model.

Two new lib primitives — `<PasswordResetForm>` (request a reset email) + `<SetNewPasswordForm>` (set the new password after the link click) — plus a "Forgot password?" link in the existing `<SupabaseAuthUI>`. aquiferx mounts the components in its existing native-`<dialog>` pattern (no router needed) and adds a `PASSWORD_RECOVERY` branch to its `onAuthStateChange` handler.

**Coverage scope (Q1 from doc-review):** aquiferx is reachable via two origins — `portal-dev.geoglows.org/aquifer-analyst/` (proxied; same-origin as the other portal apps) and `aquiferx-bay.vercel.app` (direct Vercel URL). Recovery emails redirect to `window.location.origin` of WHEREVER the user was when they requested the reset. So users who request recovery from the proxied path complete it on apps.geoglows's already-shipped 1.2.0 modal; users who reach aquiferx via the direct URL (engineers, support tickets, deep-linked screenshots, bookmarks) complete it on aquiferx's new flow. **This plan exists for the direct-URL path** — a small but real population that needs an in-app recovery option instead of a dead end.

## Problem Frame

aquiferx (Aquaveo-controlled fork, React 19 + Vite + TypeScript) is the only production GEOGloWS sub-app where users reaching the app via the direct Vercel URL have no in-app password recovery. The vanilla apps already have the feature; users who reach aquiferx via the portal proxy are already covered (their recovery completes on apps.geoglows's 1.2.0 modal — see Coverage scope in Overview). This plan closes the direct-URL gap.

**Why build lib primitives instead of inlining in aquiferx:** The honest answer (per doc-review Q2 reframe):
1. **The lib has React test infrastructure** (vitest + jsdom + Testing Library + 22 `<SupabaseAuthUI>` tests as templates). aquiferx has none. Putting the components in the lib means they get tested for free.
2. **Cohesion** — `<SupabaseAuthUI>` stays a focused sign-in form; recovery views live as separate components. The plan does NOT add multi-view state to `<SupabaseAuthUI>`; only an `onForgotPasswordClick` callback prop.
3. **Positioning for hypothetical future React consumers** — secondary. Worth noting but not load-bearing.

What this plan does NOT claim: it does not "align vanilla and React surfaces" (vanilla can't consume React components — the surfaces stay separate). It does not "pay the Q3 architectural debt" from the origin plan (that decision was about MFA-or-8-views triggers neither of which has occurred). The new primitives are React-only, additive, and the vanilla modal stays as-is.

## Requirements Trace

- **R1.** A signed-out aquiferx user can request a password-reset email from the sign-in dialog ("Forgot password?" link in `<SupabaseAuthUI>`).
- **R2.** The reset-request flow shows a confirmation screen regardless of whether the email exists (enumeration resistance — same as vanilla).
- **R3.** A user who clicks the recovery link in their email lands on aquiferx and is auto-prompted to set a new password.
- **R4.** Setting a new password completes through the lib's adapter; the dialog closes; the user is signed in with the new credential.
- **R5.** No `dangerouslySetInnerHTML` in the new views — JSX child escaping handles user-controlled values; XSS surface stays minimal.
- **R6.** Wrong-account protection (Q5 from origin): `<SetNewPasswordForm>` shows "Resetting password for `<email>`" using `useAuth().user.email` so a user on a shared/borrowed browser sees the identity swap before submitting.
- **R7.** Cross-app SSO is preserved when aquiferx is reached via the proxied portal path (same origin as apps.geoglows / grace / rfs). Recovery completed via the direct-URL path establishes a session scoped to `aquiferx-bay.vercel.app` only — different origin, no shared localStorage. Documented limitation, not a regression.
- **R8.** `aquiferx/CLAUDE.md` and `geoglows-auth/CLAUDE.md` reflect the new components + corrected adapter info (the lib's CLAUDE.md currently says aquiferx is on Cognito — it's been on Supabase Auth since the migration).

## Scope Boundaries

- **No router introduction in aquiferx.** Adding `react-router` for one route is over-investment; the existing native-`<dialog>` pattern hosts the new components.
- **No vanilla-side refactor in this plan.** The vanilla `mountSignInModal`'s 3 new views (1.2.0) stay; the new lib primitives are React-only. A future plan can refactor the vanilla side to use shared logic if/when that's worth doing.
- **No MFA, no email-change, no account-link.** Out of scope.
- **No PKCE-flow support.** Implicit flow only, matching the vanilla plan. PKCE detection in aquiferx surfaces a clean error (same pattern as vanilla).
- **No new test infrastructure in aquiferx.** Tests for the new lib React components live in `geoglows-auth/tests/react/`. aquiferx wiring verified by `tsc --noEmit` + manual smoke.

### Deferred to Separate Tasks

- **Vanilla-side adoption of `<PasswordResetForm>` primitive** — vanilla `mountSignInModal` continues using its in-modal views. Refactor when MFA work begins or when the modal hits ~8+ views (per origin plan's Architectural Debt section).
- **Add vitest to aquiferx** — separate ops task; deferred unless this plan's manual verification proves insufficient.
- **PKCE-flow support in the lib** — same deferred direction as vanilla.

## Context & Research

### Relevant Code and Patterns

- **`aquiferx/auth.ts`** — adapter setup. Already on `createSupabaseAuthAdapter` with `defaultRedirectTo: window.location.origin`. Recovery is unblocked.
- **`aquiferx/App.tsx`**:
  - lines 5-6 — `{ UserMenu, SupabaseAuthUI, useAuth }` import + `auth` import from `./auth`
  - lines 199-235 — existing `useEffect` block subscribing to `onAuthStateChange`. Currently handles `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`. **Needs new `PASSWORD_RECOVERY` branch.**
  - lines 212-220 — documented StrictMode/HMR cleanup pattern for native `<dialog>` — the new flow reuses this pattern.
  - lines 2060-2075 — sign-in dialog: `<dialog>` controlled by `signInModalOpen` state, ref `signInDialogRef`, contents wrap `<SupabaseAuthUI adapter={auth} onSuccess={…} />`. **Same pattern hosts `<SetNewPasswordForm>` for the recovery flow.**
  - line 1375 — `<UserMenu>` mount point.
- **`aquiferx/index.tsx`** — minimal entry: `<SupabaseProvider>` + `<AuthProvider>` wrapping `<App />`. No router. No mount-time code that would need `PASSWORD_RECOVERY` handling above the `<App />` level.
- **`aquiferx/package.json`** — currently pins `@aquaveo/geoglows-auth: ^1.0.0`. Bump to `^1.3.0` after lib publishes.
- **`aquiferx/vercel.json`** — only the `/api/regions` rewrite. No SPA fallback (which is fine — no route changes).
- **`geoglows-auth/src/react/SupabaseAuthUI.tsx`** — current sign-in form. Supports `mode?: "password" | "magicLink"`. **Needs a "Forgot password?" link in the password mode** that calls a new `onForgotPasswordClick?: () => void` callback (consumer-driven view switch — keeps `SupabaseAuthUI` stateless about which view to render next).
- **`geoglows-auth/src/react/AuthProvider.tsx`** + `useAuth()` — exposes `{ user, profile, loading, refresh, signIn, signOut }`. New adapter methods (`resetPasswordForEmail`, `updateUserPassword`, `signOutOtherSessions`) are NOT exposed via `useAuth()` — consumers call them on the adapter directly. Same pattern for the new components: they accept `adapter` as a prop, not via the hook (matches `<SupabaseAuthUI>`'s shape).
- **`geoglows-auth/src/react/ProfileSetupForm.tsx`** — closest pattern for the new components. Inline `CSSProperties` styling (NOT Tailwind), `useState` for fields, `pending` state, `onSuccess` / `onError` callbacks, generic error string + raw Error to caller. **Mirror this shape for `<PasswordResetForm>` and `<SetNewPasswordForm>`.**
- **`geoglows-auth/src/react/index.ts`** — barrel; add new component exports here.
- **`geoglows-auth/tests/react/SupabaseAuthUI.test.tsx`** + **`geoglows-auth/tests/react/ProfileSetupForm.test.tsx`** — vitest + jsdom + Testing Library. Mirror these for the new components' tests.
- **`apps.geoglows/docs/plans/2026-04-30-002-feat-forgot-password-flow-plan.md`** — origin plan. All Q1-Q6 strategic decisions carry over verbatim where applicable. The Architectural Debt section explicitly identifies aquiferx port as a trigger to introduce primitives.

### Institutional Learnings

- **`geoglows-auth/docs/solutions/best-practices/user-metadata-is-auth-identity-not-profile-of-record-2026-04-29.md`** — the "Resetting password for X" header (R6) must come from `useAuth().profile.display_name` or `user.email`, NEVER `user_metadata`. `user_metadata` is sign-up-time identity only; it can be stale.
- **`geoglows-auth/docs/solutions/logic-errors/ensureprofile-upsert-overwrites-user-edits-2026-04-29.md`** — recovery must NOT touch `core.profiles`. Only `auth.updateUser({ password })`. The post-recovery `SIGNED_IN` triggers `<AuthProvider>`'s `refresh()`, which calls `bootstrapSession` → `ensureProfile` (select-then-insert, safe — never overwrites).
- **`apps.geoglows/docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md`** — vanilla learning. **In React, JSX children auto-escape**, so this discipline transfers to a single rule: avoid `dangerouslySetInnerHTML` in the new components (R5).
- **The 1.2.0 forgot-password flow** (apps.geoglows + grace + rfs, smoke-tested 2026-04-30) — verified the implicit-flow recovery URL works on the production Supabase project, confirming the email template is correctly configured for the implicit flow. aquiferx will use the same Supabase project and benefits from this verification.

### External References

- [Supabase: Resetting a password](https://supabase.com/docs/guides/auth/passwords) — recovery flow; implicit vs PKCE.
- [`auth.onAuthStateChange`](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) — `PASSWORD_RECOVERY` fires during `_initialize()`, **before** `INITIAL_SESSION`.
- React 19 + Vite 6 + Tailwind v4 — aquiferx's stack per its `CLAUDE.md`.

## Key Technical Decisions

- **Build new lib primitives.** New components: `<PasswordResetForm>` and `<SetNewPasswordForm>`, each accepting an `adapter` prop, `onSuccess` / `onError` / `onCancel` callbacks. `<SupabaseAuthUI>` gains a single optional `onForgotPasswordClick?` callback (the consumer decides what to render when clicked — no internal view-switching). Primary motivation: lib has test infra; aquiferx doesn't. Secondary: keeps `<SupabaseAuthUI>` cohesive and positions for any future React consumer.
- **aquiferx hosts the components in its existing `<dialog>` pattern.** No router introduction. **Single `signInDialogRef`** with a content swap based on `signInView` state (one ref, not multiple). Reset to `"signIn"` on every dialog close.
- **`signInView` state union** is `"signIn" | "forgotPassword" | "resetEmailSent" | "setNewPassword" | "recoveryError"` — five views. `"resetEmailSent"` was missing in the original draft (G3) — added so `<PasswordResetForm>`'s `onSuccess` has a target. `"recoveryError"` for mount-time expired/PKCE detection.
- **`<SetNewPasswordForm>` reads the recovery user via `adapter.getCurrentUser()`** in its own `useEffect` on mount (mirrors vanilla). Does NOT rely solely on `useAuth().user.email` because `<AuthProvider>`'s `refresh()` is async and may not have resolved when the form first renders — leading to stale or empty email in the wrong-account header (B2). The local async fetch is the source of truth; `useAuth()` is an optimization read for the initial render. (Falls back: `profile.display_name` → fetched-email → generic "Resetting password" with a loud "unable to confirm account" warning if no email is available, NEVER `user_metadata`.)
- **`<SetNewPasswordForm>` performs the full `updateUserPassword` → `signOutOtherSessions` → success-message → close sequence internally**, mirroring the vanilla modal's behavior. Best-effort `signOutOtherSessions`; failure is logged, doesn't block close. ~1.5s success-message render before `onSuccess` fires (Q4 messaging — consistent with vanilla). The `setTimeout` MUST be cleaned up in the effect's cleanup return so unmount-during-linger does not fire `onSuccess` against torn-down state (G5).
- **PASSWORD_RECOVERY race mitigation (B1) — load-bearing:** synchronous URL-state detection at module-load time runs BEFORE Supabase JS's `_initialize()` consumes the hash. Required because Supabase fires `PASSWORD_RECOVERY` synchronously during `_initialize()`, before any React `useEffect` can register a listener — the event would otherwise be lost to zero subscribers. The detector lives in `geoglows-auth/src/core/recovery-url.ts` (lib-extracted; reusable across vanilla + React; pure URL parser with no Supabase dep, so no circular-dep risk). G4 resolved: lib-extract, not copy. Vanilla side adopts it in a follow-up.
- **The recovery-URL detector handles three cases:** valid recovery (`#type=recovery&access_token=…`) → flag for `setNewPassword` view; expired (`error_code=otp_expired`) → flag for `recoveryError` view; PKCE (`?code=&type=recovery`) → flag for `recoveryError` view + console.error.
- **Recovery hash stripping (G1)** — after consuming the recovery URL state, `aquiferx/index.tsx` calls `window.history.replaceState(null, '', window.location.pathname + window.location.search)` to strip the `#access_token=…` from browser history + Referer headers.
- **`onCancel` and dialog-close BOTH clear the recovery session (G2).** The `<dialog onClose>` handler in aquiferx's `App.tsx` checks `signInView`: if it's `"setNewPassword"` and the close was triggered without a successful submit, call `auth.signOutRedirect()` to invalidate the lingering recovery session. Native `<dialog>` Escape and backdrop click both fire `onClose`, so this covers all dismissal paths.
- **Lib version bump to 1.3.0** (minor, additive — new public exports). The `prepublishOnly` script runs `npm run build && npm test` automatically.
- **aquiferx pin** moves `^1.0.0` → `^1.3.0`. Pre-flight: `npm install --dry-run` + diff inspection of `geoglows-auth/src/react/index.ts` exports between 1.0.0 and 1.3.0 + `tsc --noEmit` on the bumped state. Done before Phase B kickoff.
- **Inline `CSSProperties` styling** for the new components, matching every other lib React component. aquiferx is Tailwind, but the lib's React components are NOT — accepted historical divergence.
- **No `<UserMenu>` changes.** Sign-out from `<UserMenu>` already exists; recovery doesn't change post-sign-in surfaces.
- **Update `geoglows-auth/CLAUDE.md` to reflect Supabase Auth as canonical** for ALL portal consumers — apps.geoglows + grace + rfs + aquiferx — since the Cognito-vs-Supabase distinction is historical only (Q3: Cognito is fully decommissioned across all consumers; CLAUDE.md still listing Cognito is purely stale documentation, not a runtime concern).

## Open Questions

### Resolved During Planning

- **Coverage scope (proxy vs direct origin)?** → Plan exists for the direct-URL path (`aquiferx-bay.vercel.app`). Proxy-path users are already covered by apps.geoglows's 1.2.0 modal. Documented in Overview + R3 + R7.
- **Where does the recovery view live in aquiferx — modal, route, or page?** → Modal (existing `<dialog>` pattern). No router introduction.
- **Build new primitives or extend `<SupabaseAuthUI>`?** → New primitives. Primary justification: lib has test infra; aquiferx doesn't. Honest framing per doc-review Q2.
- **`<SupabaseAuthUI>` API change for the "Forgot password?" link?** → Add `onForgotPasswordClick?: () => void` prop. Consumer-driven view switch. No internal view state.
- **`signInView` state shape?** → Five-value union: `"signIn" | "forgotPassword" | "resetEmailSent" | "setNewPassword" | "recoveryError"`. Single `signInDialogRef` with content swap; reset to `"signIn"` on every close.
- **"Check your email" confirmation view (R2)?** → New `"resetEmailSent"` value in the `signInView` union. aquiferx renders a confirmation message; copy: "If we have an account for `<email>`, we sent a link to reset your password. Click the link in the email to choose a new password." Includes "Back to sign in" button. Enumeration-resistant (matches vanilla).
- **Mount-time expired/PKCE error view?** → New `"recoveryError"` value in the `signInView` union. aquiferx renders a static React component that mirrors the vanilla modal's `recoveryError` body copy (corporate-gateway hint + `mailto:gromero@aquaveo.com` + "Send a new link" CTA). The same view also renders when `<SetNewPasswordForm>` fires `onExpired` after submit. Single source of view definition.
- **`<SetNewPasswordForm>` `onExpired` vs internal handling?** → The form fires `onExpired` callback; aquiferx swaps `signInView` to `"recoveryError"`. Form does NOT render expired UX itself. Single rendering surface.
- **Lib version bump?** → 1.3.0 (minor, additive).
- **Implicit vs PKCE flow?** → Implicit (matches vanilla). PKCE detector surfaces a clean error via `"recoveryError"` view.
- **Sign-out-others UX?** → Messaged yes (matches vanilla Q4): "We've signed you out on other devices for safety." rendered for ~1.5s before close. `setTimeout` cleaned up on unmount (G5).
- **Wrong-account header?** → Yes (matches vanilla Q5): `<SetNewPasswordForm>` calls `adapter.getCurrentUser()` in a `useEffect` on mount and renders "Resetting password for `<email>`" once the email is available. Falls back to `profile.display_name` → generic "Resetting password" + "unable to confirm account" warning if no email is available. NEVER `user_metadata`.
- **Recovery hash stripping (G1)?** → Yes — `aquiferx/index.tsx` calls `window.history.replaceState` to strip `#access_token=…` after the URL detector consumes it.
- **Dismissal-clears-recovery-session (G2)?** → Yes — `App.tsx`'s `<dialog onClose>` checks `signInView`; if `"setNewPassword"` and no successful submit, calls `auth.signOutRedirect()`. Covers Escape, backdrop click, and explicit close button.
- **Corporate-gateway support fallback?** → Yes (matches vanilla Q1): `"recoveryError"` view body copy includes the `mailto:gromero@aquaveo.com` hint.
- **Test location?** → `geoglows-auth/tests/react/PasswordResetForm.test.tsx` and `tests/react/SetNewPasswordForm.test.tsx`. aquiferx has no test infra; lib-side coverage + manual smoke is sufficient.
- **PASSWORD_RECOVERY listener placement?** → Existing `useEffect` in `App.tsx:199-235` for the live event, AND synchronous URL detection in `aquiferx/index.tsx` (or `auth.ts`) at module-load as the race-proof safety net (B1). The URL detector is mandatory, not optional — it's the only thing that catches the listener-registration race.
- **PKCE / expired-token URL detector lib-extracted or copied?** → **Lib-extracted to `geoglows-auth/src/core/recovery-url.ts`** (G4). Pure URL parser, no Supabase client dep, no circular-dep risk. Reusable by vanilla + React consumers.
- **Cognito-vs-Supabase production state?** → Confirmed all portal apps including aquiferx are on Supabase Auth in production (Cognito fully decommissioned). The lib's CLAUDE.md "Cognito" reference is stale documentation only. Update CLAUDE.md as part of Unit 4.

### Deferred to Implementation

- **Exact prop names** (`onForgotPasswordClick` vs `onForgotPassword` etc.) — pick during component author.
- **`<SupabaseAuthUI>` test updates** — when adding `onForgotPasswordClick`, confirm the test in `geoglows-auth/tests/react/SupabaseAuthUI.test.tsx` covers the link rendering + click; pick exact assertion shape during implementation.
- **Visual treatment of the success-linger message in `<SetNewPasswordForm>`** — replace form body with message vs. show alongside disabled form. Mirror whatever the vanilla success state visually does.
- **Focus management on view transitions in aquiferx's dialog** — first focusable input should receive focus on every view switch. Implementation detail; pick during wiring.

## Implementation Units

### Phase A — Lib (`@aquaveo/geoglows-auth`)

- [x] **Unit 0: Lib primitive — synchronous recovery-URL parser**

**Goal:** Extract the recovery-URL detection logic from `apps.geoglows/src/auth-events.js` into a typed, lib-exported helper. Reusable by aquiferx (Unit 6) and any future consumer (vanilla side will adopt later).

**Requirements:** B1 (PASSWORD_RECOVERY race mitigation), prerequisite for R3, R4.

**Dependencies:** None. Pure URL parser; no Supabase dep, no React dep, no circular-dep risk.

**Files:**
- Create: `geoglows-auth/src/core/recovery-url.ts`
- Modify: `geoglows-auth/src/core/index.ts` (export `detectRecoveryUrlState`)
- Test: `geoglows-auth/tests/core/recovery-url.test.ts`

**Approach:**
- Function signature: `detectRecoveryUrlState({ hash: string, search: string }): { kind: "valid" | "expired" | "pkce-unsupported" | "none" }`.
- Three flag detections via regex:
  - `expired`: `error_code=otp_expired` in hash or search
  - `pkce-unsupported`: `code=` AND `type=recovery` in same string
  - `valid`: `access_token=` AND `type=recovery` in hash (implicit flow)
- Precedence: `expired` > `pkce-unsupported` > `valid` > `none`.
- Pure function. No side effects. Synchronous.

**Execution note:** Test-first.

**Patterns to follow:**
- `apps.geoglows/src/auth-events.js` `detectRecoveryUrlState` (existing pattern; this unit promotes it from JS-with-3-states to TS-with-4-states).

**Test scenarios:**
- *Happy path:* `#access_token=ey...&type=recovery` returns `{ kind: "valid" }`.
- *Happy path:* `#error_code=otp_expired&error=access_denied` returns `{ kind: "expired" }`.
- *Happy path:* `?code=abc&type=recovery` returns `{ kind: "pkce-unsupported" }`.
- *Happy path:* empty hash + search returns `{ kind: "none" }`.
- *Edge case:* normal OAuth callback `?code=abc&state=xyz` (no `type=recovery`) returns `{ kind: "none" }` (NOT pkce-unsupported).
- *Edge case:* hash with both expired AND pkce-shape — `expired` wins.
- *Edge case:* `type=recovery` without any token returns `{ kind: "none" }` (no actionable signal).

**Verification:**
- 7 new test cases pass.

---

- [x] **Unit 1: New lib primitive — `<PasswordResetForm>`**

**Goal:** Add a React component that renders the request-reset form: email input, submit, "Back to sign in" affordance. Calls `adapter.resetPasswordForEmail(...)`. On success, fires `onSuccess(email)` so the consumer can switch to a confirmation view.

**Requirements:** R1, R2.

**Dependencies:** None (lib internal — adapter methods already exist as of 1.2.0).

**Files:**
- Create: `geoglows-auth/src/react/PasswordResetForm.tsx`
- Modify: `geoglows-auth/src/react/index.ts` (export new component + types)
- Test: `geoglows-auth/tests/react/PasswordResetForm.test.tsx`

**Approach:**
- Props: `adapter: SupabaseAuthAdapter`, `redirectTo?: string`, `onSuccess?: (email: string) => void`, `onError?: (error: Error) => void`, `onCancel?: () => void`.
- `useState` for email + pending. Generic error string surfaced inline (`role="alert"`); enumeration-resistant (no "user not found" surfaced).
- Submit calls `adapter.resetPasswordForEmail({ email, redirectTo })`; on success, fire `onSuccess(email)` so the parent renders its own confirmation. Component itself does NOT render a "check your email" view — that's the parent's responsibility (matches the consumer-driven design of `<SupabaseAuthUI>`).
- Inline `CSSProperties` styling matching `ProfileSetupForm`.
- All user-controlled values rendered as JSX children (no `dangerouslySetInnerHTML`).

**Execution note:** Test-first.

**Patterns to follow:**
- `geoglows-auth/src/react/ProfileSetupForm.tsx` — form layout, error handling, pending state, success/error callbacks, inline styling.
- `geoglows-auth/src/react/SupabaseAuthUI.tsx` — adapter prop pattern.

**Test scenarios:**
- *Happy path:* render with mock adapter; type email; submit; assert `adapter.resetPasswordForEmail` called with the email + configured `redirectTo`; assert `onSuccess` called with the email.
- *Edge case:* submit empty email; adapter NOT called; inline error message rendered; `onError` NOT called (validation is local).
- *Error path:* adapter rejects; assert generic error string rendered (NOT the raw Supabase error message); `onError` called with the raw `Error`.
- *Edge case (XSS regression):* email value contains `<img onerror=…>`; assert no `<img>` tag in DOM (JSX auto-escape verifies; sentinel test).
- *Cancel:* click "Back to sign in" → `onCancel` fires; adapter NOT called.

**Verification:**
- 5 new test cases pass; existing 22 SupabaseAuthUI tests still pass.

---

- [x] **Unit 2: New lib primitive — `<SetNewPasswordForm>`**

**Goal:** Render the new-password form for the post-recovery flow. Includes wrong-account header (R6), the `updateUserPassword → signOutOtherSessions → success-message` sequence (R4 + Q4), expired-session error transition (R3 sad path), and corporate-gateway support fallback in the error view (Q1).

**Requirements:** R3, R4, R5, R6.

**Dependencies:** Unit 1 (proves the primitive shape).

**Files:**
- Create: `geoglows-auth/src/react/SetNewPasswordForm.tsx`
- Modify: `geoglows-auth/src/react/index.ts`
- Test: `geoglows-auth/tests/react/SetNewPasswordForm.test.tsx`

**Approach:**
- Props: `adapter: SupabaseAuthAdapter`, `onSuccess?: () => void`, `onError?: (error: Error) => void`, `onCancel?: () => void`, `onExpired?: () => void` (optional; consumer can decide if expired transitions to its own error view or the component renders one).
- Reads recovery email via `adapter.getCurrentUser()` in a `useEffect` on mount, storing in local state (B2). Does NOT rely solely on `useAuth().user.email` — the recovery session may not be hydrated in `<AuthProvider>`'s state when the form first renders. Falls back: fetched-email → `useAuth().profile?.display_name` → generic "Resetting password" + "unable to confirm account" warning if no email available. NEVER `user_metadata`. Renders "Resetting password for `<email>`" header once email is available.
- `useState` for password, pending, success-message-visible. JSX-only rendering; no `dangerouslySetInnerHTML`.
- Submit flow:
  1. Validate password non-empty.
  2. Call `adapter.updateUserPassword({ password })`. On success, continue. On error: classify (auth-error → call `onExpired` for consumer-driven view swap; validation-error → render generic inline error).
  3. Call `adapter.signOutOtherSessions()` best-effort (catch + log; don't block).
  4. Render inline "Password updated. We've signed you out on other devices for safety." for ~1.5s — `setTimeout` registered with `useRef` so unmount (G5) cleans it up via the effect's cleanup return.
  5. Fire `onSuccess()` — but ONLY if the component is still mounted. Use the same `useRef` pattern.
- **`onExpired` callback fires on auth-error during `updateUserPassword`** — consumer (aquiferx) swaps `signInView` to `"recoveryError"` to render the corporate-gateway hint + mailto fallback. Form does NOT render the expired UX itself — single rendering surface in the consumer.
- "Back to sign in" affordance — calls `onCancel`. Consumer (aquiferx) is responsible for clearing the recovery session via `adapter.signOutRedirect()` (G2). Also covered by aquiferx's `<dialog onClose>` handler for Escape and backdrop dismissal — single mitigation, multiple entry points.

**Execution note:** Test-first.

**Patterns to follow:**
- `<PasswordResetForm>` (Unit 1) for shape.
- The vanilla `setNewPassword` view in `geoglows-auth/src/core/sign-in.ts` for the submit-flow sequence (auth vs validation error classification, success linger window, signOutOtherSessions best-effort).
- `geoglows-auth/src/react/AuthProvider.tsx` for `useAuth()` consumption.

**Test scenarios:**
- *Happy path:* render with mock adapter that returns a user via `getCurrentUser`; assert `useEffect` calls `adapter.getCurrentUser`; assert "Resetting password for `<email>`" header renders the fetched email; submit a new password; assert `updateUserPassword` then `signOutOtherSessions` called in order; assert success message renders; assert `onSuccess` fires after the linger window (`vi.useFakeTimers`).
- *Edge case (B2 race):* `adapter.getCurrentUser()` returns null on first call; assert form renders with "Resetting password" generic header + "unable to confirm account" warning; assert `onSuccess` is still callable when user submits.
- *Edge case (Q5 wrong-account):* `getCurrentUser` returns user with email `someone@else.com`; assert that exact email renders in the header.
- *Edge case (XSS):* email contains `<img onerror=…>`; assert no `<img>` tag (JSX auto-escape regression guard).
- *Edge case:* submit empty password; adapter NOT called; inline validation error.
- *Error path (validation):* `updateUserPassword` rejects with a non-auth error; generic inline error renders; component stays on the form.
- *Error path (auth-expired):* `updateUserPassword` rejects with `refresh_token_not_found`; assert `onExpired` callback fires; component does NOT render its own expired view (consumer handles it).
- *Error path (signOutOtherSessions failure):* `updateUserPassword` succeeds; `signOutOtherSessions` rejects; assert success message still renders; assert `onSuccess` still fires; assert `console.error` was called.
- *Edge case (G5 unmount-during-linger):* `updateUserPassword` succeeds; success message renders; `vi.useFakeTimers` advances 800ms (mid-linger); component unmounted; `vi.advanceTimersByTime(1000)` past the original 1500ms; assert `onSuccess` is NOT called after unmount (timer was cleaned up).
- *Cancel:* click "Back to sign in" → `onCancel` fires; adapter NOT called.

**Verification:**
- 8 new test cases pass; existing tests still pass.

---

- [x] **Unit 3: Extend `<SupabaseAuthUI>` with `onForgotPasswordClick` prop**

**Goal:** Add the entry point to recovery from the sign-in form. The link only renders when `onForgotPasswordClick` is provided AND `mode === "password"` (the toggle to magic-link doesn't need it).

**Requirements:** R1.

**Dependencies:** Unit 1 + Unit 2 (so the prop has somewhere meaningful to land).

**Files:**
- Modify: `geoglows-auth/src/react/SupabaseAuthUI.tsx`
- Modify: `geoglows-auth/tests/react/SupabaseAuthUI.test.tsx`

**Approach:**
- Add `onForgotPasswordClick?: () => void` to the component's props interface.
- Render a small `<button type="button">` with text "Forgot password?" beneath the password input when both conditions are met. Inline-styled (matches existing form styles).
- The button's `onClick` calls `onForgotPasswordClick`. The component does NOT change its own state — pure consumer-driven view switching.
- No new behavior in magic-link mode.

**Execution note:** Test-first.

**Patterns to follow:**
- The existing `mode` toggle in `<SupabaseAuthUI>` for conditional rendering.

**Test scenarios:**
- *Happy path:* render with `mode="password"` and an `onForgotPasswordClick` mock; click the button; assert mock was called once.
- *Edge case:* render with `mode="password"` and NO `onForgotPasswordClick`; assert the button does NOT render.
- *Edge case:* render with `mode="magicLink"` (and `onForgotPasswordClick` provided); assert the button does NOT render.

**Verification:**
- 3 new test cases pass; existing 22 `SupabaseAuthUI` tests still pass.

---

- [x] **Unit 4: Lib release — version bump to 1.3.0 + CHANGELOG**

**Goal:** Ship the new components.

**Requirements:** Release prerequisite for Phase B.

**Dependencies:** Units 1, 2, 3.

**Files:**
- Modify: `geoglows-auth/package.json` — version `1.2.0` → `1.3.0`.
- Modify: `geoglows-auth/CHANGELOG.md` — `[1.3.0]` entry covering: `<PasswordResetForm>`, `<SetNewPasswordForm>`, `<SupabaseAuthUI>` `onForgotPasswordClick` prop, AND `detectRecoveryUrlState` (Unit 0 export).
- Modify: `geoglows-auth/CLAUDE.md` — fix the stale "aquiferx — currently on Cognito" line (R8) — say all consumers are on Supabase Auth as of the 2026-04-29 migration; list the new React exports + the new `core/recovery-url.ts` module.

**Approach:**
- Minor bump (additive new public exports). No breaking changes to existing 1.2.0 surfaces.
- `prepublishOnly` runs `npm run build && npm test` automatically.

**Test scenarios:**
- Test expectation: none — pure version bump + docs change. Build + test gated by `prepublishOnly`.

**Verification:**
- `npm publish --dry-run` produces a tarball with the new component exports.
- After merge: `npm publish` (2FA OTP) + `git tag v1.3.0 && git push --tags`.

### Phase B — aquiferx wiring

- [x] **Unit 5: aquiferx — bump lib + wire all 5 dialog views + handle PASSWORD_RECOVERY**

**Goal:** Bump the lib dep, mount the new components, wire `signInView` state with all 5 values, add `PASSWORD_RECOVERY` listener, add synchronous URL detection at module-load (B1), strip recovery hash from history (G1), and clear recovery session on dismissal (G2). Single PR — Units 5+6 from the original draft are merged because aquiferx has no test infra to validate them independently.

**Requirements:** R1, R2, R3, R4, R6, R7, B1, G1, G2.

**Dependencies:** Unit 4 (lib 1.3.0 published).

**Files:**
- Modify: `aquiferx/package.json` — `@aquaveo/geoglows-auth` `^1.0.0` → `^1.3.0`. Run `npm install` to update lockfile.
- Modify: `aquiferx/index.tsx` (or `auth.ts`) — synchronous URL-state detection at module-load (B1, G1).
- Modify: `aquiferx/App.tsx`:
  - import `PasswordResetForm`, `SetNewPasswordForm` from `@aquaveo/geoglows-auth/react`.
  - import `detectRecoveryUrlState` from `@aquaveo/geoglows-auth/core`.
  - introduce `signInView: "signIn" | "forgotPassword" | "resetEmailSent" | "setNewPassword" | "recoveryError"` local state.
  - render based on `signInView`:
    - `"signIn"` → existing `<SupabaseAuthUI onForgotPasswordClick={() => setSignInView("forgotPassword")} />`
    - `"forgotPassword"` → `<PasswordResetForm onSuccess={() => setSignInView("resetEmailSent")} onCancel={() => setSignInView("signIn")} />`
    - `"resetEmailSent"` → static confirmation block: "If we have an account for that email, we sent a link to reset your password..." + "Back to sign in" button → `setSignInView("signIn")`
    - `"setNewPassword"` → `<SetNewPasswordForm onSuccess={() => setSignInModalOpen(false)} onExpired={() => setSignInView("recoveryError")} onCancel={() => { void auth.signOutRedirect(); setSignInView("signIn"); }} />`
    - `"recoveryError"` → static block: corporate-gateway hint + `mailto:gromero@aquaveo.com` + "Send a new link" button → `setSignInView("forgotPassword")`
  - `<dialog onClose>` handler (G2): if `signInView === "setNewPassword"` AND no successful submit, call `void auth.signOutRedirect()` before resetting state. Then `setSignInModalOpen(false)` + `setSignInView("signIn")`.
  - extend the existing `useEffect` at lines 199-235 with a `PASSWORD_RECOVERY` branch: `setSignInModalOpen(true) + setSignInView("setNewPassword")`.

**Approach:**
- **Module-load URL detection (B1, G1, race-proof safety net):** In `aquiferx/index.tsx`, BEFORE rendering `<App>`, call `detectRecoveryUrlState({ hash, search })`. Store result in module-scope variable. Pass to `<App>` as a prop.
- **Hash stripping (G1):** if `result.kind !== "none"`, immediately call `window.history.replaceState(null, '', window.location.pathname + window.location.search)` to strip the recovery `#access_token=…` hash from browser history + Referer.
- **`<App>` consumes the URL state:** if `result.kind === "valid"`, opens dialog in `setNewPassword` view at first render — race-proof regardless of whether the React `useEffect` `PASSWORD_RECOVERY` listener fires in time. If `result.kind === "expired"` or `"pkce-unsupported"`, opens dialog in `recoveryError` view.
- **Listener race redundancy:** even with module-load detection, the `useEffect` `PASSWORD_RECOVERY` branch stays — it covers the case where Supabase fires a delayed event (rare but possible per docs).
- **StrictMode safety:** opening the dialog twice via `setSignInModalOpen(true)` is idempotent; setting `signInView` to the same value is also idempotent.

**Patterns to follow:**
- `apps.geoglows/src/main.js` (post-1.2.0) — the `PASSWORD_RECOVERY` branch + URL parsing pattern.
- `apps.geoglows/src/auth-events.js` `detectRecoveryUrlState` (pre-Unit 0 location; post-Unit 0 it lives in the lib).
- The existing `<dialog>` pattern at `App.tsx:2060-2075`.

**Pre-flight verification (before kickoff, not a test):**
- `npm install --dry-run @aquaveo/geoglows-auth@^1.3.0` from aquiferx — assert no peer-dep / type-shape regressions.
- `npx tsc --noEmit` against the bumped state — assert no breaking changes in `<AuthProvider>` / `useAuth()` / `<SupabaseAuthUI>` between 1.0.0 and 1.3.0.

**Test scenarios:**
- Test expectation: none — aquiferx has no test infrastructure. Lib-side tests (Units 0-3) cover the components in isolation. Wiring verified by `npx tsc --noEmit` + manual smoke.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vite build` clean.
- Manual smoke (post-deploy on `aquiferx-bay.vercel.app`):
  1. "Forgot password?" link renders in sign-in dialog → click → forgotPassword view.
  2. Submit email → `resetEmailSent` view renders the confirmation message.
  3. Real email arrives → click link → land back on aquiferx → dialog auto-opens in `setNewPassword` view (race-proof verification: hash should be stripped from URL after detection).
  4. Wrong-account header shows the recovery email (not stale `useAuth().user.email`).
  5. Submit new password → success linger renders for ~1.5s → modal closes → user signed in with new credentials.
  6. Try Escape during `setNewPassword` view → recovery session is cleared (verify via DevTools localStorage).
  7. Construct a URL with `#error_code=otp_expired` → load aquiferx → dialog auto-opens in `recoveryError` view with corporate-gateway hint + mailto.

---

- [x] **Unit 6: Operational — Supabase Dashboard verification (no code changes)**

**Goal:** Confirm the Supabase project + Vercel env vars are correct for aquiferx's recovery flow.

**Requirements:** R1, R3, R7.

**Dependencies:** Unit 5 deployed.

**Files:** None.

**Approach:**

**Supabase Dashboard — Auth → URL Configuration:**
1. Site URL — already set per the vanilla plan; no change.
2. Redirect URLs allowlist — must cover BOTH `aquiferx-bay.vercel.app` (the bare Vercel URL — direct-URL recovery target) AND the existing `https://portal-dev.geoglows.org/**` + `https://*-gromero-1273s-projects.vercel.app/**` entries. The bare aquiferx URL was likely added during the original Supabase Auth migration; verify it's still there.

**Vercel — aquiferx project:**
3. Confirm `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` set on Production + Preview + Development. Same Supabase project as the other portal apps.

**Email template:**
4. No changes needed — verified during the vanilla 2026-04-30 smoke test that the implicit-flow URL format works.

**Verification:**
- Manual smoke: full end-to-end recovery flow from aquiferx production deploy.

**Test scenarios:**
- Test expectation: none — pure operational config.

## System-Wide Impact

- **Interaction graph:** New lib React exports (`<PasswordResetForm>`, `<SetNewPasswordForm>`, extended `<SupabaseAuthUI>` props). aquiferx's `App.tsx` `useEffect` gains a `PASSWORD_RECOVERY` branch + URL detection. The lib's `<AuthProvider>` is unchanged — recovery handling stays at the consumer level.
- **Error propagation:** New components throw via callbacks (`onError(error: Error)`); aquiferx logs via `console.error` (matching `App.tsx`'s existing pattern). Generic error strings rendered inline; raw error never surfaces to the user.
- **State lifecycle risks:** The new `signInView` state in aquiferx must reset to `"signIn"` on dialog close — otherwise reopening shows the wrong view. Test scenarios in Unit 5 (manual smoke) catch this.
- **API surface parity:** Vanilla and React surfaces now both have password recovery, but the implementations are still separate (modal-based on vanilla, primitive-based on React). Q3 from the origin plan said this divergence is acceptable for now; vanilla refactor to primitives lives in a future plan.
- **Cross-app SSO (R7):** R7 holds when aquiferx is reached via the proxied portal path (same origin as apps.geoglows). For the direct-URL path (`aquiferx-bay.vercel.app`), the recovery session is scoped to that bare origin and does NOT propagate to the other portal apps. This is a documented limitation, not a regression — the direct-URL path is the rare case (engineers, support tickets); proxied users are already covered by apps.geoglows's 1.2.0 modal where R7 holds via existing `isRedundantSignIn` dedup.
- **Integration coverage:** End-to-end recovery (lib → adapter → Supabase → email → click link → consumer event handler → component → adapter → Supabase) requires manual smoke testing — Supabase email delivery is not mockable in CI. Lib-side tests (Units 1-3) cover component logic in isolation.
- **Unchanged invariants:**
  - `<SupabaseAuthUI>`'s sign-in/magic-link behavior — only adds an optional callback prop.
  - `useAuth()` hook surface — no new fields.
  - `core.profiles` schema — recovery does not touch the table.
  - `<AuthProvider>` lifecycle — no event-subscription changes.
  - Vanilla `mountSignInModal` (1.2.0 modal-based recovery) — untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Lib test infra (vitest + jsdom + Testing Library) flaky for the new components | Existing pattern is solid (22 `SupabaseAuthUI` tests pass). Use `vi.useFakeTimers` for the success-linger window in `<SetNewPasswordForm>` to avoid flakiness. |
| `useAuth().user.email` is empty/null when `<SetNewPasswordForm>` mounts (recovery session not fully established yet) | Fall back to `profile.display_name` then a generic "Resetting password" with no email. Document the fallback in JSDoc. Test scenario covers the empty-user case. |
| StrictMode double-effect in dev causes the `PASSWORD_RECOVERY` handler to fire twice | The existing cleanup pattern (App.tsx:212-220) handles the listener subscribe/unsubscribe correctly. The PASSWORD_RECOVERY action (open dialog + set view) is idempotent — calling `setSignInView("setNewPassword")` twice is a no-op. |
| Recovery session expires while user is on `<SetNewPasswordForm>` | `updateUserPassword` rejects with auth error → distinguished from validation errors by the same `isAuthExpiredError` heuristic the vanilla plan codified → component transitions to expired view (or fires `onExpired`). User can request a new link. Same pattern as vanilla. |
| aquiferx's `App.tsx` is ~2080 lines; introducing new state risks tangled logic | Keep the new state minimal: `signInView` (3-string union) + `setSignInView` + a reset-on-close `useEffect`. Mount the new components inside the existing dialog. No new dialogs, no new refs. |
| User clicks recovery link in a browser already signed in to a different aquiferx account | Same scenario as the vanilla plan's Q5. R6 mitigates: `<SetNewPasswordForm>` shows "Resetting password for `<email>`" header. User notices the swap before submitting. |
| Lib bump 1.0.0 → 1.3.0 surfaces regressions in aquiferx | **Pre-flight diff** before Phase B kickoff: `npm install --dry-run`, enumerate every lib export aquiferx imports, diff each across 1.0.0→1.3.0, run `tsc --noEmit` against the bumped state. Cheaper than a 4-PR staged-bump fallback. The 1.0.0 `core.profiles` migration is already deployed (per memory: cutover 2026-04-30); 1.1.x/1.2.x changes are vanilla-side or additive React. |
| **PASSWORD_RECOVERY listener race (B1)** — Supabase fires the event synchronously during `_initialize()` BEFORE any React `useEffect` registers a listener. Without mitigation, R3 silently fails in production. | **Synchronous URL detection at module-load** (Unit 5) reads `window.location.hash` + `search` BEFORE React renders, stores recovery state in module scope, and `<App>` opens the dialog at first render. Race-proof regardless of listener timing. The `useEffect` `PASSWORD_RECOVERY` branch stays as redundant coverage for delayed events. |
| Stale `useAuth().user.email` shows previous account in wrong-account header (B2) | `<SetNewPasswordForm>` calls `adapter.getCurrentUser()` in its own `useEffect` on mount (mirrors vanilla). `useAuth()` is an optimization read, not the source of truth. Generic "unable to confirm account" warning if no email available. |
| Recovery `#access_token=…` hash leaks into browser history + Referer headers (G1) | `aquiferx/index.tsx` calls `window.history.replaceState` to strip the hash immediately after the URL detector consumes it. |
| User dismisses `setNewPassword` via Escape/backdrop without submitting; recovery session lingers in localStorage (G2) | `<dialog onClose>` handler in `App.tsx` checks `signInView`; if `"setNewPassword"`, calls `auth.signOutRedirect()` to clear the recovery session before closing. Covers Escape + backdrop + close button. |
| `<SetNewPasswordForm>` 1.5s success linger fires `onSuccess` after unmount (G5) | `setTimeout` registered with `useRef`; cleaned up in effect's cleanup return. Test scenario asserts `onSuccess` is NOT called after unmount-during-linger. |
| Cross-tab recovery propagation: Tab1 (signed in normally) sees the recovery session via storage event when Tab2 consumes the URL | Acknowledge: Tab1's `<AuthProvider>.refresh()` will pick up the recovery-session JWT, and the user may briefly see permission errors on mutating requests in Tab1. After Tab2 completes recovery, the new normal-scope `SIGNED_IN` propagates back. Out of scope for v1 fix; documented behavior. |
| Recovery requested from proxied path (`apps.geoglows.org/aquifer-analyst/`) lands on apps.geoglows, not aquiferx | By design — covered by apps.geoglows's 1.2.0 modal. R3 only covers the direct-URL path. |
| Email-prefetching gateways consume the recovery token | Same as vanilla Q1: `<SetNewPasswordForm>`'s expired error view includes the corporate-gateway hint + `mailto:gromero@aquaveo.com`. PKCE-flow remains a deferred long-term fix. |
| `<AuthProvider>` `refresh()` on post-recovery `SIGNED_IN` re-fetches profile (extra round trip vs vanilla's `isRedundantSignIn` dedup) | Acceptable. `<AuthProvider>` doesn't have the dedup pattern; `refresh()` re-fetches the same profile. One extra round trip per recovery is not a flicker source (the avatar already shows during recovery). Out of scope for this plan; capture as v2 work if observed. |

## Documentation / Operational Notes

- **`geoglows-auth/CHANGELOG.md`** — `[1.3.0]` entry covering `<PasswordResetForm>`, `<SetNewPasswordForm>`, and the `<SupabaseAuthUI>` `onForgotPasswordClick` prop.
- **`geoglows-auth/CLAUDE.md`** — fix stale aquiferx-on-Cognito line (R8); add new React exports to the Key Files inventory.
- **`aquiferx/CLAUDE.md`** — note the new recovery flow + that aquiferx now consumes lib `^1.3.0`.
- **Operational runbook** — after Unit 4 merge: `npm publish` (2FA OTP), tag, push tags. Then Unit 5-6 PRs land on aquiferx; Vercel auto-deploys. Then Unit 7 is the smoke test.
- **`docs/solutions/`** — at least one new learning worth capturing post-implementation: the React listener-registration pattern for `PASSWORD_RECOVERY` (no prior solution doc covers this; the vanilla pattern doesn't transfer mechanically). Also worth capturing: the `<PasswordResetForm>` / `<SetNewPasswordForm>` consumer-driven-view pattern as a v2 direction for the vanilla side.

## Sources & References

- **Origin plan:** `apps.geoglows/docs/plans/2026-04-30-002-feat-forgot-password-flow-plan.md` — vanilla forgot-password (shipped 2026-04-30 in lib 1.2.0 + PRs across apps.geoglows / grace / rfs).
- Lib 1.2.0 source code: `geoglows-auth/src/core/sign-in.ts` (vanilla setNewPassword view as the reference implementation), `geoglows-auth/src/core/supabase-auth.ts` (the three new adapter methods).
- aquiferx auth surfaces: `aquiferx/auth.ts`, `aquiferx/App.tsx` lines 199-235 + 2060-2075.
- Lib React surface: `geoglows-auth/src/react/SupabaseAuthUI.tsx`, `AuthProvider.tsx`, `ProfileSetupForm.tsx`, `index.ts`.
- Test patterns: `geoglows-auth/tests/react/SupabaseAuthUI.test.tsx`, `tests/react/ProfileSetupForm.test.tsx`.
- Supabase reference: https://supabase.com/docs/guides/auth/passwords
