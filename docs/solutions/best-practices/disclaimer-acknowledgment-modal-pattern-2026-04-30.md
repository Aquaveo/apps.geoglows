---
title: First-visit disclaimer acknowledgment modal — pattern, version-bumping, recovery decoupling
date: 2026-04-30
category: best-practices
module: apps.geoglows
problem_type: best_practice
component: authentication
severity: medium
applies_when:
  - You need to show users a one-time terms-of-use / disclaimer / safety notice and persist their acknowledgment
  - The legal precision is not yet defined (no audit trail, no entity attribution) — start with informative-only
  - Multi-tab usage exists and stale "you've seen this" state across tabs would be confusing
  - Recovery URLs (Supabase password reset, OAuth callbacks) coexist with the modal lifecycle
tags:
  - disclaimer
  - terms-of-use
  - dialog
  - localstorage
  - auth
  - modal
---

# First-visit disclaimer acknowledgment modal — pattern, version-bumping, recovery decoupling

## Context

apps.geoglows needed to show first-time visitors a disclaimer ("data is research-quality, don't rely on it for high-stakes decisions") with an explicit acknowledgment before they could use the platform. The work shipped 2026-04-30 (`docs/plans/2026-04-30-006-feat-disclaimer-acceptance-modal-plan.md`) and went through a multi-PR evolution that produced reusable patterns and explicit non-goals worth documenting.

The pattern below covers what to ship for an **informational acknowledgment** (terms-of-use style). It deliberately does NOT cover legally-rigorous consent — audit trails, per-account enforcement, entity attribution, and decline-and-block flows are deferred to a future "legal-hardening" plan.

## Guidance

### Storage shape

Persist the acknowledgment in `localStorage` keyed by a version string:

```javascript
// src/disclaimer.js
export const DISCLAIMER_VERSION = "2026-04-30";
export const STORAGE_KEY = "geoglows-disclaimer-acceptance";

// localStorage value:
// { version: "2026-04-30", status: "accepted", timestamp: 1234567890 }
```

Bumping `DISCLAIMER_VERSION` (e.g., on text changes) forces all existing users to re-acknowledge because the read uses **strict equality** on the version:

```javascript
export function getDisclaimerStatus() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "pending";
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return "pending";
    if (parsed.version !== DISCLAIMER_VERSION) return "pending";
    if (parsed.status !== "accepted") return "pending";
    return "accepted";
  } catch {
    return "pending"; // private mode, malformed JSON, all errors → re-prompt
  }
}
```

Both reads AND writes wrap localStorage in `try/catch` — Safari private mode can throw on `getItem` AND on quota-exceeded `setItem`. Silent swallow on both means the in-memory state machine progresses normally; the user just re-prompts on next visit.

### Modal shape

Native `<dialog>` element — single "I understand" button (informative only — see "Don't add a Reject button by default"):

```javascript
export function mountDisclaimerModal({ onAccept }) {
  const dialog = document.getElementById("geoglows-disclaimer-modal");
  dialog.innerHTML = renderDisclaimerModalContents();
  dialog.querySelector("#geoglows-disclaimer-accept")
    ?.addEventListener("click", () => onAccept());
  // NO cancel-event listener — Escape closes natively without writing
  // localStorage. User re-prompts on next visit (same as never having seen it).
  // NO backdrop-click listener — native <dialog> already ignores backdrop clicks.
  return {
    open() { if (!dialog.open) dialog.showModal(); },
    close() { if (dialog.open) dialog.close(); },
  };
}
```

