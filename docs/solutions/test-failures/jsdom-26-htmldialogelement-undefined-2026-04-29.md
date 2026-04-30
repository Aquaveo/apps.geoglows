---
title: HTMLDialogElement.prototype.showModal/close are undefined in jsdom 26 — patch in test setup
date: 2026-04-29
category: test-failures
module: apps.geoglows
problem_type: test_failure
component: testing_framework
severity: medium
symptoms:
  - "TypeError: dialog.showModal is not a function" when invoking the modal under jsdom
  - "TypeError: dialog.close is not a function" on programmatic close
  - dialog.open returns undefined; the open/closed state machine doesn't work
root_cause: incomplete_setup
resolution_type: test_fix
tags:
  - jsdom
  - vitest
  - dialog
  - htmldialogelement
  - testing
---

# HTMLDialogElement.prototype.showModal/close are undefined in jsdom 26 — patch in test setup

## Problem

Tests for the sign-in modal in `apps.geoglows` use the native `<dialog>` element and call `dialog.showModal()` / `dialog.close()`. Under jsdom 26, those methods are undefined on the `HTMLDialogElement` prototype — calling them throws `TypeError: dialog.showModal is not a function` and the dialog never enters the open state. Tests can't drive the modal's lifecycle.

## Symptoms

- `dialog.showModal()` throws `TypeError: ... is not a function`.
- `dialog.close()` similarly throws.
- `dialog.open` returns `undefined` regardless of state.
- Backdrop click and Escape key behavior never fires (handlers are bound, but the dialog can't open in the first place).

## What Didn't Work

- **Skipping the lifecycle and rendering the modal body inline.** Tests would pass but they'd no longer cover the modal-state-machine behavior (open / close / re-open with cleared state). The modal's own state coupling to `dialog.open` would go untested.
- **Mocking `document.createElement("dialog")` to return a `<div>`.** Defeats the point of testing the modal's actual behavior. The modal closes itself by calling `dialog.close()` which dispatches a `close` event; a mocked `<div>` doesn't model that.
- **Upgrading jsdom past 26.** As of this writing (2026-04), jsdom is still working on `HTMLDialogElement` support. No plain version bump fixes it.

## Solution

Patch the prototype in the test setup file with a minimal attribute-driven stub:

```javascript
// In a per-test or shared setup
function patchDialogPrototype() {
  const proto = window.HTMLDialogElement?.prototype;
  if (!proto) return;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal() {
      this.setAttribute("open", "");
      Object.defineProperty(this, "open", {
        configurable: true,
        get: () => this.hasAttribute("open"),
      });
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function close() {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
}
```

Call it from `beforeEach` (or once in the setup file):

```javascript
beforeEach(() => {
  patchDialogPrototype();
  document.body.innerHTML = "";
  vi.clearAllMocks();
  mountSignInModal();
});
```

## Why This Works

The patch matches the real browser semantics closely enough for behavioral testing:

- `showModal()` adds the `open` attribute; the `open` property reflects it.
- `close()` removes the attribute and dispatches a `close` event — the same event the modal listens for to reset its internal state.
- The stub is `if (typeof ... !== "function")`-guarded, so it's a no-op once jsdom ships native support and the patch can be removed without changing tests.

Real browser semantics not covered by the stub:
- True `<dialog>` modal stacking (top layer, focus trap, outer click prevention). Not relevant for behavior tests; if you need those, integration tests in a real browser are the right tool.
- The `returnValue` argument on `close(returnValue)`. Add it if a test exercises it (none currently do).

## Prevention

- **Audit `HTMLDialogElement` usage when introducing tests for the first time.** A grep for `<dialog>`, `showModal(`, `close(`, or `dialog.open` in the test scope will surface dependencies on jsdom features.
- **Treat jsdom as a partial DOM, not a full one.** `HTMLDialogElement` joins a list of partial implementations: `IntersectionObserver`, `ResizeObserver`, `matchMedia` (limited), `scrollTo`, etc. Patch what you need at the lowest level (prototype) rather than wrapping every call site in a feature check.
- **Re-check on jsdom version bumps.** When upgrading jsdom, run the dialog tests first — once native support lands, the prototype patch becomes redundant and can be deleted (the `if (typeof ... !== "function")` guard means it's safe to keep, but cleaner to drop).

## Related Issues

- jsdom GitHub issues tracking `HTMLDialogElement` support (search the repo for `HTMLDialogElement`).
- **PR `Aquaveo/apps.geoglows#6`** — added the patch to `tests/ui/signInModal.test.js`'s `patchDialogPrototype()` helper.
- **`docs/solutions/developer-experience/vitest-setupfiles-for-vite-env-singletons-2026-04-29.md`** — sibling pattern for vitest setup-time concerns.
