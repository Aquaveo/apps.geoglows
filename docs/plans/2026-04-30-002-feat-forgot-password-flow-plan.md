---
title: "feat: Add forgot-password flow to the GEOGloWS sign-in modal"
type: feat
status: complete
date: 2026-04-30
reviewed: 2026-04-30
completed: 2026-04-30
---

# feat: Add forgot-password flow to the GEOGloWS sign-in modal

## Overview

Add password reset capability to the lib's vanilla sign-in modal so users who forgot their password can recover access. Three new modal views (`forgotPassword`, `forgotPasswordSent`, `setNewPassword`), two new adapter methods (`resetPasswordForEmail`, `updateUserPassword`), and a small `PASSWORD_RECOVERY` event handler in each of the three vanilla portal consumers (apps.geoglows, grace, rfs). aquiferx (React) is deferred to a separate plan because its sign-in surface (`SupabaseAuthUI.tsx`) is a different component with a different state model.

## Problem Frame

Today the modal exposes only sign-in (password + OAuth) and sign-up; users who forget their password have no in-app recovery path. The library is feature-complete enough to be the only thing the consumers need, so adding the missing flow keeps the lib-first design intact instead of pushing each consumer to roll its own recovery page.

## Requirements Trace

- **R1.** A signed-out user can request a password-reset email from the sign-in modal.
- **R2.** The reset-request flow shows a confirmation screen ("Check your email") regardless of whether the email exists, to preserve enumeration resistance (matching the existing sign-up flow).
- **R3.** A user who clicks the recovery link in their email lands on the consumer page and is auto-prompted (via the modal) to set a new password.
- **R4.** Setting a new password completes through the lib's adapter (`updateUserPassword`); the modal closes; the user is signed in with the new credential.
- **R5.** All HTML interpolation in new views uses `escapeHtml()`, matching apps.geoglows's existing escape discipline.
- **R6.** In-flight cancellation is preserved: closing the modal or unmounting mid-submit must not surface stale errors or fire callbacks against torn-down DOM (mirror of the existing `requestEpoch` pattern in `mountSignInModal`).
- **R7.** Cross-app SSO is preserved: a recovery completed on any of the three vanilla portal apps signs the user into all of them via the shared origin/localStorage.

## Scope Boundaries

- React surface (aquiferx, `SupabaseAuthUI.tsx`) is **out of scope** — separate plan.
- MFA is **out of scope** — already deferred from the 2026-04-23 Supabase Auth plan.
- Magic-link sign-in (already in the adapter) is **out of scope** — orthogonal feature.
- Custom email templates beyond Supabase's default are **out of scope** for v1; the default reset-password template works for the implicit flow.
- "Sign out other sessions after password reset" is captured as an **option** in the design, not a requirement — left for review.

### Deferred to Separate Tasks

- **aquiferx (React) parity** — separate plan; either add views to `geoglows-auth/src/react/SupabaseAuthUI.tsx` or build a dedicated `<PasswordResetForm>` + landing route component. Tracked here so the lib-driven scope does not silently abandon aquiferx users.
- **PKCE-flow support** — supabase-js default in browser clients is the implicit flow (token in URL hash). Plan targets implicit. PKCE would need template edits + `auth.exchangeCodeForSession` and is captured as a future evolution.

## Context & Research

### Relevant Code and Patterns

- **`geoglows-auth/src/core/sign-in.ts`** — the modal. `ModalView = "signIn" | "signUp" | "signUpSent"` (line 63); `renderBody` branches on view; `requestEpoch` (line 122) cancels stale resolutions; `captureFormValues` (lines 131-152) preserves typed input across toggles. Add 3 views and an `open({ view })` overload following these patterns verbatim.
- **`geoglows-auth/src/core/supabase-auth.ts`** — adapter implementation. `signUpWithPassword` (lines 193-204) is the closest pattern for `resetPasswordForEmail` (single email arg + optional redirectTo, throws on error). `signInWithMagicLink` (lines 174-181) is a sibling shape.
- **`geoglows-auth/src/types.ts`** lines 94-99 — the `SupabaseAuthAdapter` interface. New methods slot in alongside `signUpWithPassword`. OIDC adapter (`cognito.ts`) does NOT need to implement these (precedent set by `signUpWithPassword`).
- **`geoglows-auth/src/core/escape.ts`** — `escapeHtml(value)`. Mandatory for every `${value}` interpolation in the new views (security-critical).
- **`geoglows-auth/tests/core/sign-in.test.ts`** — test pattern. `buildAdapter(opts)` mock builder; `getDialog`, `getForm`, `fillField`, `submit`, `flush` helpers; the existing `describe` blocks for sign-in / sign-up / OAuth / cancellation / unmount. New tests for the forgot-password and set-new-password branches mirror the sign-up branch tests.
- **`apps.geoglows/src/main.js` lines 146-182**, **`grace-groundwater-dashboard/src/auth-bootstrap.js` lines 121-158**, **`rfs-v2-hydroviewer/src/auth-bootstrap.js` lines 122-159** — the three near-identical `onAuthStateChange` blocks. Each gets a new `if (event === "PASSWORD_RECOVERY")` branch that opens the modal with `view: "setNewPassword"`. The existing `SIGNED_IN` dedup pattern (added 2026-04-30 in the tab-focus fix) does not need to be replicated for `PASSWORD_RECOVERY` (Supabase JS does not re-fire it on tab focus — the URL hash is cleaned after first read).
- **`apps.geoglows/src/auth-events.js`** — the existing `isRedundantSignIn` / `getInitialState` helpers. Could grow a `getRecoveryHandler` if the wiring becomes non-trivial; otherwise inline the `PASSWORD_RECOVERY` branch in `main.js`.

### Institutional Learnings

