---
title: "feat: First-visit disclaimer acknowledgment modal"
type: feat
status: shipped
date: 2026-04-30
---

# feat: First-visit disclaimer acknowledgment modal

> **Post-ship simplification (2026-04-30):** the `Reject` button and the
> rejection-page flow were removed at user direction. The shipped modal is
> informative-only — single "I understand" button. Decline-and-block flow,
> Reconsider button, and persisted rejection state are all deferred to a
> future plan along with audit-trail / per-account enforcement / entity
> attribution. Sections of this plan that describe the rejection mechanism
> are kept as historical context.

## Overview

Add an informative disclaimer modal (terms-of-use style) that prompts apps.geoglows visitors on first visit. The user clicks "I understand" to acknowledge; the acceptance persists in `localStorage` keyed by a disclaimer version so future text changes can re-prompt. Escape closes the modal without writing to localStorage (user re-prompts on next visit), respecting native `<dialog>` semantics.

The disclaimer text is provided verbatim from the request and is treated as a static string constant in source. **Legal precision (correct entity attribution, exact wording, audit-trail backing, decline-and-block flow) is explicitly out of scope and deferred to a separate plan** — this plan ships the *mechanism*, not the legal artifact.

## Problem Frame

GEOGloWS is a research-area platform. The data and methods are under active development; users should not rely on it for high-stakes decisions. The platform should surface this fact to visitors via an acknowledgment prompt on first visit. This plan adds the prompt mechanism.

Scope is apps.geoglows only (the portal entry point). Sub-apps reached via portal proxy share the apps.geoglows origin, so a disclaimer accept on the portal root is automatically visible to sub-app code via `localStorage` — but sub-apps don't currently read it. Whether sub-apps should also gate on the disclaimer is a separate decision (deferred).

**Out of scope by explicit user direction:**
- Legal-rigor concerns: per-account audit trail, server-side acceptance record, disclaimer-text legal-entity attribution, dev-tools-bypass enforcement. These belong to a future legal-hardening plan.
- The mechanism shipped here is intentionally a "best-effort acknowledgment notice" — informed acknowledgment, not technical enforcement.

## Requirements Trace

### Behavior

- **R1.** On first visit to apps.geoglows (no record in `localStorage`), render a modal containing the disclaimer text with `Accept` and `Reject` buttons.
- **R2.** Clicking `Accept` persists `{ version, status: 'accepted', timestamp }` to `localStorage` and dismisses the modal. The user proceeds to the apps catalog or profile page.
- **R3.** Clicking `Reject` persists `{ version, status: 'rejected', timestamp }` to `localStorage` and renders a full-page "You've declined" state with a `Reconsider` button. App catalog and profile are NOT rendered.
- **R4.** Clicking `Reconsider` re-shows the disclaimer modal. The persisted rejection stays in `localStorage` until the user accepts (or until version bumps).
- **R5.** On every subsequent visit, the disclaimer status is checked:
  - Status `'accepted'` for current version → modal does NOT render; app proceeds normally.
  - Status `'rejected'` for current version → rejection page renders directly (no modal pop); user clicks Reconsider to see modal again.
  - Missing entry OR different version (text changed, version bumped) → modal re-prompts.
- **R6.** Pressing Escape closes the modal without writing to `localStorage`. The user re-prompts on next visit. (Native `<dialog>` semantics; Escape is treated as "close without choosing," which is functionally equivalent to never having seen the modal.)
- **R7.** Recovery URL flows are NOT blocked by the disclaimer. If the user lands on a password-recovery URL, the recovery flow runs to completion (Supabase establishes session, modal opens for `setNewPassword`). The disclaimer modal opens AFTER the recovery flow — on the next normal visit OR after the user successfully sets their new password and the modal closes.

### Visual / interaction

