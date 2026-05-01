---
title: "feat: Bring React <SupabaseAuthUI> to visual + feature parity with the vanilla sign-in modal (OAuth, sign-up, restyle)"
type: feat
status: active
date: 2026-04-30
---

# feat: React `<SupabaseAuthUI>` — visual + feature parity with the vanilla modal

## Overview

Aquiferx's sign-in modal is the lib's React `<SupabaseAuthUI>` — currently a minimal `email + password` form (plus a magic-link toggle), inline-CSS, with no OAuth and no sign-up. The portal's sign-in modal is the lib's vanilla `mountSignInModal` — Google + GitHub OAuth, "or with email" divider, full-width blue Sign in button, rounded inputs, "Create an account" sign-up flow with first/last name. Side-by-side the two look like different products.

This plan brings the React surface to visual + feature parity with the vanilla modal:
- Add Google + GitHub OAuth buttons (and an "or with email" divider).
- Add the sign-up state machine: form with first/last name + email + password, and a post-submit "Check your email" confirmation view.
- Restyle the form so it looks visually identical to the vanilla modal: rounded 12px inputs, full-width primary button (`#2563eb` blue), refined typography.
- Reuse the lib's existing `sign-in.css` classes rather than duplicating styles inline — single source of truth for any future visual change.

Aquiferx wires the new sign-up flow into its existing 5-view state machine (alongside the existing forgotPassword / resetEmailSent / setNewPassword / recoveryError views).

## Problem Frame

Aquiferx ships the React-side sign-in modal because it's a React app; it can't use the vanilla `mountSignInModal`. But the React `<SupabaseAuthUI>` component was built to a much smaller spec: minimum-viable email/password sign-in for the auth migration. Since then the vanilla modal has gained:

1. **Google + GitHub OAuth** — a primary path for new users on the portal. Aquiferx users have no equivalent.
2. **Sign-up flow** — first/last name + email + password + email-confirmation. Aquiferx has no in-app way to create an account; users who land on aquiferx without a portal account are stuck.
3. **Visual treatment** — the vanilla modal is rounded, modern, and brand-blue. The React modal looks like a 2010-era admin form.

The user's ask was direct: "can we make aquiferx look similar to the portal?" The minimal answer is a CSS restyle, but the visual gap is partly because OAuth and sign-up are *missing affordances*. Restyling alone produces a polished version of an incomplete form. This plan does both — restyle + feature parity — because they share the same component surface and the same CSS source.

## Requirements Trace

### Feature requirements (Lib)

- **R1.** `<SupabaseAuthUI>` renders Google + GitHub OAuth buttons above the email form, separated by an "or with email" divider. Click triggers `adapter.signInWithOAuth({ provider, redirectTo })`. The clicked button enters a disabled+loading state ("Signing in…" label, spinner) until navigation fires or an error is caught; the other OAuth button is also disabled to prevent double-action. Failure renders a generic error in the form, raw error to `onError` callback (matches existing error-handling discipline).
- **R2.** `<SupabaseAuthUI>` accepts an `allowSignUp?: boolean` prop (default `true`, matching vanilla). When `true`, renders a "New here? Create an account" toggle below the form. Clicking it switches the form into sign-up mode: first/last name fields appear (2-column grid), submit becomes "Create account", and submission calls `adapter.signUpWithPassword({ email, password, emailRedirectTo, metadata: { first_name, last_name } })`. The sign-up form has an explicit `Back` link returning to `signIn` view.
- **R3.** Successful sign-up renders a "Check your email" confirmation view in the same component. The view has a "Back to sign in" button that returns to the sign-in form with the email field pre-filled (so the user can sign in immediately if they confirmed in another tab) and the password field cleared.
- **R3a.** OAuth and sign-up `redirectTo` values pass through `sanitizeHref` defensively — same security control as the 1.4.0 `profileHref` work. Dangerous schemes (`javascript:`, `data:`, `vbscript:`) are rejected; the call falls back to `window.location.origin`.

### Visual / CSS requirements

- **R4.** Visual parity with the vanilla modal: rounded inputs (12px radius), full-width primary submit (`#2563eb` blue), refined typography (1.25rem heading, 0.75rem labels), close-X button in the header. Achieved by reusing the existing `sign-in.css` classes — the React component uses `className=` instead of inline `style=`.
- **R4a.** All four views (`signIn`, `signUp`, `signUpSent`, `magicLinkSent`) get the rounded class-based treatment. The current magic-link-sent gray-box inline-styled confirmation must be migrated to `.geoglows-signin-confirmation` + `.geoglows-signin-confirmation-text` + `.geoglows-signin-confirmation-back` for visual consistency with `signUpSent`.
- **R5.** Aquiferx imports `@aquaveo/geoglows-auth/core/sign-in.css` once at app entry. Aquiferx's outer `<dialog>` frame (rounded `rounded-2xl` backdrop blur) is unchanged. Aquiferx wires `onClose={() => setSignInModalOpen(false)}` so the lib renders a close X inside the modal content (corrects the originally-stated assumption — aquiferx's outer dialog has NO rendered close X today, only Escape + backdrop click; without `onClose` wired, the parity goal would visibly miss).

### Behavioral / integration requirements

- **R6.** Magic-link mode is preserved as the existing toggle "Sign in with a magic link instead" rendered below the password form, AND visible only in `signIn` view (NOT in `signUp` view). Magic-link-sent confirmation uses the same class-based confirmation view as `signUpSent` (R4a).
- **R7.** No regression in any existing behavior: aquiferx's forgot-password / setNewPassword / recoveryError flows continue to work via the adjacent React components (`<PasswordResetForm>`, `<SetNewPasswordForm>`); aquiferx's 5-view state machine (`signIn` / `forgotPassword` / `resetEmailSent` / `setNewPassword` / `recoveryError`) is unchanged. The new `signUpSent` view is internal to `<SupabaseAuthUI>` — aquiferx's outer view-state union does NOT need to be extended (the lib's component owns sign-up's lifecycle).
- **R8.** No behavioral change for any other lib consumer. apps.geoglows uses the vanilla modal exclusively; grace and rfs use the vanilla modal exclusively. They are not affected.