- **`apps.geoglows/docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md`** — every `${value}` is an XSS sink. New views must escape email, error message, and any token-derived value via `escapeHtml()`.
- **`apps.geoglows/docs/solutions/ui-bugs/double-escape-prebuilt-html-via-value-escaping-renderer-2026-04-29.md`** — if a new view surfaces an anchor or `<strong>` tag, follow the existing two-helper pattern (`field` escapes its arg, `fieldRow` accepts pre-built HTML). Don't add a "skip escape" flag.
- **`geoglows-auth/docs/solutions/best-practices/user-metadata-is-auth-identity-not-profile-of-record-2026-04-29.md`** — password reset MUST NOT touch `core.profiles` or `user_metadata`. Only `auth.users` via `updateUser`. The post-recovery `SIGNED_IN` event will trigger `bootstrapSession`, which calls `ensureProfile` (select-then-insert, safe — does not overwrite user-edited fields).
- **`geoglows-auth/docs/solutions/logic-errors/ensureprofile-upsert-overwrites-user-edits-2026-04-29.md`** — confirms the post-recovery bootstrap path is non-destructive.
- **The 2026-04-30 SIGNED_IN-on-tab-focus fix** (just shipped, lib 1.1.2) — `bootstrapSession` accepts `initialState`; consumers dedup `SIGNED_IN` for the same user. The recovery flow's post-update `SIGNED_IN` fires for the same user (recovery happened in-app), so the existing dedup will correctly skip a redundant rebootstrap. Verify in test.

### External References

