---
title: Password recovery email silently signs the user in without showing the setNewPassword modal
date: 2026-05-02
category: logic-errors
module: geoglows-auth-integration
problem_type: logic_error
component: authentication
symptoms:
  - Clicking the password-recovery email link silently establishes a recovery session but the setNewPassword modal never appears
  - Recovery snapshot resolves kind 'valid' and signInModalOpen seeds to true, yet no dialog is visible on screen
  - Affects all four GEOGloWS portal apps (apps.geoglows, aquiferx, grace-groundwater-dashboard, rfs-v2-hydroviewer) in production builds
  - Module-level recovery-URL detector reads an already-cleared window.location.hash despite being imported before ./auth
  - In aquiferx, the [signInModalOpen] dialog effect early-returns because signInDialogRef.current is null while the loading screen is still rendered
root_cause: async_timing
resolution_type: code_fix
severity: high
related_components:
  - aquiferx
  - apps.geoglows
  - grace-groundwater-dashboard
  - rfs-v2-hydroviewer
  - "@aquaveo/geoglows-auth"
  - supabase-js
  - vite
tags:
  - password-recovery
  - supabase-auth
  - bundler-ordering
  - react-effects
  - dialog-ref
  - vite
  - geoglows-portal
  - regression
---

# Password recovery email silently signs the user in without showing the setNewPassword modal

## Problem

End users clicking the password-reset link in their recovery email landed on the app already authenticated, but the "Set New Password" modal never appeared — leaving them silently signed in with no way to actually choose a new password. The flow looked successful from a session standpoint (recovery session was established) but completely failed from a UX standpoint. This affected the recovery flow across aquiferx (React) and the vanilla apps (apps.geoglows, grace-groundwater-dashboard, rfs-v2-hydroviewer).

## Symptoms

- Recovery email click navigated to the app, the user was authenticated (Supabase session created), but no UI prompted them for a new password.
- URL on arrival showed an empty hash (`/aquifer-analyst#`) — Supabase JS had already consumed and cleared `#access_token=...&type=recovery` before app code could read it.
- `recovery-url-snapshot.ts`'s `initialRecoveryUrlState` returned `{ kind: 'none' }` despite the original URL containing `&type=recovery`.
- In aquiferx specifically (post-bundler-fix): all auth events fired correctly (`PASSWORD_RECOVERY`, `INITIAL_SESSION`, `SIGNED_IN`), `window.__GEOGLOWS_RECOVERY_STATE__` was `{ kind: 'valid' }`, `signInView` was `'setNewPassword'`, but the `<dialog>` never opened. No console errors.
- Manually running `document.querySelector('dialog').showModal()` in DevTools opened the modal correctly — proving the dialog itself worked and the break was upstream of `showModal()`.

## What Didn't Work

