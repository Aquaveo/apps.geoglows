---
title: jsdom 26 ships localStorage as an empty object with no methods — polyfill in test setup
date: 2026-04-30
category: developer-experience
module: apps.geoglows
problem_type: developer_experience
component: testing_framework
severity: medium
applies_when:
  - You're adding tests that touch localStorage or sessionStorage in a Vite + vitest + jsdom 26 project
  - Test fails with "TypeError: localStorage.getItem is not a function" or "localStorage.clear is not a function"
  - You want to test code that reads/writes Web Storage without mocking every call site
tags:
  - jsdom
  - vitest
  - localstorage
  - sessionstorage
  - storage
  - test-setup
  - polyfill
---

# jsdom 26 ships `localStorage` as an empty object with no methods — polyfill in test setup

## Context

apps.geoglows added a disclaimer modal that persists user acknowledgment in `localStorage`. The first test for the helper module hit:

```
TypeError: localStorage.clear is not a function
```

A diagnostic test confirmed:

```js
typeof localStorage // "object"
Object.keys(localStorage) // []
typeof localStorage.getItem // "undefined"
typeof localStorage.setItem // "undefined"
typeof localStorage.removeItem // "undefined"
typeof localStorage.clear // "undefined"
localStorage.constructor // undefined
```

In this vitest config (vitest 3.2.4 + jsdom 26.1.0), `localStorage` exists on the global as an empty plain object with no Storage methods. Same for `sessionStorage`. Tests that exercise Web Storage cannot run.

The minimal fix is a Map-backed Storage polyfill installed once in `tests/setup.js` so every test inherits a working `localStorage`/`sessionStorage`.

## Guidance

**Polyfill in `tests/setup.js`** — runs once before any test module loads:

```javascript
function createStoragePolyfill() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
}

if (typeof globalThis.localStorage === "undefined" ||
    typeof globalThis.localStorage.getItem !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStoragePolyfill(),
    configurable: true,
    writable: true,
  });
}
if (typeof globalThis.sessionStorage === "undefined" ||
    typeof globalThis.sessionStorage.getItem !== "function") {
  Object.defineProperty(globalThis, "sessionStorage", {
    value: createStoragePolyfill(),
    configurable: true,
    writable: true,
  });
}
```

Key details:

- **Guard with `typeof ... !== "function"`** — if jsdom (or a future version) ships a working Storage, the polyfill is a no-op. The guard makes the polyfill safe to keep across version upgrades.
- **`Object.defineProperty` with `configurable: true, writable: true`** — `globalThis.localStorage` may be defined as a non-writable property by jsdom; plain assignment can throw. `defineProperty` overrides cleanly.
- **`Storage.prototype` mocking still works.** Tests that need to simulate `getItem` throwing (Safari private mode behavior) can use `vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw ... })` — the polyfill exposes the Storage interface, so prototype-level spying still applies.

## Why This Matters

Without the polyfill, the failure mode is a confusing per-test `TypeError` that doesn't point at any test code:

```
FAIL  tests/disclaimer.test.js > getDisclaimerStatus returns 'pending' when localStorage is empty
TypeError: localStorage.getItem is not a function
```

Common (wrong) reactions:

- **Mock `localStorage` per test with `vi.stubGlobal`.** Works but adds boilerplate to every test file. Doesn't help when the source-under-test reads localStorage at module load time (the read happens before the test body runs).
- **Use `localStorage-mock` or similar npm packages.** Adds a dependency for a problem the runtime already partially solves; jsdom is *supposed* to provide Storage. The polyfill is ~20 lines and tracks closer to the spec than third-party mocks.
- **Switch to `happy-dom`.** Possible but disruptive — apps.geoglows is settled on jsdom 26 (the dialog prototype patch is also there). Single-test-environment churn isn't worth the localStorage fix.
- **Refactor the source to inject a Storage instance.** Heavyweight; the disclaimer module is intentionally simple (`localStorage.getItem(KEY)`). Production code shouldn't grow factories just for testability.

The setup-file polyfill is small, explicit, and doesn't fight the framework. Real-browser semantics are preserved at the API level (synchronous getItem/setItem, key indexing, length, clear); only the storage-quota and cross-tab `storage` event are not modeled (they wouldn't fire in jsdom anyway).

## When to Apply

- vitest + jsdom 26 (or the version range where Storage is broken — verify with the diagnostic snippet above).
- Code under test reads `localStorage` or `sessionStorage` directly.
- Module-load-time reads of localStorage (singletons, constants) — this is when per-test mocking is too late.

Don't use this when:

- jsdom is already providing working Storage (a future version may fix this; the polyfill's guard makes it self-deactivate).
- You only need to mock Storage for specific tests — `vi.stubGlobal("localStorage", { ... })` per-test is fine and gives explicit per-test control.
- You're using `happy-dom` or `@vitest/browser` instead of jsdom.

## Examples

apps.geoglows's `tests/setup.js` after this change:

```javascript
// Stub the Vite env vars `src/supabase.js` reads at module load time.
import.meta.env.VITE_SUPABASE_URL ??= "https://test.supabase.co";
import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test_key";

// jsdom 26 ships HTMLDialogElement without showModal/close.
// (See docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md)
if (typeof HTMLDialogElement !== "undefined") { /* prototype patch */ }

// jsdom 26 in this vitest config exposes localStorage / sessionStorage
// as plain empty objects with no Storage methods. Polyfill a minimal
// Map-backed Storage implementation.
function createStoragePolyfill() { /* ... */ }

if (typeof globalThis.localStorage === "undefined" ||
    typeof globalThis.localStorage.getItem !== "function") {
  Object.defineProperty(globalThis, "localStorage", { /* ... */ });
}
```

After the polyfill landed, `tests/disclaimer.test.js` (22 cases at the time, 18 after the post-ship simplification) ran cleanly with `localStorage.setItem`/`getItem` actually working. `vi.spyOn(Storage.prototype, "getItem")` for the throw-in-private-mode test also worked because the polyfill objects expose the methods on a real prototype chain.

## Related

- Vitest docs: `setupFiles` config option.
- `docs/solutions/developer-experience/vitest-setupfiles-for-vite-env-singletons-2026-04-29.md` — sibling pattern for setup-file env-var stubs. Both live in `tests/setup.js`.
- `docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md` — sibling jsdom prototype gap; same setup file is now home to all three jsdom-completeness shims (env vars, dialog, storage).
- jsdom GitHub issues: track Storage support; once a future version ships working Storage, the polyfill self-deactivates via the `typeof ... !== "function"` guard.