## Scope Boundaries

- **No vanilla modal changes.** `mountSignInModal` is the existing reference implementation; this plan brings the React side TO the vanilla side, not the reverse. CSS lives in `geoglows-auth/src/core/sign-in.css` and stays there — adding React-only classes goes in the same file so consumers import one CSS file.
- **No new OAuth providers.** Google + GitHub only — same set the vanilla modal exposes today. Adding more (e.g. Microsoft, ORCID) is a separate plan that touches both surfaces.
- **No magic-link removal.** Aquiferx users may rely on it; keep the existing toggle. Future plan can decide if magic-link should join OAuth or stay as a "less common" affordance.
- **No design redesign.** This is parity with the vanilla modal as it exists today. The "Make the portal modal itself look better" question is a separate design plan.
- **No new lib export shape.** `<SupabaseAuthUI>` keeps its existing prop names; `allowSignUp`, OAuth-provider toggles (if any) are additive.
- **No aquiferx state-machine refactor.** Aquiferx already has a 5-view state machine for sign-in / forgot-password / resetEmailSent / setNewPassword / recoveryError. This plan does NOT extend the aquiferx union — the new `signUpSent` view is internal to `<SupabaseAuthUI>` and aquiferx never observes it.
- **No telemetry / analytics additions.** Existing `onError` callback is the surface for downstream logging.

### Deferred to Separate Tasks