The DOM uses Tailwind utilities inline (per apps.geoglows's `§ Conventions`). Centering and flex-scroll bugs covered in `docs/solutions/ui-bugs/dialog-tailwind-centering-and-flex-scroll-double-scrollbar-2026-04-30.md`.

### Recovery flow decoupling

Password recovery and OAuth callbacks **MUST NOT** be gated by the disclaimer. The user's recovery OTP is single-use; gating recovery behind disclaimer acceptance creates a UX trap where a user who declines (or even hits Escape on the disclaimer mid-recovery) invalidates their reset link.

The pattern: **defer disclaimer mount when a recovery URL is detected**, then mount/open it after the recovery modal closes:

```javascript
const recoveryUrl = detectRecoveryUrlState({ hash, search });
const hasImplicitRecoveryHash =
  /(?:^|[#&?])access_token=/.test(window.location.hash) &&
  /(?:^|[#&?])type=recovery/.test(window.location.hash);
const isRecoveryFlow = recoveryUrl.kind !== "none" || hasImplicitRecoveryHash;

if (appState.disclaimerStatus === "pending" && !isRecoveryFlow) {
  openDisclaimerNow();
}

// Listen on the lib's sign-in modal closing (recovery modal lives there);
// open the disclaimer afterward if still pending.
document.querySelector(".geoglows-signin-modal")
  ?.addEventListener("close", () => {
    if (getDisclaimerStatus() === "pending") openDisclaimerNow();
  });
```

This matches industry precedent (Auth0, Stripe, GitHub all treat security-recovery actions as orthogonal to terms acceptance).

### Cross-tab sync

Use a `storage` event listener so an acknowledgment in one tab dismisses the modal in others:

```javascript
window.addEventListener("storage", (event) => {
  if (event.key !== DISCLAIMER_STORAGE_KEY) return;
  const next = getDisclaimerStatus();
  if (next === appState.disclaimerStatus) return;
  if (next === "accepted" && disclaimerModal) {
    disclaimerModal.close();
  }
  setState({ disclaimerStatus: next });
});
```

Last-write-wins for conflicting cross-tab decisions. Acceptable for an informative notice; if your context requires strict per-decision recording, use Supabase per-account persistence instead (and most likely use a different pattern entirely — see "Don't try to make it legally rigorous in v1").

### Module-load ordering

The disclaimer state machine extends the existing `appState`:

1. Imports run.
2. `appState` const literal computes `disclaimerStatus: getDisclaimerStatus()` synchronously.
3. `initApp()` detects whether a recovery URL is present.
4. If `disclaimerStatus === 'pending'` AND no recovery URL → lazy-mount and open modal **before** first `renderApp()` (avoids flashing the apps catalog under the modal backdrop).
5. If recovery URL → defer disclaimer mount; lib's sign-in modal opens for recovery; disclaimer opens after that modal closes.
6. If `disclaimerStatus === 'accepted'` → no modal mount at all (saves DOM construction on the 99%+ accepted-state visits).

### Don't add a Reject button by default

The original plan included a Reject button + rejection page + Reconsider button. After ship, the user simplified to acknowledge-only ("I understand"). The reasoning that emerged:

- A Reject button implies a meaningful "no" decision. Without per-account audit trails, "rejected" is just a different localStorage state with no legal force.
- Adding rejection logic doubles the state machine (`accepted` vs `rejected` vs `pending`), the test surface, and the risk of UX traps (especially around recovery URLs — see decoupling section above).
- Escape already provides a "close without choosing" path that's idiomatic for native `<dialog>`.

If/when legal requires a true decline-and-block flow, the right architecture is per-account Supabase storage with sub-app enforcement — a different plan entirely, not an extension of this one.

### Don't try to make it legally rigorous in v1

Out of scope by explicit user direction:

- **No audit trail.** No "user X accepted version Y at time Z" record. localStorage is dev-tools-bypassable; this is informational, not enforcement.
- **No entity attribution in the text.** The disclaimer copy says "we" / "our" without naming a legal entity. Deferred to legal-hardening.
- **No sub-app enforcement.** Bookmarks to grace-groundwater, rfs-v2-hydroviewer, or aquiferx-bay.vercel.app bypass the gate entirely. Acceptable for "best-effort acknowledgment notice."

If you find yourself adding any of the above to v1, you're building a different feature; spin it off as a separate plan with explicit legal review.

## Why This Matters

**Version-bumping over re-prompt-after-N-days**: simpler model. The version constant is the explicit signal that the text changed materially. Date-based re-prompts couple acceptance to time rather than to content, which means trivial typo fixes don't trigger re-acknowledgment but month-old acceptances do (often the inverse of what you want).

**Recovery decoupling**: the alternative — gating recovery behind disclaimer — looks tighter on paper but creates a documented foot-gun. Real-world failure mode: user clicks email link → modal opens → user clicks Reject thinking "I'll deal with this later" → recovery OTP is now consumed (Supabase already exchanged it for a session) → user's reset link is dead, they re-request, same thing happens. Decoupling matches user expectations and industry precedent.

**Cross-tab sync via `storage` event**: without it, a user who accepts in one tab still sees the modal in another tab; opening a second tab feels like the system "forgot." With it, all tabs converge on the latest decision. Cheap to add (~6 lines), large UX gain.

**Try/catch around all localStorage access**: Safari private mode + browser-disabled-storage scenarios are real and rare. Wrapping reads + writes in try/catch prevents a 0.1% case from breaking app boot for everyone; the silent-swallow degradation (re-prompt on next visit) is acceptable.

## When to Apply

- Need a one-time informational acknowledgment, not a legally-rigorous consent gate.
- Single-page app with native `<dialog>` support.
- Existing `localStorage`-based persistence patterns in the codebase.
- Multi-tab usage is plausible.
- Auth/recovery URL handling exists and the modal lifecycle could overlap.

**Don't use this pattern when:**

- Legal counsel requires proof-of-acceptance with a per-user audit trail. Use server-side Supabase storage instead and design the modal as a post-sign-in gate, not a pre-app-load gate.
- The acknowledgment must follow the user across devices. Per-device localStorage doesn't deliver this.
- The disclaimer text changes frequently and you don't want to force re-acknowledgment on every change. Version-bumping is the only re-prompt mechanism in this pattern.
- You need the disclaimer enforced in sub-apps reached via direct URL (cross-origin). Need per-account or per-domain server-backed enforcement.

## Examples

apps.geoglows shipped this pattern in three PRs (the post-ship simplification from accept/reject to acknowledge-only is the recommended starting state):

- `Aquaveo/apps.geoglows#23` — initial accept/reject (predecessor to current state)
- `Aquaveo/apps.geoglows#24` — fix: explicit modal centering
- `Aquaveo/apps.geoglows#25` — fix: eliminate double scrollbar
- `Aquaveo/apps.geoglows#26` — simplify to informative acknowledgment (drop reject)

Final shipped surface:

```
src/disclaimer.js                      ← module: constants, helpers, mount, render
src/main.js                            ← appState extension, lazy-mount, deferred-mount-after-recovery, storage listener
index.html                             ← <dialog id="geoglows-disclaimer-modal">
tests/setup.js                         ← localStorage polyfill (see related solution)
tests/disclaimer.test.js               ← 18 test cases
CLAUDE.md § Disclaimer                 ← bumping the version, recovery decoupling, sub-app gap
```

State machine: `'pending' | 'accepted'` (no `'rejected'`). Single "I understand" button. Escape closes without writing. Recovery flow not gated. Cross-tab sync via `storage` event.

## Related

- **Plan**: `apps.geoglows/docs/plans/2026-04-30-006-feat-disclaimer-acceptance-modal-plan.md` — full design rationale including the post-ship simplification note.
- **`docs/solutions/ui-bugs/dialog-tailwind-centering-and-flex-scroll-double-scrollbar-2026-04-30.md`** — the modal-rendering bugs to avoid when implementing this pattern.
- **`docs/solutions/developer-experience/jsdom-26-localstorage-polyfill-2026-04-30.md`** — testing-time setup needed for the localStorage helpers.
- **`docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md`** — disclaimer template MUST NOT contain `${...}` interpolation of dynamic values; the static-constant pattern preserves this.
- **`docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md`** — `<dialog>` prototype patch needed alongside the localStorage polyfill.