- **R8.** The modal uses the same native `<dialog>` pattern as the existing auth modal.
- **R9.** Backdrop click does NOT close the modal (the lib's auth-modal listener is not copied; native `<dialog>` ignores backdrop clicks by default). Escape DOES close the modal (R6).
- **R10.** The modal is scrollable when the disclaimer text exceeds the viewport. Accept and Reject buttons are pinned in a sticky footer outside the scrollable region.
- **R11.** The `Accept` button is the visual primary action (Tailwind `bg-blue-600 text-white`); `Reject` is secondary (Tailwind `border border-slate-300 bg-white text-slate-700`).
- **R12.** No telemetry on accept/reject. The decision is local-only.

### Storage

- **R13.** `localStorage` key: `geoglows-disclaimer-acceptance`.
- **R14.** Value: JSON `{ version: string, status: 'accepted' | 'rejected', timestamp: number }` where `timestamp` is `Date.now()`.
- **R15.** Disclaimer version is a constant in source (e.g., `DISCLAIMER_VERSION = "2026-04-30"`) updated whenever the text changes.

## Scope Boundaries

- **apps.geoglows only.** Sub-apps (grace, rfs, aquiferx) are not affected. Users with bookmarks to grace/rfs (proxied) or aquiferx (different origin) bypass the disclaimer entirely. This is acceptable for the "best-effort acknowledgment notice" framing — the gate is portal-landing only.
- **No per-user persistence.** Acceptance is per-device + per-browser via `localStorage`. A user signing in on a different machine sees the disclaimer again.
- **No external storage.** Pure client-side. No audit trail of who accepted when. **Explicitly deferred to a separate legal-hardening plan** — if/when legal requires proof-of-acceptance.
- **No legal-text precision.** The text ships verbatim from the request, with "we"/"our" pronouns having no defined antecedent. Adding entity attribution ("These terms are provided by [Entity Name]") is **deferred to a separate legal-hardening plan**.
- **No localized text.** Disclaimer renders in English only.
- **No analytics on disclaimer interaction.** Privacy-friendly default.
- **Recovery flow is NOT gated.** Password recovery and OAuth callbacks complete normally; the disclaimer modal opens after the recovery flow finishes (or on next normal visit). This deliberately decouples authentication-recovery actions from disclaimer acknowledgment.

### Deferred to Separate Tasks

- **Reject / decline flow** — the post-ship simplification removed the Reject button entirely. Re-introducing a decline-and-block flow (rejection page, persisted rejection state, Reconsider button, sub-app gating tied to rejection) is a future plan if needed. Per-user direction at ship time: the modal is informative-only; users either acknowledge or close the tab.
- **Legal-hardening plan** (a single future plan covering several deferred concerns):
  - Confirm legal entity attribution in the disclaimer text ("we" → named entity)
  - Per-account audit trail via Supabase (`core.profiles.disclaimer_version_accepted` + `disclaimer_accepted_at`)
  - Sub-app enforcement (sub-app session bootstraps check the Supabase column)
  - Decision: is the per-device localStorage approach acceptable, or do we need per-account?
- **Sub-app disclaimer enforcement (localStorage-only variant)** — if a stop-gap before the legal-hardening plan, sub-apps could read the same localStorage key (limited to same-origin sub-apps; aquiferx as different origin is unreachable).
- **Disclaimer text localization** — separate plan if multiple languages are needed.

## Context & Research

### Relevant Code and Patterns

- **`apps.geoglows/src/main.js`** — single-page state machine. `appState` initialized at line ~38; `setState({...})` triggers re-render of `#app.innerHTML`. Recovery URL detection runs at module load (line ~135) BEFORE the first render, capturing `window.location.hash` for password-recovery flows.
- **`apps.geoglows/src/main.js`** — `render(state)` (line ~48) branches on `state.currentPage` (`'apps'` or `'profile'`). New disclaimer-rejected state needs a third branch.
- **`apps.geoglows/index.html`** — the entry HTML. Adds a new `<dialog>` mount point for the disclaimer modal alongside the existing `#app` div. (The auth modal is mounted by the lib at runtime, not in HTML.)
- **`apps.geoglows/src/auth-events.js`** — small pure-helper module pattern. `getInitialState`, `isRedundantSignIn`, etc. The disclaimer state-helper module follows the same shape: pure functions for `isDisclaimerAccepted()`, `acceptDisclaimer()`, etc.
- **CSS approach: inline Tailwind utilities** — `apps.geoglows/CLAUDE.md` line 29 explicitly states "Tailwind utility classes inline; no `@apply` or component CSS in app-owned `src/` — UI components imported from `@aquaveo/geoglows-auth` ship their own plain CSS and are exempt." The disclaimer is app-owned, NOT a lib import. Use Tailwind utilities inline in the template strings (matches `appsPage.js`, `profilePage.js`, `footer.js` precedent). Sticky footer with scrollable content is achievable with `flex flex-col max-h-[80vh] overflow-hidden` on the dialog and `overflow-y-auto` on the body region. Do NOT create `src/disclaimer.css`. (Earlier draft proposed a new CSS file — rejected because it violates the convention.)

### Institutional Learnings

- **HTML escape discipline** — apps.geoglows renders via template-string-then-innerHTML; every interpolation needs `escapeHtml`. The disclaimer text is a static string constant (not user-controlled) so escaping is unnecessary at the use-site, but the template that wraps it must not contain other unescaped values. See `docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md`.
- **`<dialog>` modal pattern** — apps.geoglows uses jsdom 26 in tests, which ships `HTMLDialogElement` without `showModal`/`close`. The patch is NOT in `tests/setup.js` today (which only stubs Vite env vars); it lives inline in `tests/ui/signInModal.test.js`. **Action**: as part of Unit 2 work, move the prototype patch from `tests/ui/signInModal.test.js` into `tests/setup.js` so all dialog-using tests inherit it. Documented at `docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md`.
- **`bindWorkspaceEvents` pattern** — `events.js` rebinds DOM listeners on every render via direct `document.getElementById('foo')?.addEventListener(...)` calls. NOT event delegation. The disclaimer Reconsider button binding follows the same pattern: `document.getElementById('disclaimer-reconsider')?.addEventListener('click', ...)` inside `bindWorkspaceEvents()`.
- **Test-friendly extraction pattern** — `auth-events.js` exports pure helpers (`getInitialState`, `isRedundantSignIn`) so logic can be unit-tested without booting `main.js`. The disclaimer module follows the same pattern: pure helpers in one file, wire-up in `main.js` covered only by manual smoke (per the existing convention).
- **Recovery URL ordering — Supabase consumes the hash BEFORE the disclaimer renders** (correction from earlier draft): The Supabase JS client is constructed at `supabase.js` module load. Its `_initialize()` calls `detectSessionInUrl` which reads `window.location.hash`, exchanges the `access_token` for a session (writing to `localStorage` as `sb-*-auth-token`), and calls `history.replaceState` to clean the URL. This happens BEFORE any UI renders. The earlier-draft assumption that "the disclaimer is a UI gate that runs strictly after URL detection" was correct for `detectRecoveryUrlState` (a pure URL parser) but wrong for Supabase JS itself. By the time the disclaimer modal opens, the user is already authenticated. The disclaimer can gate the `signInModal.open(...)` UI calls but not the session itself. **Implication for "Reject" handler**: see the recovery-flow handling decision in Key Technical Decisions below.

### External References

- [MDN — `<dialog>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) — `showModal()`, `close()`, `cancel` event (Escape key).

## Key Technical Decisions

- **`localStorage`, not cookie.** No server visibility needed; cookies add complexity for no benefit. localStorage is user-writable / dev-tools-bypassable; this is acceptable because the mechanism is a "best-effort acknowledgment notice," not a technical enforcement boundary. Audit-trail backing is deferred to the legal-hardening plan.
- **Persist BOTH accept AND reject** in localStorage as `{ version, status: 'accepted' | 'rejected', timestamp }`. A persisted rejection means refreshing or revisiting takes the user directly to the rejection page (no modal pop) until they explicitly click Reconsider. The system respects the user's stated intent.
- **Version-bumping for re-prompt.** Strict string equality on the version. A stored version different from the current `DISCLAIMER_VERSION` (older, newer, or malformed entry) is treated as "no decision recorded for current version" → modal re-prompts. Both accepted and rejected statuses are version-scoped.
- **Native `<dialog>` (NOT a CSS modal).** Built-in modal semantics, focus trapping, stacking-context isolation.
- **Allow Escape; do not add backdrop-click listener.** Escape closes the modal without writing to `localStorage` — equivalent to never having seen the modal; user re-prompts on next visit. Matches native `<dialog>` semantics, accessibility-friendly. Backdrop click is naturally blocked because we do NOT add the listener (the lib's auth modal adds one — we must NOT copy it).
- **Recovery flow is NOT gated.** Password recovery and OAuth callbacks proceed normally. The disclaimer modal opens AFTER the recovery flow concludes (when the user closes the recovery modal) OR on the next normal visit. Rationale: password recovery is a security/account action distinct from "use of the platform"; gating it creates a UX trap (rejecting invalidates the user's one-time OTP). This decoupling matches industry precedent (Auth0, Stripe, GitHub all treat security-recovery actions as orthogonal to terms acceptance).
- **Disclaimer text is a single string constant in source.** ~250 words; embedded inline. Future localization can revisit.
- **Version constant lives at the top of `src/disclaimer.js`** with a comment instructing engineers to bump it when the text changes.
- **Disclaimer template MUST NOT contain interpolated values.** Code-review comment at the top of the rendering function: "All values rendered into this template are static constants — no `${...}` interpolation of user-controlled or dynamic values without `escapeHtml`."
- **No telemetry / analytics.** Privacy-friendly default.
- **Disclaimer state machine extends `appState`.** `disclaimerStatus: 'pending' | 'accepted' | 'rejected'`. Initial state is computed at module load by reading `localStorage`. `'pending'` triggers the modal; `'accepted'` proceeds normally; `'rejected'` renders the rejection page directly (no modal pop unless Reconsider clicked).
- **State machine: modal opens OVER the rejection page on Reconsider** — clicking Reconsider re-opens the modal as an overlay; `disclaimerStatus` stays `'rejected'` until the user accepts. Reject from the modal-on-rejection-page state is a no-op visually (state already rejected; modal just closes).
- **Initial focus target: the scrollable disclaimer body region** (`tabindex="0"`), NOT the Accept button. Tab order: scroll body → Reject → Accept. Native `<dialog>.showModal()` handles focus trapping.
- **Cross-tab `storage` event listener.** When another tab writes the disclaimer entry, this tab syncs `disclaimerStatus` to match. Closes the open modal if the other tab accepted; renders the rejection page if the other tab rejected. Acknowledged limitation: last-write-wins if user makes conflicting decisions in two tabs simultaneously.
- **Module-load ordering** (simplified — no recovery gating):
  1. Module imports run (synchronous).
  2. Inside `appState` const literal: include `disclaimerStatus: getDisclaimerStatus()` where the helper returns `'accepted'` / `'rejected'` / `'pending'` based on the localStorage entry's status field for the current version.
  3. `initApp()` runs. If `disclaimerStatus === 'pending'` AND no recovery URL is detected at module load, lazy-mount the disclaimer modal and `.open()` BEFORE first render.
  4. If a recovery URL IS detected (hash carries recovery markers), DEFER the disclaimer modal mount. The recovery flow runs unchanged as today. After the user closes the recovery modal (the lib already fires `dialog.close` events), check `disclaimerStatus`; if still `'pending'`, mount and open the disclaimer modal then.
  5. `mountSignInModal()` and `detectRecoveryUrlState()` run unconditionally as today — NO gating, NO `pendingRecoveryView` queue.
  6. `renderApp()` renders apps catalog (`accepted`), rejection page (`rejected`), or empty `#app` (during `pending` while modal is open).
  7. `supabase.auth.onAuthStateChange('PASSWORD_RECOVERY', ...)` handler runs as today — opens the recovery `setNewPassword` modal directly with no disclaimer check.

## Open Questions

### Resolved During Planning

- **Where does the disclaimer text live?** → Hardcoded string constant in `src/disclaimer.js`. Bump `DISCLAIMER_VERSION` when text changes.
- **Persist Reject?** → Yes. localStorage stores `{ version, status, timestamp }` with status `'accepted' | 'rejected'`. Persisted rejection takes the user directly to the rejection page on next visit; Reconsider re-opens the modal.
- **Allow Escape?** → Yes. Escape closes the modal without writing to localStorage; user re-prompts on next visit (equivalent to never having seen it).
- **Gate recovery flow behind disclaimer?** → No. Recovery flow proceeds normally; disclaimer opens after recovery concludes or on next visit.
- **Legal-rigor concerns (per-account audit, entity attribution, sub-app enforcement)?** → Deferred to a separate legal-hardening plan.
- **Storage location?** → `localStorage` keyed by version. No server roundtrip.
- **Reject behavior?** → Full-page "You've declined" state with `Reconsider` button. Persisted in localStorage so refresh takes the user there directly.
- **Escape dismissal?** → Allowed (re-prompts on next visit). Backdrop click is naturally blocked (no listener added).
- **Per-user vs per-device persistence?** → Per-device (`localStorage`). Per-account in the legal-hardening plan.
- **Sub-app disclaimer enforcement?** → Out of scope. Same-origin sub-apps could read localStorage; aquiferx (different origin) cannot. Both deferred to legal-hardening plan.

### Deferred to Implementation

- **Exact pixel-level treatment of the modal and rejection page** — Tailwind classes inline; the suggested DOM in Unit 1 is directional, implementer adapts during pre-merge visual review.
- **Whether the `Reconsider` button should be the primary visual action on the rejection page** — implementation review.

## Implementation Units

- [ ] **Unit 1: `src/disclaimer.js` — pure helpers + `mountDisclaimerModal` + `renderDisclaimerRejectedPage`**

**Goal:** A single module exporting both the localStorage helpers and the modal mount function and the rejection page renderer. Matches the small-module sizing of `auth-events.js` (~100 lines covering several exports). Pure helpers are testable in isolation; modal/render functions are tested with the jsdom dialog patch.

**Requirements:** R1, R2, R3, R4, R5, R7, R8, R9, R10, R11, R12, R13.

**Dependencies:** None.

**Files:**
- Create: `src/disclaimer.js` — exports `DISCLAIMER_VERSION`, `DISCLAIMER_TEXT`, `getDisclaimerStatus()`, `recordDisclaimerDecision(status)`, `mountDisclaimerModal({ onAccept, onReject })`, `renderDisclaimerRejectedPage()`.
- Modify: `index.html` — add `<dialog id="geoglows-disclaimer-modal">` mount point alongside `<div id="app">`. Use the `geoglows-` prefix for namespace consistency with the lib's `geoglows-signin-*` selectors.
- Modify: `tests/setup.js` — move the `HTMLDialogElement.prototype` patch from `tests/ui/signInModal.test.js` here so all dialog-using tests inherit it. Remove the inline patch from `tests/ui/signInModal.test.js` once it's confirmed setup-applied.
- Create: `tests/disclaimer.test.js` — vitest + jsdom (helpers in isolation + modal/render assertions).

**Approach:**
- **Constants at the top of the file** with a comment block:
  ```
  // DISCLAIMER_VERSION — string identifier for the current disclaimer text.
  // BUMP this constant whenever DISCLAIMER_TEXT changes (any wording change,
  // even a typo fix). Bumping forces all existing users to re-acknowledge.
  // Comparison is strict equality on the version string — not greater-than/less-than.
  export const DISCLAIMER_VERSION = "2026-04-30";

  // Static disclaimer text — single string constant. The rendered template
  // MUST NOT contain any `${...}` interpolation of dynamic values. If you
  // ever need to render a dynamic value alongside the disclaimer (user name,
  // dynamic date, etc.), wrap it in `escapeHtml(...)` per the existing
  // discipline at docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md.
  export const DISCLAIMER_TEXT = `...`;
  ```
- **`getDisclaimerStatus(): 'accepted' | 'rejected' | 'pending'`** — reads the localStorage entry. Returns `'accepted'` or `'rejected'` only when the entry exists with the matching version AND a recognized status field. Returns `'pending'` for missing entries, version mismatch, malformed JSON, unknown status values, OR if `localStorage.getItem` throws (private mode). Entire body wrapped in try/catch.
- **`recordDisclaimerDecision(status: 'accepted' | 'rejected'): void`** — writes `{ version: DISCLAIMER_VERSION, status, timestamp: Date.now() }` as JSON to `localStorage.setItem` inside try/catch (silent swallow on quota errors).
- **`mountDisclaimerModal({ onAccept, onReject })`** follows the auth modal pattern:
  ```
  function mountDisclaimerModal({ onAccept, onReject }) {
    const dialog = document.getElementById("geoglows-disclaimer-modal");
    dialog.innerHTML = renderDisclaimer();  // Tailwind utility classes inline
    dialog.querySelector("#geoglows-disclaimer-accept").addEventListener("click", onAccept);
    dialog.querySelector("#geoglows-disclaimer-reject").addEventListener("click", onReject);
    // NO cancel-event listener — Escape closes the modal natively. The lib does NOT
    // call any localStorage write on Escape; the consumer's onAccept/onReject are the
    // only paths that produce a persisted decision.
    // NO backdrop-click listener — native <dialog> doesn't close on backdrop click without one.
    return {
      open() { dialog.showModal(); /* native focus trap; first focusable element receives focus */ },
      close() { dialog.close(); },
    };
  }
  ```
  *(Directional guidance — implementer adapts as needed.)*
- **DOM structure for the modal** (Tailwind classes inline, NOT a new CSS file — per CLAUDE.md convention). Suggested shape:
  ```html
  <dialog id="geoglows-disclaimer-modal" class="rounded-2xl p-0 max-w-2xl w-[calc(100vw-2rem)] backdrop:bg-slate-900/60">
    <div class="flex flex-col max-h-[80vh]">
      <header class="px-6 pt-6 pb-3 border-b border-slate-200">
        <h2 class="text-2xl font-bold text-slate-800">Disclaimers</h2>
      </header>
      <div tabindex="0" class="overflow-y-auto px-6 py-4 text-sm text-slate-700 leading-relaxed space-y-3">
        <!-- Disclaimer text paragraphs -->
      </div>
      <footer class="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-white">
        <button id="geoglows-disclaimer-reject" type="button" class="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 min-h-[44px]">Reject</button>
        <button id="geoglows-disclaimer-accept" type="button" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[44px]">Accept</button>
      </footer>
    </div>
  </dialog>
  ```
  Header is OUTSIDE the scroll container so the heading is always visible. Buttons are pinned in the footer (visible without scrolling). Touch targets meet 44px minimum.
- **Initial focus**: `dialog.showModal()` puts focus on the first focusable element. The scroll body has `tabindex="0"` so it's focusable; tab order becomes scroll body → Reject → Accept. Keyboard users land on the disclaimer text first, NOT the Accept button.
- **`renderDisclaimerRejectedPage()`** returns an HTML string with Tailwind utility classes (centered card with the body copy and a Reconsider button). Body copy: "You've chosen not to accept the disclaimer. You can review and reconsider it at any time. Until then, the GEOGloWS app library is unavailable." Button id: `geoglows-disclaimer-reconsider`.

**Execution note:** Test-first for the pure helpers. Manual smoke for the visual treatment + actual Escape-block behavior in real browsers (jsdom's dialog patch doesn't model Escape→cancel).

**Patterns to follow:**
- `apps.geoglows/src/auth-events.js` — small module with multiple exports.
- `apps.geoglows/src/ui/appsPage.js` / `profilePage.js` / `footer.js` — Tailwind classes inline in template strings.
- `@aquaveo/geoglows-auth/core/sign-in.ts` `mountSignInModal` shape (mount-once, `open`/`close` handle).

**Test scenarios:**
- *Happy path:* `localStorage` empty → `getDisclaimerStatus()` returns `'pending'`.
- *Happy path:* call `recordDisclaimerDecision('accepted')`; assert `localStorage.getItem("geoglows-disclaimer-acceptance")` parses to `{ version: DISCLAIMER_VERSION, status: 'accepted', timestamp: <number> }`.
- *Happy path:* after `recordDisclaimerDecision('accepted')`, `getDisclaimerStatus()` returns `'accepted'`.
- *Happy path (rejection persisted):* call `recordDisclaimerDecision('rejected')`; `getDisclaimerStatus()` returns `'rejected'`. Refresh-equivalent (re-call) confirms persistence.
- *Edge case (older version):* `localStorage` contains `{ version: "1999-01-01", status: "accepted", timestamp: 0 }`; `getDisclaimerStatus()` returns `'pending'`.
- *Edge case (newer version — strict equality):* `localStorage` contains `{ version: "2099-01-01", status: "accepted", timestamp: 0 }`; `getDisclaimerStatus()` returns `'pending'` (NOT a greater-than comparison).
- *Edge case (malformed JSON):* `localStorage` contains `"not-json"`; `getDisclaimerStatus()` returns `'pending'` (does NOT throw).
- *Edge case (unknown status field):* `localStorage` contains `{ version: <current>, status: "weird", timestamp: 0 }`; `getDisclaimerStatus()` returns `'pending'` (only recognized status values are honored).
- *Edge case (`getItem` throws):* mock `localStorage.getItem` to throw `SecurityError` (Safari private-mode); `getDisclaimerStatus()` returns `'pending'` (does NOT throw).
- *Edge case (`setItem` throws):* mock `localStorage.setItem` to throw quota error; `recordDisclaimerDecision('accepted')` does NOT throw (silent swallow).
- *Modal mount:* call `mountDisclaimerModal({ onAccept, onReject })`; click Accept button → `onAccept` fires; click Reject → `onReject` fires.
- *Modal mount (Escape allowed):* dispatch `new Event("cancel", { cancelable: true })` on the dialog; assert default action was NOT prevented (event.defaultPrevented === false) — Escape is allowed to close natively. Neither `onAccept` nor `onReject` fires.
- *Modal DOM:* rendered HTML contains the heading "Disclaimers" AND the first sentence of body text. The accept button has `id="geoglows-disclaimer-accept"`; reject button has `id="geoglows-disclaimer-reject"`. The header is OUTSIDE the scroll container (as a sibling, not child).
- *Rejection page:* `renderDisclaimerRejectedPage()` returns a string containing "You've declined the disclaimer" (or equivalent heading) AND a button with `id="geoglows-disclaimer-reconsider"` and accessible name "Reconsider".

**Verification:**
- ~13 test cases pass; the dialog patch in `tests/setup.js` covers `showModal`/`close`.

---

- [ ] **Unit 2: Wire disclaimer into `main.js`**

**Goal:** Integrate the disclaimer with the existing `appState` state machine. Recovery flow is NOT gated — it proceeds normally. Cross-tab sync via `storage` event listener.

**Requirements:** R1, R2, R3, R4, R5, R6, R7.

**Dependencies:** Unit 1.

**Files:**
- Modify: `src/main.js`:
  - Extend `appState` const literal to include `disclaimerStatus: getDisclaimerStatus()` (returns `'pending'` / `'accepted'` / `'rejected'`).
  - In `initApp()`, BEFORE the first `renderApp()` call: if `disclaimerStatus === 'pending'` AND no recovery URL is detected at module load, lazy-mount the disclaimer modal and call `.open()`. If the URL is a recovery URL, defer mount; mount + open later (after the recovery modal closes).
  - If `disclaimerStatus === 'rejected'`, do NOT mount the modal — render the rejection page directly.
  - Add Accept handler: `recordDisclaimerDecision('accepted')`, `setState({ disclaimerStatus: 'accepted' })`, close modal.
  - Add Reject handler: `recordDisclaimerDecision('rejected')`, `setState({ disclaimerStatus: 'rejected' })`, close modal.
  - Update `render(state)`: when `disclaimerStatus === 'rejected'`, render `renderDisclaimerRejectedPage()`. When `'pending'` and modal is open, render an empty `#app` (no flash of catalog under the modal). When `'accepted'`, render apps catalog/profile as today.
  - Add a `storage` event listener: when another tab writes the disclaimer entry, sync this tab's `disclaimerStatus` to match the new value's status field.
  - Add a deferred-mount path: after the recovery `setNewPassword` or `recoveryError` modal closes (the lib's `dialog.close` event), if `disclaimerStatus === 'pending'`, mount and open the disclaimer modal then.
  - Recovery-URL handlers run UNCHANGED — no `pendingRecoveryView` queue, no Reject signOut. The disclaimer is NOT gating these flows.
- Modify: `src/events.js` — extend `bindWorkspaceEvents` to bind `document.getElementById('geoglows-disclaimer-reconsider')?.addEventListener('click', () => modal.open())`. The Reconsider button is on the rejection page; events.js already rebinds on every render via the existing pattern.

**Approach:**
- **Module-load ordering** (precise):
  1. Module imports run.
  2. `appState` const literal computes `disclaimerStatus` from `getDisclaimerStatus()` (never throws).
  3. `initApp()`: detect whether the URL hash carries recovery markers (`access_token=`, `type=recovery`, `error_code=`, or PKCE-unsupported `code=` + `type=recovery`).
     - If recovery markers present → defer disclaimer mount; let recovery flow run.
     - Else if `disclaimerStatus === 'pending'` → lazy-mount disclaimer modal and `.open()`.
     - Else (`accepted` or `rejected`) → no modal mount. `'rejected'` triggers rejection-page render.
  4. `mountSignInModal(...)` runs unconditionally as today.
  5. `renderApp()` runs (empty `#app` during `pending` with modal open).
  6. `detectRecoveryUrlState(...)` and `supabase.auth.onAuthStateChange('PASSWORD_RECOVERY', ...)` run UNCHANGED — recovery flow proceeds without disclaimer gating.
  7. After recovery modal closes (sign-in modal `dialog.close` event): if `disclaimerStatus === 'pending'`, mount and open the disclaimer modal then.
- **Cross-tab `storage` event listener**: when another tab writes the disclaimer entry, sync this tab's `disclaimerStatus` to the new value's status field. If status went `'pending'` → `'accepted'`, close the modal if open. If `'rejected'`, render the rejection page. Last-write-wins for conflicting cross-tab decisions.
- **`#app` blanking during pending with open modal**: during the `pending` window (modal showing, user has not yet decided), `render(state)` returns an empty string so the apps catalog doesn't flash behind the modal on first paint.

**Patterns to follow:**
- `apps.geoglows/src/main.js` existing `appState` + `setState` + `render(state)` pattern.
- `apps.geoglows/src/events.js` rebinding pattern (direct `getElementById`, NOT delegation).

**Test scenarios** (logic in `disclaimer.js` is unit-testable; `main.js` wire-up follows the codebase convention of manual smoke):
- *Happy path:* `localStorage` has accepted entry → modal does NOT mount → apps page renders normally.
- *Happy path (Accept flow):* `disclaimerStatus === 'pending'` → modal opens → click Accept → localStorage stores `status: 'accepted'` → modal closes → apps page renders.
- *Rejection flow (persisted):* `disclaimerStatus === 'pending'` → click Reject → localStorage stores `status: 'rejected'` → rejection page renders. Refresh-equivalent: re-init → `disclaimerStatus === 'rejected'` → rejection page renders directly (no modal pop). Click Reconsider → modal re-opens. Click Accept → status becomes `'accepted'` → apps page renders.
- *Escape closes without writing:* modal open → press Escape (or dispatch native cancel event) → modal closes → localStorage entry is unchanged → next module load returns to `'pending'` and re-prompts.
- *Cross-tab storage event (accept):* tab B has `'pending'` modal open → fire `new StorageEvent('storage', { key: 'geoglows-disclaimer-acceptance', newValue: '{"version":"2026-04-30","status":"accepted","timestamp":1}' })` → tab B's `disclaimerStatus` becomes `'accepted'`, modal closes.
- *Cross-tab storage event (reject):* tab B is on apps catalog (status was `'accepted'` cross-tab) → fire StorageEvent with `status: 'rejected'` → tab B renders rejection page.
- *Recovery URL — disclaimer NOT gated:* simulate `window.location.hash = "#access_token=...&type=recovery"` AND `disclaimerStatus === 'pending'` → assert disclaimer modal is NOT mounted; recovery flow runs as today; `signInModal.open({ view: 'setNewPassword' })` is called normally. After the recovery modal closes, the disclaimer modal opens.
- *Recovery URL + already accepted:* same hash AND `disclaimerStatus === 'accepted'` → recovery flow runs; disclaimer modal stays unmounted.
- *Backward compat:* hash routing `#profile` still works after accepting the disclaimer.

**Verification:**
- Test scenarios for pure logic in `disclaimer.test.js` (Unit 1).
- Manual smoke (REQUIRED — `main.js` wire-up is not unit-testable per codebase convention):
  - Fresh browser: modal opens, Accept dismisses, apps catalog renders.
  - Fresh browser: modal opens, Reject shows rejection page; refresh page → rejection page renders directly without modal pop; Reconsider re-opens modal.
  - Fresh browser: modal opens, press Escape → modal closes; refresh → modal re-prompts (no localStorage write happened).
  - Two tabs: Accept in tab A → tab B's modal closes (storage event sync).
  - Two tabs: Accept in tab A → on tab B (apps catalog visible) Reject → tab B renders rejection page; tab A's catalog stays (cross-tab last-write-wins; tab A's storage event flips its state to `'rejected'` rejection page on next render).
  - Recovery URL → recovery `setNewPassword` modal opens normally (NO disclaimer modal first). User sets new password, modal closes → disclaimer modal then opens.
  - Bumped `DISCLAIMER_VERSION` after a previous accept → modal re-prompts on next visit.

## System-Wide Impact
## System-Wide Impact

- **Interaction graph:** New module-load gate before any UI renders. Existing `setState`-driven render gains a third branch for the rejection page. Recovery-URL handling is gated behind acceptance via a `pendingRecoveryView` queue. Cross-tab sync via `storage` event listener.
- **Error propagation:** If `localStorage` is unavailable (private mode, quota exceeded, browser disables it), both `isDisclaimerAccepted()` and `acceptDisclaimer()` return/swallow gracefully. `getItem` throwing in private mode is handled by try/catch wrapping the whole function body.
- **State lifecycle risks:** Supabase JS consumes the recovery URL hash and writes a session to localStorage BEFORE the disclaimer renders. If the user rejects, the Reject handler MUST call `auth.signOutRedirect()` to clear that session — otherwise the recovery session lingers in localStorage and is visible cross-tab. Documented in Unit 2 Approach.
- **API surface parity:** No public API changes. `apps.geoglows` adds a private state field.
- **Integration coverage:** Manual smoke covers the modal/rejection-page wire-up + the deferred-mount-after-recovery path.
- **Cross-tab race acknowledged:** if user accepts in tab A and rejects in tab B (or vice versa), last-write-wins via the storage event. Documented limitation acceptable for "best-effort acknowledgment notice."
- **Unchanged invariants:**
  - apps.geoglows hash routing (`#profile`, `#workspace`) — unchanged.
  - Auth flow (sign-in, sign-up, forgot-password, sign-out, password-recovery) — completely unchanged. Recovery is NOT gated by the disclaimer.
  - Sub-app proxy rewrites in `vercel.json` — unchanged.
  - `geoglows-auth` lib — completely untouched.
  - sub-apps (grace, rfs, aquiferx) — completely untouched. **Implication: bookmarks to sub-apps bypass the disclaimer; this is acceptable for the "best-effort acknowledgment notice" scope. Audit-trail / per-account enforcement is in the legal-hardening plan.**

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `localStorage` unavailable / `getItem` throws in private mode → user re-prompts every visit | `try/catch` wraps the entire body of both `getDisclaimerStatus()` (returns `'pending'` on any error) and `recordDisclaimerDecision()` (silent swallow on quota errors). |
| Disclaimer text changes silently without version bump → users don't re-acknowledge stale text | Version constant at the top of `src/disclaimer.js` with a "bump when text changes" comment. Code review catches the mismatch. |
| User clicks Reject by accident, can't easily get back | Reconsider button is prominent on the rejection page. Persisted rejection means refresh keeps the rejection page (no modal pop), Reconsider button re-opens modal. |
| Cross-tab race: user makes conflicting decisions in two tabs | `storage` event listener syncs both directions (accept and reject). Last-write-wins. Acknowledged limitation; per-account enforcement (legal-hardening plan) eliminates this. |
| Native `<dialog>` Escape closes modal without recording a decision | By design — Escape is "close without choosing," equivalent to never having seen the modal. User re-prompts on next visit. Matches native semantics, accessibility-friendly. |
| Tests for `<dialog>` showModal/close fail in jsdom 26 | The prototype patch is moved into `tests/setup.js` as part of Unit 1 work, so all dialog-using tests inherit it. |
| Disclaimer modal opens during a recovery flow | Recovery is NOT gated. The disclaimer mount is deferred when a recovery URL is detected; it opens after the recovery modal closes. Two modals never co-exist. |
| Sub-app bypass (grace, rfs, aquiferx via direct URL) defeats the gate | Acknowledged scope limitation: this is "best-effort notice on portal landing." Per-account enforcement (sub-apps included) belongs to the legal-hardening plan. |
| Disclaimer text "we" / "our" has no defined legal subject | Deferred to legal-hardening plan per user direction; the text ships verbatim. |
| `localStorage` tampering bypasses the gate | Acknowledged: this is informed acknowledgment, not technical enforcement. Audit-trail backing is in the legal-hardening plan. |
| Disclaimer template gets a future dynamic interpolation that bypasses `escapeHtml` | Code-review-checklist comment at the top of the rendering function. Future engineer modifying the template must read it. |

## Documentation / Operational Notes

- **`apps.geoglows/CLAUDE.md`** — add a `## Disclaimer` section documenting:
  - Where the text lives (`src/disclaimer.js`)
  - How to bump the version (update `DISCLAIMER_VERSION`; users will re-acknowledge)
  - That sub-apps do NOT enforce the disclaimer today
  - That recovery flow is NOT gated by the disclaimer (intentional decoupling)
  - That legal-hardening (audit trail, entity attribution, per-account enforcement) is a separate future plan
- **No CHANGELOG** — apps.geoglows doesn't maintain a CHANGELOG; the commit message + PR description are the change history.
- **No npm publish** — apps.geoglows is a Vercel-deployed app, not a published lib.
- **Operational runbook:** straight Vercel deploy after merge. No env vars, no Supabase config. Pre-flight smoke (REQUIRED — manual since `main.js` wire-up is not unit-testable per codebase convention): visit a Vercel preview URL in a fresh browser session. Verify:
  1. Accept → apps catalog renders.
  2. Reject → rejection page renders. Refresh → rejection page renders directly (no modal pop). Reconsider → modal re-opens. Accept → apps catalog renders.
  3. Escape on the modal → modal closes; refresh → modal re-prompts (no localStorage write happened).
  4. Two tabs: Accept in tab A → tab B's modal closes (storage event sync).
  5. Recovery URL (use a real or simulated `#access_token=...&type=recovery`) → recovery modal opens FIRST (no disclaimer modal). Set new password → recovery modal closes → disclaimer modal opens.
  6. Bumped `DISCLAIMER_VERSION` after a previous accept → modal re-prompts on next visit.
- **`docs/solutions/`** — capture one learning post-implementation: "Best-effort acknowledgment notice with `<dialog>` + `localStorage` + persisted accept/reject + decoupled recovery flow."

## Sources & References

- Related code: `apps.geoglows/src/main.js`, `src/auth-events.js`, `index.html`, `tests/setup.js`.
- Related plan: `2026-04-30-002-feat-forgot-password-flow-plan.md` (recovery-URL detection pattern).
- External docs: [MDN — `<dialog>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog).