- **Vanilla modal visual refresh** — if the parity reveals issues with the vanilla design, that's a redesign plan, not a parity plan.
- **Magic-link consolidation** — whether magic link should be a peer to Google/GitHub (in the OAuth row) or stay in the email-section toggle. Visual decision; defer.
- **More OAuth providers** — Microsoft, Apple, ORCID, etc. Cross-surface plan.
- **Per-provider configuration** — e.g. consumers passing `enabledProviders={["google"]}` to disable GitHub. Not needed today (both providers are configured at the Supabase project level; if a project doesn't have GitHub enabled, the click fails with a clean error and the existing `onError` surfaces it).

## Context & Research

### Relevant Code and Patterns

- **`geoglows-auth/src/core/sign-in.ts`** — vanilla modal reference (line numbers verified 2026-04-30; if the file is edited later, search by symbol). Key landmarks:
  - `renderSignInOrSignUp(state, allowSignUp)` (line 854) — the canonical sign-in/sign-up form HTML. Source of truth for HTML structure.
  - Inline Google + GitHub SVGs at lines 941-946 and 955-957 — copy verbatim to React.
  - `handleOAuth(provider)` adapter wiring at lines 487-494 — `adapter.signInWithOAuth({ provider: "google", redirectTo })` for Google, same for GitHub.
  - `handleSignUpSubmit` (search the file for that function name) — sign-up calls `adapter.signUpWithPassword({ email, password, emailRedirectTo, metadata: { first_name, last_name } })`, then transitions to `signUpSent` view.
  - `signUpSent` view rendering at lines 642-658 — the "Check your email" confirmation HTML.

- **`geoglows-auth/src/types.ts:111-112`** — `SupabaseAuthAdapter.signInWithOAuth(args: { provider: string; redirectTo?: string }): Promise<void>` and `signUpWithPassword(args: SignUpWithPasswordArgs): Promise<void>`. The latter accepts `email`, `password`, `emailRedirectTo`, and `metadata` per the existing definition. No adapter changes needed.

- **`geoglows-auth/src/core/sign-in.css`** — visual reference. Already exports the classes `<SupabaseAuthUI>` will reuse: `.geoglows-signin-content`, `.geoglows-signin-header`, `.geoglows-signin-title`, `.geoglows-signin-close`, `.geoglows-signin-error`, `.geoglows-signin-providers`, `.geoglows-signin-provider-button`, `.geoglows-signin-divider`, `.geoglows-signin-divider-label`, `.geoglows-signin-form`, `.geoglows-signin-name-grid`, `.geoglows-signin-field`, `.geoglows-signin-label`, `.geoglows-signin-input`, `.geoglows-signin-submit`, `.geoglows-signin-toggle-text`, `.geoglows-signin-toggle-button`, `.geoglows-signin-forgot-row`, `.geoglows-signin-forgot-link`, `.geoglows-signin-confirmation`, `.geoglows-signin-confirmation-text`, `.geoglows-signin-confirmation-back`. No new CSS classes required. (`.geoglows-signin-success` exists but is not used by `<SupabaseAuthUI>` — that's a `<SetNewPasswordForm>` concern.)

- **`geoglows-auth/src/react/SupabaseAuthUI.tsx`** — the file being rewritten. Currently 335 lines, inline-CSS. After: same exported component, same props (additive `allowSignUp?` + optional callbacks), CSS classes throughout, OAuth + sign-up + signUpSent views.

- **`geoglows-auth/src/types.ts:108-112`** — `SupabaseAuthAdapter` already exposes `signInWithOAuth(args)`, `signUpWithPassword(args)`. No adapter changes needed.

- **`aquiferx/App.tsx` lines 225-260** — `signInModalOpen` state + `<dialog>` wiring. Lines 2172-2210 — the modal body where `<SupabaseAuthUI>` lives alongside `<PasswordResetForm>`, `<SetNewPasswordForm>`, and the inline `resetEmailSent` view. Sign-up state needs to land here.

- **`aquiferx/index.tsx`** — module-level imports. Add `import "@aquaveo/geoglows-auth/core/sign-in.css"` here so the styles load before any React component mounts.

### Institutional Learnings

- **Existing CSS file is the right reuse target** — the lib's vanilla modal already has all the visual primitives the React side needs. Reusing them avoids visual drift and gives any future "make the modal nicer" work a single place to land. **Trade-off documented**: this couples the React surface's visuals to vanilla's. A future redesign of the vanilla modal will affect the React modal too. If the surfaces ever need to diverge, that's a CSS-split task at that time. Reuse is the right call for parity *today*; the constraint is intentional but stated explicitly.
- **CSS works under Tailwind preflight** — apps.geoglows already imports `@aquaveo/geoglows-auth/core/sign-in.css` at `src/main.js:2` and uses Tailwind v4 in production. The CSS file uses property-level resets (explicit `border: 0`, `background: transparent`, `box-sizing: border-box`) rather than `:where()` workarounds. The pattern works in production today; aquiferx's Tailwind shouldn't introduce new collisions.
- **JSX auto-escapes attribute values** — no `escapeHtml` needed for the React side (the React-side learning from forgot-password plan G1). Continue: never use `dangerouslySetInnerHTML` for OAuth provider SVGs; render JSX paths directly.
- **Generic error messages prevent account enumeration** — the existing `GENERIC_PASSWORD_ERROR` pattern in both vanilla and React stays. Sign-up errors get their own generic message (`GENERIC_SIGNUP_ERROR`); OAuth errors get `GENERIC_OAUTH_ERROR`. Raw errors flow to consumer's `onError`.
- **Aquiferx's `<dialog>` provides the modal frame ONLY** — backdrop blur, rounded corners, max-width, Escape, backdrop click. It does NOT have a rendered close X today (verified at `App.tsx:2143-2175`). The lib's `.geoglows-signin-modal` class targets the vanilla `<dialog>`; aquiferx does not use it. Aquiferx wires the lib's `onClose` so the lib renders its `.geoglows-signin-close` X inside the modal content — same visual position as the portal's X.
- **`user_metadata` is render-untrusted at all sites** (security invariant): sign-up `metadata: { first_name, last_name }` flows into Supabase `user_metadata` → `ensureProfile` seeds `core.profiles.first_name`/`last_name` on first creation → vanilla `apps.geoglows/src/ui/profilePage.js` renders these via `escapeHtml`; React surfaces (`<UserMenu>`, `<ProfileEditForm>`) render via JSX auto-escape. Future modifications to `ensureProfile` or any new render site MUST preserve this. Add to `geoglows-auth/CLAUDE.md` as a permanent invariant.

### External References

- [Supabase Auth — `signUp`](https://supabase.com/docs/reference/javascript/auth-signup) — sign-up signature including `options.data` for metadata.
- [Supabase Auth — OAuth providers](https://supabase.com/docs/guides/auth/social-login) — provider configuration is per-project; the form just calls `signInWithOAuth({ provider })`.

## Key Technical Decisions

- **Reuse `sign-in.css` rather than duplicate styles inline.** The React component switches from `style={styles.X}` to `className="geoglows-signin-X"`. Single source of truth for any future visual change. Trade-off explicit: visual changes to vanilla flow into React automatically.
- **Aquiferx imports the CSS once at `index.tsx`** rather than from inside the component. Side-effect import; matches the vanilla-consumer pattern.
- **`<SupabaseAuthUI>` props (additive):**
  - `allowSignUp?: boolean` — default `true` (matches vanilla). When `false`, no sign-up toggle, no sign-up view.
  - `onClose?: () => void` — when provided, the lib renders `.geoglows-signin-close` X in the header. Aquiferx wires this (its outer dialog has no rendered X — only Escape + backdrop).
  - `oauthRedirectTo?: string` — default `window.location.origin`. Sanitized via `sanitizeHref` before forwarding to the adapter; rejection falls back to `window.location.origin`.
  - `emailRedirectTo?: string | undefined` — **REQUIRED at the type level when `allowSignUp` is `true`** (TypeScript discriminated union). No default — silent fallback to `window.location.origin` would land sub-app sign-up confirmations on the wrong origin. Sanitized via `sanitizeHref` before forwarding.
  - **No `oauthProviders` prop.** Google + GitHub render unconditionally (matches vanilla). If a future consumer needs provider filtering, the prop ships in that plan.
- **Sign-up `metadata` shape:** `{ first_name, last_name }`. Same as vanilla. `ensureProfile` only consults `user_metadata` on profile creation per the lib's existing invariant.
- **OAuth click → loading state:** clicked button enters disabled+loading visual state ("Signing in…" + spinner), other OAuth button also disabled to prevent double-action. State persists until `window.location.assign` fires or an error is caught. No timeout — OAuth is terminal-by-design (page navigates away). On browser-back from the OAuth provider (page restored from bfcache), the `pageshow` event resets pending state.
- **Same-tab navigation for both Profile and back-to-portal.** OAuth full-redirects via Supabase JS internals (not a direct `window.location.assign` from this lib's code). Same as vanilla.
- **Magic-link visibility:** existing toggle ONLY in `signIn` view. NOT shown in `signUp` view. The `magicLinkSent` confirmation reuses `.geoglows-signin-confirmation` classes (same look as `signUpSent`), not the legacy gray-box inline styles.
- **Internal view state is NOT preserved across unmount.** If the consumer unmounts `<SupabaseAuthUI>` (e.g., aquiferx switches to forgot-password view), the next mount returns to `view: signIn`. Acceptable: the only stateful in-progress flow is sign-up form data, which a user pursuing forgot-password would not have.
- **`onClose` handles consumer-driven close only.** Escape and backdrop close are owned by the consumer's outer dialog (which fires aquiferx's `setSignInModalOpen(false)`). Clicking the lib's X also calls `onClose`, which closes the same dialog through the same path. One source of truth for closing; lib does NOT call `dialog.close()` itself.
- **Lib version bump 1.4.0 → 1.5.0** (minor, additive — new optional props, no breaking changes).
- **Provider button order:** Google first, GitHub second (matches vanilla).

## Open Questions

### Resolved During Planning

- **Reuse `sign-in.css` or inline styles?** → Reuse. Trade-off documented (cross-surface coupling).
- **Magic-link: keep, move to OAuth row, or remove?** → Keep as-is in `signIn` view. Out of scope to consolidate.
- **More OAuth providers?** → Out of scope. Google + GitHub only (matches vanilla).
- **Per-provider `oauthProviders` prop?** → No. Render both unconditionally; defer the prop to a plan that actually adds another provider.
- **Sign-up first/last name required or optional?** → Required (matches vanilla; populates `user_metadata` for `ensureProfile`).
- **`emailRedirectTo` default?** → No silent default. Required at the type level when `allowSignUp=true`. Avoids the silent UX trap where a consumer forgets to override and confirmation lands on a sub-app origin with no profile UI.
- **Aquiferx wires `onClose` to the lib's X?** → Yes. Aquiferx's outer dialog has NO rendered X today; without `onClose` wired, the visual parity goal misses.
- **Lib version?** → 1.5.0 (minor, additive).
- **Aquiferx imports CSS at `index.tsx`** → Yes — entry-point convention; matches the vanilla-consumer pattern.
- **Magic-link confirmation visual treatment?** → Use `.geoglows-signin-confirmation` classes, same as `signUpSent`. Migrate away from the legacy inline gray-box.
- **Magic-link visible in signUp view?** → No. Hidden when `view === 'signUp'`.
- **Sign-up cancel/back affordance?** → Sign-up form has an explicit `Back` link returning to `signIn` view (not just the toggle). User who started sign-up can abandon without committing.
- **Focus management on view transitions?** → Focus moves to first input on each view transition (signIn email, signUp first-name, magicLinkSent confirmation back-button, signUpSent back-to-sign-in button).
- **OAuth back-button recovery?** → Reset pending state on `pageshow` event (handles bfcache restoration after the user aborts OAuth via browser back).
- **Cross-tab sign-up flow?** → User submits sign-up → `signUpSent`. User confirms in email tab → lands on portal `#profile`. If the aquiferx tab is still open, it remains in `signUpSent` view; "Back to sign in" returns to `signIn` with email pre-filled. Cross-app SSO does NOT propagate from the portal tab to the already-open aquiferx tab (different origins). Documented limitation; copy in `signUpSent` view sets expectations: "Confirm in the portal, then return here to sign in."

### Deferred to Implementation

- **Pixel-level visual diff between aquiferx's outer `<dialog>` and the vanilla `.geoglows-signin-modal`.** Pre-flight requirement: render aquiferx + portal modals side-by-side at the same viewport BEFORE lib publish. If the frame treatments differ visibly, fix at that point — not as a post-merge follow-up.

## Implementation Units

### Phase A — Lib (`@aquaveo/geoglows-auth` 1.4.0 → 1.5.0)

- [ ] **Unit 1: Lib — `<SupabaseAuthUI>` rewrite (OAuth + sign-up + CSS classes)**

**Goal:** Rewrite `<SupabaseAuthUI>` to mirror the vanilla `renderSignInOrSignUp` HTML structure: OAuth buttons + divider + email/password form, with a sign-up toggle that switches to a sign-up form (first/last name + email + password) and a `signUpSent` confirmation view. Use the existing `sign-in.css` classes throughout.

**Requirements:** R1, R2, R3, R4, R6.

**Dependencies:** None.

**Files:**
- Modify: `geoglows-auth/src/react/SupabaseAuthUI.tsx` — rewrite. Same export, same existing props plus new optional props.
- Modify: `geoglows-auth/tests/react/SupabaseAuthUI.test.tsx` — extend coverage.

**Approach:**
- Component state: view machine `'signIn' | 'signUp' | 'signUpSent' | 'magicLinkSent'` PLUS a parallel boolean `magicLinkActive: boolean` that only matters when `view === 'signIn'`.
  - When `magicLinkActive=true` AND `view='signIn'`: form renders email-only (no password field), submit reads "Send sign-in link", OAuth row + "or with email" divider stay visible above. Forgot-password and sign-up toggles are hidden.
  - When `magicLinkActive=false` AND `view='signIn'`: full email + password form.
  - On magic-link submit success → `view='magicLinkSent'`. From `magicLinkSent`, "Use a different email" sets `magicLinkActive=true, view='signIn', email=''`; "Use a password instead" sets `magicLinkActive=false`.
  - When `view='signUp'`: magic-link toggle is HIDDEN; form is name grid + email + password.
- New props (additive):
  - `allowSignUp?: boolean` — default `true`. When `false`, no sign-up toggle and no sign-up view.
  - `onClose?: () => void` — when provided, the header renders `<button class="geoglows-signin-close" aria-label="Close">×</button>`. Click calls `onClose`. When the prop is omitted, no X renders.
  - `oauthRedirectTo?: string` — default `window.location.origin`. Passed through `sanitizeHref`; if rejected, falls back to `window.location.origin` and logs a console warning.
  - `emailRedirectTo?: string` — when `allowSignUp=true`, this prop is required by TypeScript discriminated union (consumer must pass it explicitly; no silent default that lands on the wrong origin). Forwarded to `signUpWithPassword`. Sanitized via `sanitizeHref` before forwarding.
  - **Removed from earlier draft:** `oauthProviders` prop. Render Google + GitHub unconditionally (matches vanilla). Add per-provider control later if a real consumer needs it.
- Render structure (signed-in state machine):
  1. **`signIn`** view (default): close X (if `onClose`) → OAuth buttons (Google + GitHub) → divider "or with email" → email form (email + password — or email-only when `magicLinkActive`) → forgot-password link (if `onForgotPasswordClick`, password mode only) → submit "Sign in" or "Send sign-in link" → "Sign in with a magic link instead" / "Sign in with a password instead" toggle → "New here? Create an account" toggle (if `allowSignUp`). Error banner (if any) renders ABOVE the OAuth row, matching vanilla. Initial focus: email input.
  2. **`signUp`** view: close X (if `onClose`) → "Back" link → "Create your account" heading → name grid (first/last) → email → password → submit "Create account" → "Already have an account? Sign in" toggle. No OAuth row, no magic-link toggle. Error banner above the name grid. Initial focus: first-name input.
  3. **`signUpSent`** view: close X (if `onClose`) → "Check your email" heading → body text ("If this email is new, we sent a confirmation link. Click it to finish creating your account. Confirm in the portal, then return here to sign in.") → "Back to sign in" button (transitions to `signIn` view with `email` preserved, `password` cleared). Initial focus: back-to-sign-in button.
  4. **`magicLinkSent`** view: close X (if `onClose`) → "Check your email" heading → body text → "Use a different email" button (transitions to `signIn` view with `magicLinkActive=true`, email cleared) → "Use a password instead" button (transitions to `signIn` view with `magicLinkActive=false`). Uses `.geoglows-signin-confirmation` + `.geoglows-signin-confirmation-text` + `.geoglows-signin-confirmation-back` classes — same visual treatment as `signUpSent`. Initial focus: "Use a different email" button.
- OAuth click handler:
  ```
  setOauthPending(provider);  // disables both OAuth buttons; clicked one shows spinner
  const safeRedirect = sanitizeHref(oauthRedirectTo) ?? window.location.origin;
  void adapter.signInWithOAuth({ provider, redirectTo: safeRedirect })
    .catch((err) => { setOauthPending(null); setError(GENERIC_OAUTH_ERROR); onError?.(err); });
  ```
  Pending state is reset on `pageshow` event listener (handles browser back / bfcache restoration after the user aborts at the OAuth provider).
- Sign-up submit handler:
  ```
  const safeEmailRedirect = sanitizeHref(emailRedirectTo) ?? window.location.origin;
  await adapter.signUpWithPassword({ email, password, emailRedirectTo: safeEmailRedirect, metadata: { first_name, last_name } });
  ```
  On success → `view='signUpSent'`. On error → render `GENERIC_SIGNUP_ERROR` + raw error via `onError`; password field cleared.
- All HTML uses `className="geoglows-signin-X"` from `sign-in.css`. Header `<button class="geoglows-signin-close" aria-label="Close">×</button>` only renders when `onClose` is provided.
- Inline Google + GitHub SVGs (copy from `sign-in.ts:941-946, 955-957`). The SVGs are `aria-hidden="true"`; the button text ("Continue with Google") is the accessible name.
- Replace `styles` constant with the className references; remove the `styles` object entirely.
- **Touch targets**: OAuth buttons + submit buttons inherit `padding: 0.625rem 1rem` from `.geoglows-signin-provider-button` and `.geoglows-signin-submit` — already meets 44px iOS HIG minimum height.
- **Responsive name grid**: `.geoglows-signin-name-grid` is `grid-template-columns: 1fr 1fr` in vanilla CSS. If the modal width drops below ~360px, add a `@media (max-width: 360px)` rule that collapses it to `1fr`. Pre-flight: check whether vanilla CSS already does this; if so, no work needed.

**Execution note:** Test-first.

**Patterns to follow:**
- Vanilla `renderSignInOrSignUp` HTML structure (line 854-1013 of `sign-in.ts`).
- Vanilla `handleOAuth` adapter call signature (line 487-494).
- Existing React error-handling discipline: visible `GENERIC_*` strings, raw errors to `onError`.
- Existing 1.4.0 `sanitizeHref` pattern (not directly applicable here, but the same defensive-by-default principle applies for `redirectTo`).

**Test scenarios** (use Testing Library role-based queries — `getByRole`, `getByLabelText` — matching the existing test style; do NOT add class-based snapshot assertions):
- *Happy path:* render in `signIn` view; assert role-button "Continue with Google", role-button "Continue with GitHub", role-textbox "Email", role-textbox "Password", role-button "Sign in", role-button "Create an account" all present.
- *Happy path (OAuth):* click "Continue with Google"; assert `adapter.signInWithOAuth` called with `{ provider: "google", redirectTo: <safe value> }`. Both OAuth buttons disabled; clicked button shows "Signing in…" label. Other OAuth button disabled.
- *Happy path (OAuth):* click "Continue with GitHub"; assert call with `{ provider: "github", ... }`.
- *OAuth recovery:* fire `pageshow` event after OAuth click → assert pending state is reset, both OAuth buttons re-enabled.
- *Happy path:* fill email + password, submit; assert `adapter.signInWithPassword` called and `onSuccess` fires.
- *Sign-up flow:* `allowSignUp={true}`, `emailRedirectTo="https://example.com/profile"`, click "Create an account" → view transitions to `signUp`; first/last name inputs present; magic-link toggle NOT visible; OAuth row NOT visible. Initial focus on first-name input.
- *Sign-up submit:* fill sign-up form, submit; assert `adapter.signUpWithPassword` called with `{ email, password, emailRedirectTo, metadata: { first_name, last_name } }`; view transitions to `signUpSent`.
- *Sign-up `Back` link:* in `signUp` view, click `Back` → returns to `signIn` view with name fields cleared, email preserved.
- *signUpSent → signIn:* click "Back to sign in"; assert view returns to `signIn`, email pre-filled with sign-up email, password field empty.
- *TypeScript: required `emailRedirectTo`*: type-check that omitting `emailRedirectTo` while passing `allowSignUp=true` is a compile error.
- *Backward compat:* render with no new props (allowSignUp defaults to true, no emailRedirectTo passed) → with TypeScript discriminated union, this should be a compile error if allowSignUp is true. (To preserve the simplest backward-compat call site, the discriminated union should allow `allowSignUp=false` to omit `emailRedirectTo`.)
- *Edge case (no sign-up):* `allowSignUp={false}`; assert no sign-up toggle, no `signUp` view reachable, no `emailRedirectTo` required.
- *Edge case (close X):* `onClose={fn}`; assert role-button "Close" renders and clicking it calls `fn`. Without `onClose`, no close button in DOM.
- *Edge case (close X path semantics):* render with `onClose={fn}`, click the close X, assert `fn` is called exactly once. The lib does NOT call `dialog.close()` itself — the consumer's `onClose` is the only side-effect. (This is the contract that lets aquiferx's outer `<dialog>` close-event cleanup fire correctly when its existing useEffect calls `dialog.close()` after the state update.)
- *Edge case (sanitizeHref on `oauthRedirectTo`):* `oauthRedirectTo="javascript:alert(1)"`; assert OAuth click uses `window.location.origin` (sanitized fallback), console warning logged.
- *Edge case (sanitizeHref on `emailRedirectTo`):* `emailRedirectTo="javascript:alert(1)"`; assert sign-up call uses `window.location.origin`, console warning logged.
- *Error path:* OAuth click rejects; assert `GENERIC_OAUTH_ERROR` visible, raw error in `onError`, OAuth buttons re-enabled.
- *Error path:* sign-up rejects; assert `GENERIC_SIGNUP_ERROR` visible, raw error in `onError`, password field cleared, name fields preserved.
- *Error path:* sign-in rejects; existing behavior (already covered).
- *Magic-link in signIn view:* click "Sign in with a magic link instead"; assert password input hidden, submit button reads "Send sign-in link", forgot-password link hidden, sign-up toggle hidden.
- *Magic-link in signUp view:* in `signUp` view, assert magic-link toggle is NOT in DOM.
- *Magic-link confirmation:* submit magic-link → view='magicLinkSent'; classes `.geoglows-signin-confirmation` + `.geoglows-signin-confirmation-back` present (visual restyle); not the legacy gray-box inline styles.
- *Backward compat:* existing tests for password sign-in / forgot-password link / `onSuccess` callback all still pass.

**Verification:**
- ~17 new test cases pass; existing 26 SupabaseAuthUI tests still pass (or are updated to match the new role names where unambiguous).
- Visual: side-by-side comparison with portal modal at the same viewport (manual; PRE-publish, not post-deploy).

---

- [ ] **Unit 2: Lib — `sign-in.css` review (no changes expected)**

**Goal:** Verify all classes the React rewrite uses already exist in `sign-in.css`. If any state in the React form lacks a vanilla equivalent, add a class — do NOT inline-style.

**Requirements:** R4 (visual parity).

**Dependencies:** Unit 1 (rewrite identifies any missing classes).

**Files:**
- Possibly modify: `geoglows-auth/src/core/sign-in.css` — only if Unit 1 surfaces a missing class.

**Approach:**
- Diff the React rewrite against `sign-in.css` exports.
- Expected outcome: zero CSS changes — every state has a vanilla counterpart. If the magic-link "Use a different email address" sub-state needs a class that doesn't exist, add it.
- If new classes are needed, add them under a `/* ─── React parity (1.5.0) ─── */` comment block at the bottom.

**Execution note:** Pragmatic — diff-first, change only if needed.

**Patterns to follow:**
- Existing class naming: `.geoglows-signin-{noun}` or `.geoglows-signin-{noun}-{modifier}`.
- Light-theme defaults; dark-theme `[data-theme="dark"]` overrides at the bottom of the file.

**Test scenarios:**
- N/A — pure CSS hygiene.

**Verification:**
- Manual: open the React modal in a browser preview, compare to the vanilla modal at the same viewport.

---

- [ ] **Unit 3: Lib release — version 1.5.0 + CHANGELOG**

**Goal:** Ship the new public API.

**Requirements:** Release prerequisite for Phase B.

**Dependencies:** Units 1, 2.

**Files:**
- Modify: `geoglows-auth/package.json` — version `1.4.0` → `1.5.0`.
- Modify: `geoglows-auth/CHANGELOG.md` — `[1.5.0]` entry.
- Modify: `geoglows-auth/CLAUDE.md` — note the new `<SupabaseAuthUI>` shape in Key Files; add the `user_metadata` render-untrusted invariant (Context > Institutional Learnings); document the `sign-in.css` cross-surface coupling (visuals shared between vanilla + React).

**Approach:**
- Minor bump (additive): all changes to `<SupabaseAuthUI>` are additive props with backward-compatible defaults. CSS classes are additive (no class renames, no removals).
- CHANGELOG entry covers: OAuth buttons, sign-up state machine, `signUpSent` view, new optional props (`allowSignUp`, `oauthRedirectTo`, `emailRedirectTo`, `onClose`). NO `oauthProviders` prop (rejected). `emailRedirectTo` is required at the type level when `allowSignUp=true` (TypeScript discriminated union — no silent default that lands on the wrong origin). CSS class migration: consumer must `import "@aquaveo/geoglows-auth/core/sign-in.css"` to see the new visuals — flag this clearly.

**Test scenarios:**
- N/A.

**Verification:**
- After merge: `npm publish` (2FA OTP) + `git tag v1.5.0 && git push --tags`. `prepublishOnly` enforces build + test.

### Phase B — Aquiferx integration

- [ ] **Unit 4: Aquiferx — bump lib + import CSS + wire `<SupabaseAuthUI>` props**

**Goal:** Bump aquiferx's lib dep to `^1.5.0`, import the lib's `sign-in.css` once at `index.tsx`, and pass the new props (`onClose`, `oauthRedirectTo`, `emailRedirectTo`) to `<SupabaseAuthUI>`. Aquiferx's outer state machine is unchanged — the new `signUpSent` view is internal to the lib component.

**Requirements:** R5, R7.

**Dependencies:** Unit 3 (lib 1.5.0 published).

**Files:**
- Modify: `aquiferx/package.json` — `@aquaveo/geoglows-auth` `^1.4.0` → `^1.5.0`.
- Modify: `aquiferx/index.tsx` — add `import "@aquaveo/geoglows-auth/core/sign-in.css"` after the recovery-url-snapshot import (CSS imports run for side effects only; ordering doesn't affect the recovery-url snapshot semantics).
- Modify: `aquiferx/App.tsx`:
  - **Do NOT extend** `SignInView` union. Existing 5 entries (`signIn`, `forgotPassword`, `resetEmailSent`, `setNewPassword`, `recoveryError`) stay. The lib's `signUpSent` view is internal — aquiferx's outer state never observes it.
  - Pass to `<SupabaseAuthUI>`:
    - `onClose={() => setSignInModalOpen(false)}` — aquiferx's outer dialog has NO rendered close X today (verified at App.tsx:2143-2175); wiring `onClose` makes the lib render its `.geoglows-signin-close` X inside the modal content. This is the visual-parity fix for the close affordance.
    - `oauthRedirectTo={window.location.origin}` — OAuth lands back on aquiferx (so the user remains in their sub-app context).
    - `emailRedirectTo={`${PORTAL_URL}/#profile`}` — sign-up confirmation lands on the portal where profile-completion lives. PORTAL_URL is the existing `VITE_PORTAL_URL` constant from plan 004.
  - Update the `signUpSent` body copy expectation: aquiferx users will see "Confirm in the portal, then return here to sign in" — this is the lib's default copy and aquiferx accepts it (cross-app SSO does NOT propagate from the portal tab to the already-open aquiferx tab; user signs in on aquiferx after confirmation).

**Approach:**
- Lib version bump: standard `npm install --legacy-peer-deps` after `package.json` edit.
- CSS import: side-effect import after `./recovery-url-snapshot` and before `./auth`. The CSS file is small (8KB minified) and styles no DOM that aquiferx didn't ask for — only the `geoglows-signin-*` classes (and `.geoglows-auth-action-*` classes which aquiferx isn't using; harmless if loaded).
- Pre-flight visual diff: render aquiferx + portal modals side-by-side at the same viewport on a Vercel preview — BEFORE the lib publish. Resolve frame-level differences (Tailwind dialog classes vs `.geoglows-signin-modal`) at this point, not as a post-deploy follow-up.

**Patterns to follow:**
- Existing `index.tsx` import order — recovery-url-snapshot stays first.
- Existing `App.tsx` view-machine pattern.
- Existing `VITE_PORTAL_URL` constant (App.tsx line 18-22 from plan 004).

**Test scenarios:**
- Test expectation: none — aquiferx has no test infrastructure. `npx tsc --noEmit` covers types; manual smoke covers UX.

**Verification:**
- `npx tsc --noEmit` — clean (no new errors beyond the pre-existing `TimeSeriesChart.tsx` recharts error).
- `npx vite build` — clean.
- Manual smoke (post-deploy):
  - Open aquiferx sign-in modal — visual parity with portal modal: rounded inputs, OAuth buttons, "or with email" divider, full-width blue Sign in button.
  - Click "Continue with Google" — redirects to Google OAuth flow.
  - Click "Continue with GitHub" — redirects to GitHub OAuth flow.
  - Click "Create an account" — view switches to sign-up form (first/last name + email + password).
  - Submit valid sign-up — view switches to "Check your email" confirmation; click "Back to sign in" returns to sign-in.
  - Submit invalid sign-up (e.g., already-registered email) — generic error renders; password cleared.
  - Click "Forgot password?" — existing forgot-password flow triggers; aquiferx's `<PasswordResetForm>` renders.
  - Magic-link toggle still works.

## System-Wide Impact

- **Interaction graph:** `<SupabaseAuthUI>` gains 2 new internal-state views (`signUp`, `signUpSent`) on top of the existing `signIn` and `magicLinkSent` views, and reuses CSS from the same file as the vanilla modal. Aquiferx's outer state machine is unchanged. apps.geoglows + grace + rfs unaffected.
- **Cross-tab sign-up flow (documented limitation):** User submits sign-up in aquiferx → sees `signUpSent` view. User opens email in another tab → clicks link → lands on `${PORTAL_URL}/#profile`. The aquiferx tab is still in `signUpSent` state and still has no session. Cross-app SSO does NOT propagate from the portal tab back to the already-open aquiferx tab (different origins; `localStorage` is per-origin). User must (a) close the aquiferx tab and re-enter, OR (b) click "Back to sign in" and re-authenticate on aquiferx. The `signUpSent` body copy explicitly sets this expectation: "Confirm in the portal, then return here to sign in."
- **Error propagation:** New error paths (OAuth, sign-up). Both surface generic messages in the form + raw errors via `onError`. Same discipline as existing password-error path.
- **API surface parity:** Vanilla and React surfaces now have similar feature sets (OAuth, sign-up). Magic link remains React-only.
- **Integration coverage:** Manual smoke is the only viable end-to-end coverage for OAuth flows (full-redirect to Google/GitHub). Lib-side tests cover the API logic.
- **Unchanged invariants:**
  - Vanilla `mountSignInModal` — apps.geoglows + grace + rfs use this; unchanged.
  - `sign-in.css` classes — unchanged (additive only if Unit 2 surfaces a gap, e.g. `@media (max-width: 360px)` collapse on `.geoglows-signin-name-grid`).
  - Lib adapter API (`SupabaseAuthAdapter`) — unchanged.
  - Aquiferx's outer dialog frame, recovery-url-snapshot, forgot-password / setNewPassword wiring — unchanged.
  - apps.geoglows / grace / rfs — completely untouched by this plan.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| OAuth `redirectTo` allowlist mismatch on Vercel preview branches | **Decision: document the limitation.** Supabase allowlist contains only `https://aquiferx-bay.vercel.app` (production). OAuth on preview branches will fail with `redirect_uri_mismatch` (surfaced to the user as `GENERIC_OAUTH_ERROR`). Preview-branch OAuth testing is not supported; preview testing uses email/password + magic-link only. Document in `aquiferx/CLAUDE.md` so future engineers don't waste time debugging. If aquiferx ever needs preview OAuth verification, revisit with the wildcard or per-branch deploy-hook strategies. |
| Sign-up `emailRedirectTo` allowlist mismatch | **Pre-flight: verify `https://portal-dev.geoglows.org/` is in the Supabase redirect-URLs allowlist (NO `#profile` fragment — Supabase strips fragments before matching).** The hash routes client-side after redirect lands; it's invisible to Supabase. |
| Aquiferx ships sign-up but the email-confirmation link lands on the portal — cross-tab session does NOT propagate back to the open aquiferx tab | Documented limitation; `signUpSent` body copy sets expectation: "Confirm in the portal, then return here to sign in." Acceptable for v1; the alternative (aquiferx-as-confirmation-target) requires aquiferx to grow a profile-completion UI, which is a separate plan. |
| CSS class collision with aquiferx's Tailwind preflight | Low risk: apps.geoglows already imports `sign-in.css` under Tailwind v4 in production. The CSS uses property-level resets explicitly (`border: 0`, `background: transparent`, `box-sizing: border-box`) rather than `:where()` workarounds. Pre-flight visual diff covers this. |
| Magic-link regression during the rewrite | Existing tests cover magic-link mode + magic-link-sent confirmation. New tests assert magic-link toggle still works AND is hidden in `signUp` view. Pre-flight visual review covers the new `.geoglows-signin-confirmation`-class treatment. |
| Sign-up flow blocked by Supabase email-confirmation project setting | The lib's `signUpWithPassword` returns the same `data: { user, session }` shape Supabase exposes. If `session` is null AND `user` is non-null, email confirmation is required (well-known Supabase pattern). The modal transitions to `signUpSent` regardless — copy in that view says "If this email is new, we sent a confirmation link." Existing copy is correct. |
| OAuth pending state never resets if navigation is interrupted | `pageshow` event listener resets pending state on bfcache restoration. No timeout — OAuth is terminal-by-design (page navigates away on success). Test scenario covers the back-button case. |
| Dangerous URL schemes in `oauthRedirectTo` / `emailRedirectTo` (consumer accidentally passes user input) | Both props pass through `sanitizeHref` from 1.4.0 (rejects `javascript:`/`data:`/`vbscript:`). Rejection falls back to `window.location.origin` and logs a console warning. Test scenarios cover both props with `javascript:alert(1)` payload. |
| Magic-link `redirectTo` allowlist not addressed | Aquiferx does not pass `magicLinkRedirectTo` today — Supabase falls back to the project's Site URL. No new allowlist entry needed. If aquiferx ever overrides `magicLinkRedirectTo` (especially to a preview URL), that URL must be allowlisted too. Document in the operational runbook. |
| Sign-up `metadata` flowing into rendered UI introduces stored XSS via `core.profiles` | Documented as a permanent invariant in `geoglows-auth/CLAUDE.md`: `user_metadata` is render-untrusted at all sites. Vanilla path uses `escapeHtml`; React path uses JSX auto-escape. Future modifications to `ensureProfile` or any new render site must preserve this. |

## Documentation / Operational Notes

- **`geoglows-auth/CHANGELOG.md`** — `[1.5.0]` entry covering: `<SupabaseAuthUI>` OAuth buttons, sign-up state machine, `signUpSent` view, new optional props (`allowSignUp`, `onClose`, `oauthRedirectTo`, `emailRedirectTo`). `emailRedirectTo` is required at the type level when `allowSignUp=true`. CSS classes are a shared visual contract across vanilla + React surfaces; consumers must `import "@aquaveo/geoglows-auth/core/sign-in.css"` to see the new visuals. Documents the `user_metadata` render-untrusted invariant. No `oauthProviders` prop (rejected as premature abstraction).
- **`geoglows-auth/CLAUDE.md`** — update `src/react/SupabaseAuthUI.tsx` line item: "OAuth + sign-up + restyled to match vanilla via `sign-in.css`. Consumers must import the CSS once at app entry. Sign-up `metadata` is render-untrusted at all sites — preserve `escapeHtml` in vanilla and JSX auto-escape in React."
- **`aquiferx/CLAUDE.md`** — note the `sign-in.css` import in `index.tsx`. Document the cross-tab sign-up flow expectation (user confirms in portal tab → returns to aquiferx → re-signs-in). **Document the OAuth-on-preview-branches limitation**: Supabase allowlist contains only the production aquiferx origin, so OAuth clicks from Vercel preview deploys will fail with `redirect_uri_mismatch` (rendered as the generic OAuth error). Preview-branch testing of auth flows uses email/password + magic-link only.
- **Operational runbook after merge:**
  1. Lib publish: `npm publish` (1.5.0; `prepublishOnly` enforces build + test).
  2. Tag and push: `git tag v1.5.0 && git push --tags`.
  3. Pre-flight Supabase allowlist check (BEFORE merging aquiferx):
     - **OAuth redirect URLs**: production `https://aquiferx-bay.vercel.app` (origin only, no path/hash). Preview branches are NOT allowlisted — OAuth on previews is documented as not supported.
     - **Email-confirmation redirect**: `https://portal-dev.geoglows.org/` (NO trailing path/hash — Supabase strips both before matching).
  4. Aquiferx PR (Unit 4) lands; Vercel auto-deploys.
  5. Pre-flight visual diff on Vercel preview: aquiferx modal looks identical to portal modal at the same viewport (rounded inputs, OAuth buttons, blue Sign in, close X position).
  6. Smoke from aquiferx (production deploy): Google OAuth, GitHub OAuth, sign-up flow (verify email lands on portal `/#profile`), magic-link toggle, forgot-password flow all work. Browser-back from OAuth provider (test recovery via `pageshow`).
  7. **Recovery-session cleanup verification (load-bearing for password-recovery flow)**: Open aquiferx with a recovery URL (`#access_token=...&type=recovery`). Modal opens in `setNewPassword` view. Click the lib's close X (NOT escape, NOT backdrop). Verify in localStorage / dev tools that the recovery session was cleared (the user is signed out, not lingering as a logged-in recovery user). This validates the close-X path: lib's X → `onClose` → `setSignInModalOpen(false)` → useEffect calls `dialog.close()` → `<dialog>`'s close event → aquiferx's existing G2 cleanup runs (`auth.signOutRedirect()` if `setNewPassword` view didn't complete). If this smoke fails, the lib has incorrectly called `dialog.close()` itself and bypassed the React state path.
- **`docs/solutions/`** — at least two new learnings worth capturing post-implementation:
  1. React + vanilla components reusing the same plain-CSS file as a single source of truth — pattern, gotchas (consumer must `import` the CSS), trade-offs (cross-surface coupling for visuals).
  2. `user_metadata` render-untrusted invariant — sign-up metadata must be escaped at every render site; future profile shortcut paths in `ensureProfile` must preserve this.

## Sources & References

- Related code: `geoglows-auth/src/core/sign-in.ts` (vanilla reference), `geoglows-auth/src/core/sign-in.css`, `geoglows-auth/src/react/SupabaseAuthUI.tsx`, `aquiferx/App.tsx`, `aquiferx/index.tsx`.
- Related plans: `2026-04-30-002-feat-forgot-password-flow-plan.md` (vanilla forgot-password), `2026-04-30-003-feat-aquiferx-forgot-password-plan.md` (React forgot-password), `2026-04-30-004-feat-profile-routing-back-to-portal-plan.md` (`VITE_PORTAL_URL` env var aquiferx already uses).
- External docs: [Supabase Auth — `signUp`](https://supabase.com/docs/reference/javascript/auth-signup), [Supabase Auth — Social login](https://supabase.com/docs/guides/auth/social-login).