- [Supabase: Resetting a password](https://supabase.com/docs/guides/auth/passwords) — flow guide; implicit vs PKCE.
- [`auth.resetPasswordForEmail`](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail) — `(email, { redirectTo?, captchaToken? })` signature.
- [`auth.updateUser`](https://supabase.com/docs/reference/javascript/auth-updateuser) — `({ password })`. Requires authenticated session; recovery session counts.
- [`auth.onAuthStateChange`](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) — `PASSWORD_RECOVERY` fires during `_initialize()`, **before** `INITIAL_SESSION`. Listener must be registered at module load.
- [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) — project-wide email-send cap (4/hour default on built-in SMTP).
- [Redirect URLs allowlist](https://supabase.com/docs/guides/auth/redirect-urls) — recovery `redirectTo` must match the allowlist; otherwise Supabase falls back to Site URL.

## Key Technical Decisions

- **Recovery happens in-modal, not on a separate page.** Adding 3 views to `mountSignInModal` reuses the existing `<dialog>`, escape discipline, in-flight cancellation, and event-binding patterns. Three new routes per consumer would multiply the surface area.
- **Modal does not subscribe to auth events; it does drive multi-step ops on submit.** The modal does NOT subscribe to `onAuthStateChange` (preserves the existing decoupled design — consumer dispatches recovery via `signInModal.open({ view: "setNewPassword" })`). However, the modal's submit handler IS responsible for the `updateUserPassword` → `signOutOtherSessions` sequence, which is a multi-step security operation. This is intentional: keeping the modal as the single transaction owner avoids race conditions vs. splitting across modal + consumer + lib.
- **Adapter exposes recovery, not the modal.** `resetPasswordForEmail`, `updateUserPassword`, and `signOutOtherSessions` live on `SupabaseAuthAdapter`. The OIDC adapter (`cognito.ts`) does not implement them — same precedent as `signUpWithPassword`. Consumers using the OIDC adapter cannot use the recovery flow; that's intentional (Cognito password recovery is server-driven, out of scope here). The recovery flow is unreachable for v1 OIDC consumers because (a) all v1 vanilla consumers use `createSupabaseAuthAdapter`, and (b) aquiferx (the only OIDC consumer) is deferred and doesn't use `mountSignInModal` anyway.
- **`open()` grows an optional view argument**: `open({ view?: "signIn" | "forgotPassword" | "setNewPassword" })`. Default is `"signIn"` (preserves current behavior). Avoids a new `openForRecovery()` method that would expand the API surface.
- **Implicit flow only for v1.** supabase-js's browser default. Recovery URL has `#access_token=…&type=recovery` in the hash; `PASSWORD_RECOVERY` fires during `_initialize()`. PKCE deferred.
- **Generic confirmation message preserves enumeration resistance.** "If this email is new or registered, we sent a link…" — never confirm or deny user existence (matches sign-up flow's existing behavior).
- **Token expiry / link reuse** — the URL lands with `?error=access_denied&error_code=otp_expired&error_description=…` in the hash when the token is expired or already used. The consumer's recovery handler must detect this and surface a clean error in the modal (with a "request a new link" affordance). Do NOT silently auto-redirect.
- **Sign out other sessions after password change** — `updateUserPassword` (Unit 1) internally chains a `supabase.auth.signOut({ scope: "others" })` call. Exposed as `SupabaseAuthAdapter.signOutOtherSessions()` for direct consumer use too. Recommended by Supabase for security; cheap to do. **Behavior decision deferred to user input** — see Q4 in document review (silent vs. messaged vs. opt-in).
- **Lib version bump: 1.2.0** (minor, additive — new public API). The existing `prepublishOnly` script (added 2026-04-30) ensures `npm run build && npm test` runs before publish.

## Open Questions

### Resolved During Planning

- **Where does the modal's recovery view live?** → In `mountSignInModal` as a 3-view extension (`forgotPassword`, `forgotPasswordSent`, `setNewPassword`).
- **Does the lib auto-listen for `PASSWORD_RECOVERY`?** → No. Modal stays decoupled from event subscription; consumer wires it. (Modal does drive a multi-step `updateUserPassword` → `signOutOtherSessions` op on submit — that's not "subscribing to events," it's owning the success transaction.)
- **Implicit vs PKCE flow?** → Implicit for v1. **Add a v1 PKCE detector**: if the URL arrives with `?code=&type=recovery` instead of the implicit-flow hash, log `console.error` and render a clear "this Supabase project is configured for PKCE — recovery flow not yet supported" message. Detect synchronously in `initApp` BEFORE the existing `?code=&state=` cleanup strips the evidence.
- **Sign out other sessions after reset?** → Yes via `SupabaseAuthAdapter.signOutOtherSessions()` (added in Unit 1). UX framing (silent vs. messaged vs. opt-in) deferred to user input — see Q4.
- **Recovery `redirectTo` URL?** → `window.location.origin` (per consumer). Each consumer is responsible for being on the Supabase Auth → Redirect URLs allowlist; the existing entries (`https://portal-dev.geoglows.org/**`, `https://*-gromero-1273s-projects.vercel.app/**`) cover all three vanilla consumers.
- **Token expiry UX (URL parameter on landing)?** → Detect `error_code=otp_expired` in the URL hash; render an error inside the modal with a "Send a new link" affordance that transitions to `forgotPassword` view.
- **Token expiry mid-`setNewPassword` (user walks away)?** → On `updateUserPassword` failure, distinguish auth errors (recovery session expired) from validation errors (e.g., password too weak). On expired-session errors, transition to the same expired-token error state above. Always render a "Back to sign in" affordance in `setNewPassword` view so the user has an exit.
- **One vs. two password fields in `setNewPassword`?** → **One field** (matches existing `signUp`). Confirm-field deferred to v2 if usability data justifies.
- **"Forgot password?" element type?** → `<button type="button">` (matches existing modal toggles like `#geoglowsSignInToggleMode`). NOT an `<a href="#">`.
- **Focus management on view transitions?** → On every view transition, focus moves to the first interactive field of the new view via `autofocus` (or programmatic `focus()` after `bindEvents()`).
- **Recovery hash stripped from history?** → Yes. The existing `INITIAL_SESSION` cleanup block (`apps.geoglows/src/main.js:154-166`, mirrored in grace + rfs) regex `(?:^|[#&])access_token=` matches recovery URLs (`#access_token=…&type=recovery`). Verify in Unit 4 implementation; do NOT skip the verification because this is the only thing keeping the recovery token out of browser history.
- **Captcha on `resetPasswordForEmail`?** → Out of scope for v1. The 4/hour project-wide email cap is a soft DoS limit (an attacker can disable email reset for everyone, but the harm is bounded — no actual account compromise). Add to v2 if observed in practice.

### Deferred to Implementation

- **Exact field names and IDs in new views** (`#geoglowsSignInForgotEmail`, `#geoglowsSignInForgotSubmit`, `#geoglowsSignInNewPassword`, etc.) — follow the existing camelCase convention; pick names during implementation.
- **CSS class names for new views** (`.geoglows-signin-forgot-*`, `.geoglows-signin-new-password-*`) — follow the existing prefix convention; pick names during implementation.
- **Whether `auth-events.js` grows a `handleRecovery(event, modal)` helper or the wiring stays inline in `main.js`** — defer until the wiring is written; if it's >5 lines repeated 3 times, extract.
- **Visual treatment of the expired-token error state** — the structural decision (transition `forgotPassword` view OR a new state in `setNewPassword`) is resolved above; the headline copy + CTA wording can be written in implementation review.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### State machine — modal views

```
                  click "Forgot password?"
            ┌───────────────────────────────┐
            ▼                               │
    ┌──────────────────┐            ┌──────────────┐
    │   forgotPassword │            │    signIn    │
    │  (email input)   │◀───────────│  (current)   │
    └────────┬─────────┘   "Back"   └──────┬───────┘
             │ submit                      ▲
             ▼                             │
    ┌──────────────────┐                   │
    │ forgotPasswordSent│──── "Back" ──────┘
    │ (confirmation)    │
    └──────────────────┘

    Recovery email link clicked  ┌────────────────────┐
    (consumer detects             │   setNewPassword   │ ── close ──→ signed in
     PASSWORD_RECOVERY ──────────▶│   (new password    │
     and calls open({view}))      │    input)          │
                                  └────────────────────┘
```

### Sequence — recovery flow

```
User                Modal              Lib adapter         Supabase             Email
 │ click "Forgot"    │                   │                    │                    │
 │──▶───────────────▶│                   │                    │                    │
 │ submit email      │                   │                    │                    │
 │──▶───────────────▶│ resetPasswordForEmail                  │                    │
 │                   │──▶───────────────▶│ POST /recover      │                    │
 │                   │                   │──▶────────────────▶│ send mail          │
 │                   │                   │                    │──▶─────────────────▶│
 │                   │ render forgotPasswordSent              │                    │
 │ click email link, │                   │                    │                    │
 │ lands on app URL  │                   │                    │                    │
 │   with #type=     │                   │                    │                    │
 │   recovery        │                   │                    │                    │
 │                   │  Supabase JS _initialize() detects     │                    │
 │                   │  the recovery hash and fires           │                    │
 │                   │  PASSWORD_RECOVERY event               │                    │
 │                   │◀─── consumer's onAuthStateChange      │                    │
 │                   │     calls modal.open({                 │                    │
 │                   │       view: "setNewPassword" })        │                    │
 │ enter new pwd     │                   │                    │                    │
 │──▶───────────────▶│ updateUserPassword                     │                    │
 │                   │──▶───────────────▶│ PUT /user          │                    │
 │                   │                   │──▶────────────────▶│ password updated   │
 │                   │                   │ signOut({scope:"others"})              │
 │                   │ close             │ Supabase fires SIGNED_IN (same user)   │
 │                   │                   │                    │                    │
 │ avatar shown,     │                   │ consumer's existing dedup catches      │
 │ session active    │                   │ the redundant SIGNED_IN — no flicker   │
```

## Implementation Units

- [x] **Unit 1: Adapter — `resetPasswordForEmail`, `updateUserPassword`, `signOutOtherSessions`**

**Goal:** Add the three adapter methods the modal will call. No UI changes yet; this unit lands type-and-implementation only so it can be tested in isolation.

**Requirements:** R1, R4.

**Dependencies:** None (lib internals only).

**Files:**
- Modify: `geoglows-auth/src/types.ts` — add three method signatures to `SupabaseAuthAdapter`.
- Modify: `geoglows-auth/src/core/supabase-auth.ts` — add implementations alongside `signUpWithPassword`.
- Test: `geoglows-auth/tests/core/supabase-auth.test.ts` — add tests for all three methods.

**Approach:**
- `resetPasswordForEmail({ email, redirectTo? })` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo ?? config.defaultRedirectTo })`. Throws on error. Returns void. Uses `defaultRedirectTo` from adapter config when `redirectTo` is omitted (mirrors `signInWithMagicLink`).
- `updateUserPassword({ password })` calls `supabase.auth.updateUser({ password })`. Throws on error. Returns void. No `email` param — Supabase's `updateUser` infers user from the active session.
- `signOutOtherSessions()` calls `supabase.auth.signOut({ scope: "others" })`. Throws on error. Returns void. Distinct from `signOutRedirect()` (which signs out the current session and navigates) — this targets only OTHER active refresh tokens for the same user (e.g., other devices), preserving the current browser's session. The modal's submit handler chains this after `updateUserPassword` succeeds. Failure is non-fatal at the modal layer (logged + ignored, password is already updated — see Risks).
- OIDC adapter (`cognito.ts`) does NOT implement these — `signUpWithPassword` set this precedent in 1.1.0.

**Patterns to follow:**
- `signUpWithPassword` in `supabase-auth.ts:193-204` (single arg object, fall back to `config.defaultRedirectTo`, throw on error).
- `signInWithMagicLink` in `supabase-auth.ts:174-181` (sibling redirect-based call).
- `signOutRedirect` in `supabase-auth.ts:135-145` — REUSE the `supabase.auth.signOut` reference, but pass `{ scope: "others" }` and do NOT redirect.

**Test scenarios:**
- *Happy path:* `resetPasswordForEmail({ email })` calls `supabase.auth.resetPasswordForEmail` with the configured `defaultRedirectTo`.
- *Happy path:* explicit `redirectTo` is forwarded verbatim to Supabase.
- *Error path:* `resetPasswordForEmail` rejects when Supabase returns an error.
- *Happy path:* `updateUserPassword({ password })` calls `supabase.auth.updateUser({ password })`.
- *Error path:* `updateUserPassword` rejects when the underlying call returns an error (e.g., session expired, password too weak).
- *Happy path:* `signOutOtherSessions()` calls `supabase.auth.signOut` with `{ scope: "others" }` exactly.
- *Edge case:* `signOutOtherSessions()` does NOT call `supabase.auth.signOut()` with no args (regression guard against confusion with `signOutRedirect`).
- *Error path:* `signOutOtherSessions` rejects when the underlying call returns an error.

**Verification:**
- New tests pass; existing 148 tests still pass.

---

- [x] **Unit 2: Modal views — forgotPassword + forgotPasswordSent + setNewPassword**

**Goal:** Render the three new views and wire their submit handlers to the adapter methods. Reuses the existing in-flight cancellation, escape discipline, and form-value retention patterns.

**Requirements:** R1, R2, R3, R4, R5, R6.

**Dependencies:** Unit 1.

**Files:**
- Modify: `geoglows-auth/src/core/sign-in.ts` — extend `ModalView` union; add render branches; add the `open({ view })` overload; add a `Forgot password?` link in the `signIn` view; add submit handlers for the new flows; reuse `requestEpoch` for cancellation.
- Modify: `geoglows-auth/src/core/sign-in.css` — add styles for the new views following the `.geoglows-signin-*` prefix convention. Reuse existing `.geoglows-signin-form` / `.geoglows-signin-field` / `.geoglows-signin-input` / `.geoglows-signin-submit` / `.geoglows-signin-error` where applicable; add `.geoglows-signin-forgot-link` (the small link in the signIn view) and `.geoglows-signin-confirmation-text` reuse for the sent screen.
- Test: `geoglows-auth/tests/core/sign-in.test.ts` — add tests for each new branch.

**Approach:**
- `ModalView` becomes `"signIn" | "signUp" | "signUpSent" | "forgotPassword" | "forgotPasswordSent" | "setNewPassword"`.
- Add a small "Forgot password?" `<button type="button">` (NOT an `<a href="#">`) right-aligned below the password input in the `signIn` view. Always rendered regardless of `allowSignUp` mode (recovery is independent of sign-up availability).
- `forgotPassword` view: email input + submit + "Back to sign in" button. Submit calls `authAdapter.resetPasswordForEmail`. On success, transitions to `forgotPasswordSent`. Error path renders a generic message via the existing `state.error` channel.
- `forgotPasswordSent` view: confirmation text matching the existing `signUpSent` style — generic, enumeration-resistant, with a "Back to sign in" affordance.
- `setNewPassword` view: header "Resetting password for `${escapeHtml(recoveryEmail)}`" (Q5 — fetch via `supabase.auth.getUser()` when the view is opened) + ONE password input + submit + "Back to sign in" affordance. Submit calls `authAdapter.updateUserPassword`. On success: await `authAdapter.signOutOtherSessions()` (best-effort — log on failure, do not block); render an inline "Password updated. We've signed you out on other devices for safety." message for ~1.5s (Q4); close the modal; fire `onSignedIn` callback. Error path: distinguish auth errors (expired recovery session — transition to expired-token error state) from validation errors (e.g., password too weak — render generic message; user can retry).
- **Expired-token error view** (rendered both on URL-hash `error_code=otp_expired` AND on auth-error during submit): body copy MUST include a corporate-gateway hint plus a `mailto:gromero@aquaveo.com` fallback. Suggested copy: "This recovery link has already been used or expired. If your email is from a corporate or government domain, your IT system may have pre-fetched the link. <a href='mailto:gromero@aquaveo.com'>Contact support for manual recovery</a> or click below to request a new link." The mailto anchor is rendered via the existing `field`/`fieldRow` two-helper pattern (do NOT pass pre-built HTML through `escapeHtml`). The CTA button below transitions back to `forgotPassword` view.
- `open(options?)` becomes `open(options?: { view?: ModalView })`. Default behavior unchanged. The existing close-then-reset on subsequent open() preserves freshness.
- All `${value}` interpolations of email / error / token-derived strings go through `escapeHtml`. Field input values retained across re-renders (mirror existing `state.email` retention).
- **Focus management:** on every transition into a new view, focus moves to the first interactive field via programmatic `.focus()` after `bindEvents()`. Keyboard users land at the right element on every view change.

**Execution note:** Test-first. Each new view has a render-shape test before its submit-handler test, so a failing render fails distinctly from a failing submit.

**Patterns to follow:**
- `signUp` view (`renderBody` branch in `sign-in.ts`) — the closest analog: form + validation + adapter call + transition to "sent" view.
- `signUpSent` view — confirmation-card styling and "Back" button.
- `requestEpoch` cancellation pattern (`sign-in.ts:122,177,221,333,354`).
- `captureFormValues` (`sign-in.ts:131-152`) — extend to also capture the email field on the forgotPassword view.

**Test scenarios:**
- *Happy path (forgot-password):* sign-in view → click "Forgot password?" → forgotPassword view renders with email input and "Back to sign in" button.
- *Happy path:* submit a valid email → adapter's `resetPasswordForEmail` called with the email → transitions to forgotPasswordSent view.
- *Happy path:* "Back to sign in" from forgotPassword OR forgotPasswordSent → returns to signIn view with previously-typed email retained.
- *Edge case:* submit with empty email → renders generic "please enter your email" error inline; adapter NOT called.
- *Error path:* `resetPasswordForEmail` rejects → renders generic "couldn't send reset link" error; modal stays on forgotPassword view; user can retry.
- *Edge case (escape discipline):* email containing `<img onerror=...>` — assert no `<img onerror>` ends up in DOM after error rendering. Mirror of the existing XSS regression test.
- *Cancellation:* close modal mid-`resetPasswordForEmail` → resolution does not fire `onSignedIn`, does not render error after close.
- *Happy path (setNewPassword):* `open({ view: "setNewPassword" })` opens modal directly in setNewPassword view.
- *Happy path:* `setNewPassword` view header renders "Resetting password for `<recovery_email>`" using the user from `supabase.auth.getUser()`.
- *Happy path:* submit a new password → `updateUserPassword` called → `signOutOtherSessions` called → "Password updated. We've signed you out on other devices for safety." inline message renders → modal closes → `onSignedIn` callback fires.
- *Edge case (Q5 XSS):* recovery email contains `<img src=x onerror=…>` — assert no raw `<img>` lands in DOM (mirrors existing escape regression test).
- *Edge case (Q4 messaging):* `signOutOtherSessions` rejects → log to console; the success inline message still renders (best-effort, doesn't block close).
- *Error path:* `updateUserPassword` rejects with an auth/session error → transitions to expired-token error view (NOT inline error in `setNewPassword`).
- *Error path:* `updateUserPassword` rejects with a validation error (e.g., password too weak) → renders generic error inline; modal stays on `setNewPassword` view; user can retry.
- *Edge case:* submit empty password → inline validation; adapter NOT called.
- *Cancellation:* unmount modal mid-`updateUserPassword` → no callback, no DOM mutation after unmount.
- *Edge case (recovery session leak):* close `setNewPassword` view via Escape/backdrop without successful submit → `signOutRedirect` (full sign-out) is called to prevent the recovery session lingering.
- *Integration:* full flow — open `signIn` → click forgot → submit email → see sent → close → reopen with `view: "setNewPassword"` → submit new password → success message renders → modal closes → `onSignedIn` fires.
- *Integration (expired-token error view):* render with hash `error_code=otp_expired` → body copy contains the corporate-gateway hint and the `mailto:gromero@aquaveo.com` link → CTA button returns to `forgotPassword` view.

**Verification:**
- All new test scenarios pass; existing modal tests still pass (148 + new).
- Manual smoke: Vite dev server, click through the new views; visually confirm CSS doesn't regress the existing sign-in/sign-up screens.

---

- [x] **Unit 3: Lib release — version bump to 1.2.0 + CHANGELOG**

**Goal:** Ship the lib changes as a publishable release.

**Requirements:** R1, R4 (release prerequisite for consumers).

**Dependencies:** Units 1, 2.

**Files:**
- Modify: `geoglows-auth/package.json` — version `1.1.2` → `1.2.0`.
- Modify: `geoglows-auth/CHANGELOG.md` — `[1.2.0]` entry under date 2026-04-30 (or whenever it ships) covering the new adapter methods, modal views, and the `open({ view })` overload.

**Approach:**
- Minor bump (additive new public API). No breaking changes.
- The existing `prepublishOnly` script (added in 1.1.2 follow-up PR #8) runs `npm run build && npm test` before publish — protects against the 1.1.0 build-skipped publish incident.

**Patterns to follow:**
- The 1.1.2 CHANGELOG entry's structure (added/fixed/tests sections).

**Test scenarios:**
- Test expectation: none — pure version bump + docs change. Build + test are gated by `prepublishOnly`.

**Verification:**
- `npm version` shows 1.2.0; `npm publish --dry-run` produces a tarball with the new exports.
- After merge: `npm publish` (requires 2FA OTP) + `git tag v1.2.0 && git push --tags`.

---

- [x] **Unit 4: apps.geoglows — handle `PASSWORD_RECOVERY` event**

**Goal:** Detect `PASSWORD_RECOVERY` and open the modal in `setNewPassword` view. Bump lib dep.

**Requirements:** R3, R4, R7.

**Dependencies:** Unit 3 (lib 1.2.0 published).

**Files:**
- Modify: `apps.geoglows/src/main.js` — add `PASSWORD_RECOVERY` branch to `onAuthStateChange`; call `signInModal.open({ view: "setNewPassword" })`. Also handle expired-token URL parameters (detect `error_code=otp_expired` in `window.location.hash` early in `initApp` and present a clean error via the modal in a special "recovery-failed" state — option: extend `setNewPassword` view to accept an injected error, or close the modal and surface via the existing toast/banner if any. Defer the exact UX to implementation review).
- Modify: `apps.geoglows/package.json` — `@aquaveo/geoglows-auth` `^1.1.2` → `^1.2.0`. Run `npm install` to update lockfile.
- Optionally modify: `apps.geoglows/src/auth-events.js` — extract a `handleRecoveryEvent(modal)` helper if the inline wiring would exceed 5 lines OR if shared with the other consumers via copy-paste. Defer the extraction decision until implementation.
- Test: `apps.geoglows/tests/auth-events.test.js` (existing) — add tests for any new helper.

**Approach:**
- Listener registration is already at module-load time via `initApp()`. Per Supabase docs, `PASSWORD_RECOVERY` fires during `_initialize()` before `INITIAL_SESSION` — verify the existing registration timing is early enough (it is; the listener is attached before Supabase's auto-init completes).
- The `modal.open({ view: "setNewPassword" })` call must be safe to invoke even if the modal is already open (Supabase could fire `PASSWORD_RECOVERY` more than once on edge cases like dev hot-reload). The lib's `open()` already handles the already-open case as a no-op, so the only new behavior is honoring the `view` option.
- Expired-token handling: when the user lands with `error_code=otp_expired` in the hash, no `PASSWORD_RECOVERY` event fires. Detect this synchronously at module load (before Supabase consumes the hash) OR on `INITIAL_SESSION` if the error is preserved. The simplest path: parse `window.location.hash` for `error_code=otp_expired` early in `initApp`; if present, open the modal in a special view that says "this link has expired — request a new one" and links back to the forgot-password view. Defer the exact view design to implementation.
- After password update, the lib calls `signOutRedirect({ scope: "others" })` (Unit 2 internal); the Supabase JS will then fire a fresh `SIGNED_IN` (same user), which the existing `isRedundantSignIn` dedup will catch — no avatar flicker.

**Patterns to follow:**
- The `SIGNED_OUT` and `SIGNED_IN` branches in `main.js:175-182` — same shape, new event.
- The 1.1.2 dedup pattern — the new `PASSWORD_RECOVERY` branch does NOT need dedup (Supabase JS doesn't re-fire it on tab focus; URL hash is consumed once).

**Test scenarios (Q6 — three new tests):**
- *Happy path (Q6.a):* dispatch a synthetic `PASSWORD_RECOVERY` event → assert `mountSignInModal`'s mock `open` was called with `{ view: "setNewPassword" }`.
- *Edge case:* fire `PASSWORD_RECOVERY` twice in succession → second call is a no-op (modal already open in setNewPassword view).
- *Expired-token URL (Q6.b):* mock `window.location.hash = '#error=access_denied&error_code=otp_expired'` and run `initApp` → assert modal opens in expired-token error view → assert body contains the corporate-gateway hint AND the `mailto:` link → assert CTA transitions to `forgotPassword` view.
- *PKCE-shape URL (Q6.c):* mock `window.location.search = '?code=abc123&type=recovery'` and run `initApp` → assert `console.error` was called with the unsupported-flow message → assert modal opens in an explicit error view (NOT silently consumed by the existing `?code=&state=` cleanup).

**Verification:**
- `npm test` passes (existing 25 tests + new); `npm run build` clean.
- Manual smoke (Vercel preview): trigger a real password reset email from the production-deployed Supabase project; click the link; land on the apps.geoglows preview URL; modal opens in setNewPassword view; submit; verify password works on next sign-in.

---

- [x] **Unit 5: grace-groundwater-dashboard — handle `PASSWORD_RECOVERY` event**

**Goal:** Mirror Unit 4 in grace.

**Requirements:** R3, R4, R7.

**Dependencies:** Unit 3, Unit 4 (validates the pattern first).

**Files:**
- Modify: `grace-groundwater-dashboard/src/auth-bootstrap.js` — `PASSWORD_RECOVERY` branch in `onAuthStateChange`.
- Modify: `grace-groundwater-dashboard/package.json` — lib dep bump to `^1.2.0`. Run `npm install --legacy-peer-deps` to update lockfile.

**Approach:**
- Same pattern as apps.geoglows. Inline (no test infra in grace today).

**Patterns to follow:**
- apps.geoglows's Unit 4 wiring.
- The 1.1.2 dedup PR shape (fix/dedup-signin-on-tab-focus).

**Test scenarios:**
- Test expectation: none — no test infrastructure in grace today. Verification is the build + manual smoke.

**Verification:**
- `npm run build` clean.
- Manual smoke: trigger reset from grace's preview URL; verify modal opens in setNewPassword view on email link click.

---

- [x] **Unit 6: rfs-v2-hydroviewer — handle `PASSWORD_RECOVERY` event**

**Goal:** Mirror Unit 4 in rfs.

**Requirements:** R3, R4, R7.

**Dependencies:** Unit 3, Unit 4.

**Files:**
- Modify: `rfs-v2-hydroviewer/src/auth-bootstrap.js` — `PASSWORD_RECOVERY` branch.
- Modify: `rfs-v2-hydroviewer/package.json` — lib dep bump. Run `npm install --legacy-peer-deps`.

**Approach:**
- Identical to grace's wiring (rfs's `auth-bootstrap.js` is byte-similar to grace's).

**Patterns to follow:**
- grace's Unit 5 wiring.

**Test scenarios:**
- Test expectation: none — no test infrastructure in rfs today.

**Verification:**
- `npm run build` clean.
- Manual smoke: trigger reset from rfs's preview URL.

---

- [x] **Unit 7: Operational — Supabase Dashboard configuration**

**Goal:** Make sure the Supabase project is configured to actually deliver recovery emails to the right URLs.

**Requirements:** R1, R3.

**Dependencies:** Units 4-6 deployed.

**Files:** None (Vercel + Supabase Dashboard only).

**Approach:**

**Supabase Dashboard — Auth → URL Configuration:**
1. Confirm **Site URL** is set to the production portal URL (e.g., `https://portal-dev.geoglows.org`).
2. Confirm **Redirect URLs** allowlist includes:
   - `https://portal-dev.geoglows.org/**`
   - `https://*-gromero-1273s-projects.vercel.app/**` (Vercel preview wildcard, used by all 3 sub-app projects)
   - `http://localhost:3000/**` (local dev, if used)

   (These should already be present from the existing OAuth flow setup; confirm.)

3. **Email Templates → Reset Password**: review the active template. **Mandatory verification step:** send a test reset email and inspect the URL in the rendered email body. The URL MUST be the implicit-flow shape `…#access_token=<token>&type=recovery`. If it's the SSR/PKCE shape (`?code=…&type=recovery` or `/auth/confirm?token_hash=…`), the v1 flow will not work — either edit the template back to implicit OR coordinate with Unit 1 to add PKCE support. Default template (for projects untouched since pre-2024) is implicit; SSR-default-templates (post-2024 projects or admin customization) are PKCE.

4. **Auth → Providers → Email**: confirm "Enable email provider" and "Confirm email" / password sign-in is enabled. If password sign-in is disabled at the project level, `updateUserPassword` will fail and recovery is non-functional.

5. **Auth → Rate Limits** (if Pro plan): leave defaults (4/hour for built-in SMTP). For higher volume, configure custom SMTP — out of scope for v1.

6. **Pre-implementation Safe Links smoke test (Q1):** before kickoff, send a test recovery email to a `.gov` or `.edu` inbox (real corporate-gateway scanner). If Safe Links / Mimecast / Proofpoint pre-fetches the URL, the token is consumed before the user clicks, recovery fails for that population, and v1 needs PKCE escalated into scope.

**Verification:**
- Site URL set, Redirect URLs allowlist correct.
- Active email template produces an implicit-flow URL (manually inspect a test email).
- Password sign-in enabled at project level.
- Safe Links test (above) passed OR PKCE escalated into v1.
- Trigger a real reset email from the deployed apps.geoglows; the email link redirects to the configured `redirectTo` and the recovery flow completes end-to-end.

**Test scenarios:**
- Test expectation: none — pure operational config. Smoke test in Verification covers the user-facing flow.

## System-Wide Impact

- **Interaction graph:** new public methods on `SupabaseAuthAdapter` (consumed by the modal); new modal views; one new event branch in three consumer event handlers. Modal stays passive (does not subscribe to auth events) — preserves existing decoupled design.
- **Error propagation:** `resetPasswordForEmail` and `updateUserPassword` throw on Supabase errors, caught by the modal's submit handlers, surfaced as generic error messages. Network failures degrade to the same generic error. Expired-token URL parameters are handled at consumer-init time (Unit 4-6 each).
- **State lifecycle risks:** the modal's existing `requestEpoch` cancellation extends to the new submit handlers — closing or unmounting mid-submit must not call `onSignedIn` or render after teardown. New tests cover both new handlers.
- **API surface parity:** the lib's `react/SupabaseAuthUI.tsx` does NOT get these views in v1 — aquiferx is deferred. This is a documented temporary asymmetry; future plan addresses it.
- **Cross-app SSO scope (R7):** R7 holds in **production** because all consumers share `portal-dev.geoglows.org` origin via the portal rewrites. R7 does NOT hold on **Vercel preview** URLs (each preview is on a per-project subdomain — different origin → different localStorage). Manual smoke tests on production cover R7; preview smoke tests can only verify per-app recovery, not cross-app SSO.
- **Integration coverage:** the cross-flow scenario (lib → adapter → Supabase → email → click link → consumer event handler → modal → adapter → Supabase) requires manual smoke testing on the Vercel preview because Supabase's email delivery is not mockable in CI. Cheap CI tests to add in apps.geoglows (Unit 4): (a) `PASSWORD_RECOVERY` dispatch with mocked `signInModal.open`; (b) hash containing `error_code=otp_expired` triggers expired-token UX; (c) hash containing `?code=&type=recovery` (PKCE shape) triggers explicit unsupported-flow error — see Q6.
- **Unchanged invariants:** `core.profiles` schema and the `ensureProfile` select-then-insert behavior — recovery flow does not touch profiles. The `INITIAL_SESSION` listener in each consumer (and its OAuth-callback URL cleanup) is unchanged. The `SIGNED_IN` dedup added in 1.1.2 is unchanged and will correctly skip the post-`updateUser` redundant `SIGNED_IN`.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Supabase JS fires `PASSWORD_RECOVERY` BEFORE consumer's listener is attached (timing race) | All three consumers register their `onAuthStateChange` listener synchronously during module load before any `await` boundary. Add an explicit comment in each consumer flagging this constraint. **No equivalent of the `INITIAL_SESSION` 2-second timeout exists for `PASSWORD_RECOVERY`** — if a future refactor moves listener registration after an `await`, recovery breaks silently. Defense: the synchronous PKCE/expired-token URL-hash detection in `initApp` (see "PKCE detector" decision) can also detect a `type=recovery` hash that arrives without a corresponding event firing within 2s and surface an explicit error. |
| Email-prefetching by corporate gateways (Outlook Safe Links, Mimecast, Proofpoint) consumes the recovery token before the user clicks | **Potentially feature-killing for `.gov` / `.edu` / corporate users — see Q1 in document review.** v1 ships the soft mitigation (clean `error_code=otp_expired` error + "Send a new link" affordance). PKCE flow is the structural fix, currently deferred. Pre-implementation Safe Links smoke test recommended. |
| User opens a recovery link in a browser already signed in to a different account; Supabase replaces session with recovery user | Supabase replaces the session — recovery user becomes active. After `updateUserPassword`, `signOutOtherSessions()` invalidates other-device tokens — the old account's session on this device is gone. **UX gap: silent identity swap** — see Q5 in document review. v1 should at minimum surface "Resetting password for `${email}`" in the `setNewPassword` view header so the user notices the swap. |
| User dismisses `setNewPassword` modal (Escape key, backdrop click) without completing recovery — leaves a recovery session active | The modal's `close()` for `setNewPassword` view should call `signOutOtherSessions` is NOT enough — needs `supabase.auth.signOut()` to clear the recovery session entirely. Add to Unit 2: when closing the modal from `setNewPassword` view without successful submit, call `signOutRedirect` (full sign-out) to prevent the recovery session lingering. |
| Concurrent recovery in multiple tabs (apps.geoglows + grace + rfs all open) | Only the tab that consumed the URL hash sees `PASSWORD_RECOVERY` (Supabase JS broadcasts via `BroadcastChannel`/storage event — sibling tabs see `SIGNED_IN`, not `PASSWORD_RECOVERY`). The post-recovery `SIGNED_IN` is deduped in sibling tabs by the existing `isRedundantSignIn` check (1.1.2 fix). Documented expected behavior; no code change needed beyond a regression test. |
| Project switches from implicit to PKCE flow; recovery URL becomes `?code=&type=recovery` | v1 silent-failure-mode is the URL is consumed by the existing OAuth-callback `?code=&state=` cleanup with no event firing. **PKCE detector** (resolved decision) catches this: synchronous URL-hash + query-string parse in `initApp` BEFORE the cleanup runs; if a `type=recovery` PKCE shape arrives, log + render a clear error. |
| `signOutOtherSessions()` fails (rare; Supabase API hiccup) | Best-effort: log and continue — password is already updated. The user can sign other devices out manually if needed. |
| Token expires while user is on `setNewPassword` view (walked away) | `updateUserPassword` rejects with auth error. Distinguish from validation errors; transition to the expired-token error state with "Send a new link" affordance (resolved decision). User exits via "Back to sign in" affordance (also resolved). |
| Double-token race: user clicks "Send" twice or requests reset twice; older token invalidated | Submit button disabled while pending (matches existing `signUp` pattern); `requestEpoch` cancellation cancels stale resolutions. After successful send, transition to `forgotPasswordSent` view eliminates the form. |
| Rate-limit hit on the project-wide email-send cap (4/hour built-in SMTP) | Default tier only — soft DoS limit (an attacker can disable email reset for everyone, but no actual account compromise). Surface in modal as "Too many requests; try again later." If observed in practice, route through custom SMTP. |
| Project-level password sign-in disabled (Pro plan setting) | `resetPasswordForEmail` may still send the email but `updateUserPassword` will fail. Generic error renders. Operational verification (Unit 7) should check that password sign-in is enabled at the project level. |
| Customized Supabase email template doesn't produce implicit-flow URL | Unit 7 verification: send a test recovery email and inspect the URL format in the rendered email body. Reject the rollout if the URL doesn't match `#access_token=…&type=recovery`. |
| aquiferx users have no recovery path | Documented as a deferred follow-up. v1 does not regress aquiferx; it just doesn't add the feature there. |
| Generic error messages hide debugging info | Console.error logs the full error message (matching existing pattern in `handlePasswordSubmit`). Generic UX preserves enumeration resistance. |

## Strategic Questions Resolved (post-document-review)

Surfaced by document review on 2026-04-30; all resolved before Unit 1 begins.

- **Q1. Email gateway prefetching.** Safe Links test on `.gov`/`.edu` inbox cannot be run (no test inbox available). **Resolution: ship implicit flow + graceful-degradation expired-token error UX.** The expired-token error view's body copy includes a corporate-gateway hint and a `mailto:gromero@aquaveo.com` support-contact fallback so affected users get a working escape hatch (not a dead end). Real-world support volume is the trigger to escalate PKCE in v2; no preemptive scope expansion.
- **Q2. Premise validation.** Skipped — GEOGloWS is a small captive population where "every login form needs forgot-password" is a defensible default even without sign-in-method data, and the work is bounded enough (~5 days) that it doesn't block Cognito decommission.
- **Q3. In-modal vs primitive.** Stay in-modal for v1. The compounding cost (modal grows toward 8-10+ views as MFA / email-change / account-link land) is real but not yet urgent. Documented as architectural debt under Documentation / Operational Notes — revisit when the modal crosses ~8 views or when aquiferx's React port forces parity.
- **Q4. Sign-out-others default UX.** Messaged yes. After `updateUserPassword` succeeds, render an inline confirmation in the `setNewPassword` view — "Password updated. We've signed you out on other devices for safety." — for ~1.5 seconds before the modal closes. Silent default is replaced; opt-in checkbox is overkill for the GEOGloWS threat model.
- **Q5. Wrong-account UX.** Show "Resetting password for `${escapeHtml(recoveryEmail)}`" header in `setNewPassword` view. Cheap (~10 lines + 1 test), prevents silent identity-swap on shared lab/field machines, gives the legit user reassurance.
- **Q6. CI tests in apps.geoglows.** Yes — add three new tests in Unit 4:
  - `PASSWORD_RECOVERY` event dispatch calls `signInModal.open({ view: "setNewPassword" })`
  - URL hash with `error_code=otp_expired` triggers expired-token error UX
  - URL hash with `?code=&type=recovery` (PKCE shape) triggers explicit unsupported-flow error

## Architectural Debt (Q3 — captured for v2)

Per Q3 in Strategic Questions Resolved: the modal grows from 3 → 6 views in this plan, and likely 8-10+ as MFA / email-change / account-link / OAuth-relink land. At ~8+ views, the maintenance and cohesion cost crosses a line: the modal stops being "a sign-in modal" and becomes "a generic auth state machine," with diminishing readability per added view.

**Future direction:** expose `<PasswordResetForm>`, `<SetNewPasswordForm>`, etc. as **primitives** that consumers mount on their own routes (e.g., `/auth/recover`). Aligns the vanilla and React surfaces (helps eventual aquiferx port), gives recovery a real URL (mitigates email-gateway pre-fetch concerns from Q1), and keeps the modal small.

**Trigger to revisit:** any of (a) modal hits 8 views; (b) MFA work begins; (c) aquiferx port unblocks and a vanilla/React parity question forces the issue.

## Documentation / Operational Notes

- **CHANGELOG.md** — new `[1.2.0]` entry covers the adapter additions, modal views, and `open({ view })` overload. Note that recovery is Supabase-Auth-only.
- **`geoglows-auth/CLAUDE.md`** — Project Overview already mentions vanilla + react surfaces; consider a one-line mention that recovery is vanilla-only in v1 (aquiferx deferred).
- **`apps.geoglows/CLAUDE.md`** — sub-app inventory section unchanged.
- **`docs/solutions/`** — at least three new learnings worth capturing post-implementation:
  1. The `PASSWORD_RECOVERY` event timing (fires BEFORE `INITIAL_SESSION`).
  2. The recovery-URL `redirectTo` allowlist requirement (multi-consumer, multi-environment).
  3. The expired-token URL parameter pattern (`error_code=otp_expired`) and its UX.
- **Operational runbook** — after merge:
  1. Lib publish: `npm publish` (1.2.0, prepublishOnly enforces build+test).
  2. Tag and push: `git tag v1.2.0 && git push --tags`.
  3. Consumer PRs land in dependency order: apps.geoglows first (validates the pattern), then grace + rfs in parallel.
  4. Vercel auto-deploys each consumer.
  5. Verify Supabase Dashboard config (Unit 7).
  6. End-to-end smoke on each production URL.

## Sources & References

- Supabase reference: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- Supabase reference: https://supabase.com/docs/reference/javascript/auth-updateuser
- Supabase reference: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- Supabase guide: https://supabase.com/docs/guides/auth/passwords
- Supabase guide: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase guide: https://supabase.com/docs/guides/auth/rate-limits
- Related code: `geoglows-auth/src/core/sign-in.ts`, `geoglows-auth/src/core/supabase-auth.ts`, `apps.geoglows/src/main.js` (event handler block), grace + rfs `auth-bootstrap.js` files
- Recently shipped patterns: 1.1.2 `bootstrapSession({ initialState })`, `renderAuthAction` user-takes-precedence, consumer-side `isRedundantSignIn` dedup
- Related PRs: `geoglows-auth#9` (1.1.2 fix), `apps.geoglows#14`, `grace-groundwater-dashboard#4`, `rfs-v2-hydroviewer#4`