- **Adding 3-variant Supabase Redirect URL allowlist entries (bare / trailing slash / `/**`)** — symptom-only fix. The real issue at that stage was that `window.location.origin` strips the proxy path, redirecting users to the portal root instead of `/aquifer-analyst`.
- **Switching `defaultRedirectTo` to `window.location.origin + window.location.pathname`** (aquiferx#7, apps.geoglows#29, grace#8, rfs#8) — necessary and merged, but only got users back to the right path. The recovery hash was still being consumed before snapshot code ran.
- **Importing `recovery-url-snapshot.ts` before `./auth` in `index.tsx` source order** (the 2026-04-30 precursor fix; see plan `apps.geoglows/docs/plans/2026-04-30-003-feat-aquiferx-forgot-password-plan.md` "Race-proof regardless of listener timing") — superseded. ES module evaluation in Vite production builds doesn't reliably honor source-level import order; Supabase's `_initialize()` still ran before the snapshot module captured `window.location.hash`. (session history)
- **Testing on Vercel preview URLs with deployment protection enabled** — the SSO redirect through `vercel.com/sso-api?url=...` strips the URL fragment before the page loads, so auth flows that depend on `#access_token=...` cannot be validated against protected previews. Use production or non-protected previews only.
- **Hash-stripping inside the snapshot module** — the first cut of `recovery-url-snapshot.ts` stripped `window.location.hash` after capturing it. Supabase JS needs the hash intact in `_initialize()` to establish the recovery session, so stripping it would prevent recovery from working at all. The strip belongs in the `PASSWORD_RECOVERY` event handler, after Supabase has consumed the hash. (session history)

## Solution

Two compounding fixes were required. Fix 1 applies to all four apps; Fix 2 is React-specific to aquiferx.

### Fix 1 — Bundler-order race

Capture `window.location` synchronously via an inline `<script>` in `index.html` that runs during HTML parsing — before any `<script type="module">` is fetched or evaluated.

**`aquiferx/index.html`** (and the equivalent in `apps.geoglows`, `grace-groundwater-dashboard`, `rfs-v2-hydroviewer`):

```html
<script>
  // Capture window.location synchronously BEFORE the module bundle is
  // fetched so the password-recovery snapshot can read the original
  // hash even after Supabase JS has consumed and cleared it. Bundler
  // module-evaluation ordering doesn't always match source-level
  // import order.
  window.__GEOGLOWS_INITIAL_URL__ = {
    hash: window.location.hash,
    search: window.location.search,
  };
</script>
<script type="module" src="./index.tsx"></script>
```

**`aquiferx/recovery-url-snapshot.ts`** — read from the inline-captured object first, fall back to live `window.location` only when unavailable (SSR/tests):

```ts
function readInitialUrl(): InitialUrl {
  if (typeof window === "undefined") return { hash: "", search: "" };
  const inline = window.__GEOGLOWS_INITIAL_URL__;
  if (inline && typeof inline.hash === "string" && typeof inline.search === "string") {
    return { hash: inline.hash, search: inline.search };
  }
  return { hash: window.location.hash, search: window.location.search };
}

export const initialRecoveryUrlState: RecoveryUrlState =
  typeof window === "undefined"
    ? { kind: "none" }
    : detectRecoveryUrlState(readInitialUrl());
```

**Vanilla equivalent** (`grace`/`rfs` `auth-bootstrap.js`, `apps.geoglows` `main.js`):

```js
const initial = window.__GEOGLOWS_INITIAL_URL__;
const hash = (initial && typeof initial.hash === "string")
  ? initial.hash
  : window.location.hash;
const search = (initial && typeof initial.search === "string")
  ? initial.search
  : window.location.search;
```

### Fix 2 — Dialog mount race

In aquiferx's `App.tsx`, the JSX containing the recovery `<dialog>` is gated by early-returns for `isLoading` and `loadError`. On first mount those returns render a loading/error screen — so `signInDialogRef.current` is `null` when the open/close effect first runs. Because `signInModalOpen` doesn't change after that, the effect never re-runs once the real JSX (with the dialog) finally mounts.

The fix adds `isLoading` and `loadError` to the effect's dependency array so it re-runs when the gating state flips and the dialog enters the DOM. The `useState` declarations for `isLoading`/`loadError` were also moved up next to the dialog ref so the effect can reference them.

**Before** (`aquiferx/App.tsx`):

```tsx
useEffect(() => {
  const dialog = signInDialogRef.current;
  if (!dialog) return;
  if (signInModalOpen && !dialog.open) dialog.showModal();
  if (!signInModalOpen && dialog.open) dialog.close();
  return () => {
    if (dialog.open) dialog.close();
  };
}, [signInModalOpen]);
```

**After**:

```tsx
// The dialog is rendered inside a tree that's gated by `isLoading` and
// `loadError` early-returns above. On first mount, those return a
// loading / error screen, so `signInDialogRef.current` is null when
// this effect first runs — `dialog.showModal()` never gets called.
// Including `isLoading` and `loadError` in the deps re-runs the effect
// when the main JSX (which contains the dialog) finally mounts, at
// which point the ref is attached and the recovery modal opens
// correctly. Without these deps, opening a recovery email link
// silently signs the user in with no UI prompt to set a new password.
useEffect(() => {
  const dialog = signInDialogRef.current;
  if (!dialog) return;
  if (signInModalOpen && !dialog.open) dialog.showModal();
  if (!signInModalOpen && dialog.open) dialog.close();
  return () => {
    if (dialog.open) dialog.close();
  };
}, [signInModalOpen, isLoading, loadError]);
```

### Better long-term structural fix (deferred)

The deps-array fix above is correct and tested but treats the symptom. A cleaner structural fix is to render the `<dialog>` **outside** the `isLoading` / `loadError` early-return branches — native `<dialog>` lives in the browser's top layer and does not need to live inside the main JSX tree. With the dialog mounted unconditionally on first commit, the ref attaches at mount time and the effect's deps can return to `[signInModalOpen]`.

The current code is acceptable because the inline comment is load-bearing and warns the next reader. But every additional early-return added above (e.g., `isOffline`, `isMaintenance`, `isAuthCheckPending`) will need to be added to the deps array — or the recovery modal silently regresses again. The structural fix removes the coupling permanently.

## Why This Works

**Fix 1.** Inline `<script>` (without `type="module"`, `defer`, or `async`) executes synchronously during HTML parsing. The browser pauses parsing, runs the script, then continues. `<script type="module">` is implicitly deferred — fetched in parallel and evaluated after the document is parsed. So the inline snapshot writes `window.__GEOGLOWS_INITIAL_URL__` before any bundled module — including Supabase JS's `_initialize()` — has a chance to touch `window.location`. Source-level `import` order in `index.tsx` is not a reliable substitute: Vite/Rollup production bundling can reorder module evaluation relative to side-effectful module-load code, which is exactly how Supabase's hash consumer ended up running first despite the snapshot module being imported first.

**Fix 2.** A React `useEffect` only re-runs when one of its declared dependencies changes (or on unmount). When the JSX containing a ref-controlled element is conditionally mounted by some other state (`isLoading`, `loadError`), that gating state is part of "when the ref becomes attached." If it isn't in the deps, the effect captures a stale `null` ref on first run and never gets another chance — `signInModalOpen` was already `true` by then, so it never transitions and never re-triggers the effect. Adding the gating state to the deps causes the effect to re-fire after the dialog actually mounts, at which point `signInDialogRef.current` is non-null and `dialog.showModal()` runs.

## Prevention

- **For ref-controlled `<dialog>` (or any imperatively opened element) behind conditional mounting**: include every piece of state that gates the JSX containing the ref in the effect's dependency array, not just the open/close state. If `isLoading`/`loadError` early-returns guard the dialog's parent tree, those flags are part of the dialog's lifecycle.
- **For URL-fragment detection that races with library initialization**: capture `window.location` via an inline non-module `<script>` in `index.html` that runs before any module bundle is fetched. Do not rely on ES module import order — Vite/Rollup production bundling does not guarantee that source-level import order maps to module-evaluation order for side effects.
- **Capture but do NOT strip the hash in the snapshot.** Supabase JS reads `window.location.hash` in `_initialize()` to establish the recovery session. Strip the leftover fragment inside the `PASSWORD_RECOVERY` event handler, after Supabase has consumed it.
- **Do not test URL-hash-dependent auth flows on Vercel deployment-protected preview URLs.** The SSO redirect strips the fragment. Use production or non-protected preview deployments.
- **Diagnostic for invisible-modal symptoms**: when state looks correct (event firing, useState seeded, no errors) but UI doesn't update, suspect a ref that hasn't attached yet or an effect dependency gap. A one-line `console.log({ dialogPresent: !!ref.current })` inside the effect makes this visible immediately.
- **Add a Playwright/integration test** that simulates a recovery navigation (URL with `#access_token=...&type=recovery`) and asserts the setNewPassword modal opens. Note: vitest+jsdom 26 needs the `HTMLDialogElement.prototype` polyfill from `apps.geoglows/docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md` for any in-process dialog test.
- **Email security gateway pre-fetch is a separate known limitation** of implicit-flow recovery (Microsoft Defender Safe Links, Mimecast, Proofpoint can consume the one-time token before the user clicks). Mitigation today is the corporate-gateway hint + `mailto:gromero@aquaveo.com` fallback in the `recoveryError` view; PKCE flow would solve it but is deferred. (session history)

## Residual risks

- **Adding another early-return above the dialog re-introduces the bug** unless its gating flag is also added to the dialog effect's deps. The structural fix (render dialog unconditionally) eliminates this risk; the deps fix does not.
- **`window.__GEOGLOWS_INITIAL_URL__` is a runtime contract between `index.html` and the snapshot module** with no type-system signal. If someone removes the inline `<script>`, moves it below the module bundle, or marks it `defer` / `async`, the fallback to live `window.location` silently re-introduces the original race. Consider asserting at module-load that `window.__GEOGLOWS_INITIAL_URL__` is present and warning loudly if not.

## Testing gaps

- **No Playwright/integration test asserts that a recovery URL opens the setNewPassword modal end-to-end.** This would have caught both regressions in this doc.
- **No unit test exercises `readInitialUrl()`'s fallback branch** (inline snapshot missing or malformed). The type-narrowing branch is reachable but unverified.

## Related Issues

- aquiferx#9 (inline-script race fix): https://github.com/Aquaveo/aquiferx/pull/9
- aquiferx#12 (dialog deps fix): https://github.com/Aquaveo/aquiferx/pull/12
- apps.geoglows#30 (inline-script): https://github.com/Aquaveo/apps.geoglows/pull/30
- grace#9 (inline-script): https://github.com/Aquaveo/grace-groundwater-dashboard/pull/9
- rfs#9 (inline-script): https://github.com/Aquaveo/rfs-v2-hydroviewer/pull/9
- Precursor — proxy-path redirect fix (necessary alongside the above, not superseded): aquiferx#7, apps.geoglows#29, grace#8, rfs#8
- Related solution doc — first-visit disclaimer modal pattern (consumes `detectRecoveryUrlState`, decouples from recovery flow): `apps.geoglows/docs/solutions/best-practices/disclaimer-acknowledgment-modal-pattern-2026-04-30.md`
- Related solution doc — vitest dialog polyfill needed for any test of this flow: `apps.geoglows/docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md`
