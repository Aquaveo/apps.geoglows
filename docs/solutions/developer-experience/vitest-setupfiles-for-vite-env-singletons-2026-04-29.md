---
title: Vitest setupFiles for stubbing import.meta.env.VITE_* before module-load-time singletons
date: 2026-04-29
category: developer-experience
module: apps.geoglows
problem_type: developer_experience
component: testing_framework
severity: medium
applies_when:
  - You're adding tests to a Vite project where a module instantiates a singleton at import time using import.meta.env.VITE_*
  - Tests fail at module load with "missing/invalid env var" before any test body runs
  - You want to keep production env-reading patterns intact, not refactor every singleton into a factory
tags:
  - vitest
  - vite
  - env-vars
  - test-setup
  - jsdom
  - module-singletons
---

# Vitest setupFiles for stubbing import.meta.env.VITE_* before module-load-time singletons

## Context

`apps.geoglows` constructs its Supabase client at module load:

```javascript
// src/supabase.js
import { createGeoglowsSupabaseClient } from "@aquaveo/geoglows-auth/core";

export const supabase = createGeoglowsSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
```

This is idiomatic for Vite — a single client lives at module scope, every consumer imports the same instance. Production-correct, but it means the client is built the moment any test imports any module that transitively imports `supabase.js`. If `import.meta.env.VITE_*` is undefined at that moment, client construction throws and the test file fails at the import banner — *before any test body runs and before any `vi.mock(...)` could intervene*.

Refactoring every singleton into a lazy factory just to make it testable is heavy. There's a lighter path: a vitest `setupFile` that defines the env vars before any test module loads.

## Guidance

**Step 1 — minimal `vitest.config.js` with a setup file:**

```javascript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.js"],
  },
});
```

**Step 2 — `tests/setup.js` stubs the env at runtime:**

```javascript
// Stub the Vite env vars `src/supabase.js` reads at module load time.
// Real Supabase calls are mocked in individual tests; the URL/key here
// just need to be syntactically valid so client construction doesn't
// throw during module import.
import.meta.env.VITE_SUPABASE_URL ??= "https://test.supabase.co";
import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test_key";
```

**Step 3 — mock real Supabase calls per-test:**

```javascript
// tests/events.test.js
import { vi } from "vitest";

vi.mock("../src/supabase.js", () => ({
  supabase: { auth: {} },
}));
```

`setupFiles` runs once before any test module's import-time code. The env vars are defined; `src/supabase.js` constructs a client (with a fake URL — the constructor doesn't reach out); per-test `vi.mock` replaces the module entirely so no real network call is ever attempted.

## Why This Matters

Without the setupFile, the symptom is a confusing import-banner error that doesn't point at any test code:

```
ReferenceError: VITE_SUPABASE_URL is not defined
  at <module>:src/supabase.js:8:5
  at <module>:src/auth.js:3:1
  at <module>:tests/events.test.js:1:1
```

Common (wrong) reactions:
- **Add `dotenv` to the test runner.** Vite already does this for `.env.test` and `.env.local`. Adding `dotenv` competes with Vite's loader and can produce inconsistent state.
- **Refactor every singleton to a lazy factory.** Big refactor for a test-only concern. Production code becomes more complex to support test isolation.
- **Use `vi.mock("../src/supabase.js", ...)` and hope.** `vi.mock` is hoisted, but module-load errors can still fire if the *resolution* path imports `supabase.js` before the mock takes effect (which it doesn't reliably for transitive imports across many test files).

The setupFile approach is small, explicit, and doesn't fight the framework. Each consumer (`vi.mock`) decides what behavior to provide; the setupFile just ensures imports don't blow up on the way there.

The `??=` operator (nullish coalescing assignment) is the right primitive — it sets the value only if undefined, so a developer who *does* want to point tests at a real Supabase backend can pre-populate the env and the setup file becomes a no-op.

## When to Apply

- Vite project with module-level singletons that read `import.meta.env.VITE_*` at import time.
- Adding vitest tests for the first time, and import-time module load fails.
- Any `import.meta.env.VITE_*` that's required for module construction (Supabase, Sentry, analytics, anything with a key/URL).

Don't use this when:

- You can defer client construction until first use (a lazy `getSupabaseClient()` factory). That's a cleaner design even outside testing.
- The env-reading code is in a function body, not a module-top-level expression. Then `vi.mock` works directly.

## Examples

`apps.geoglows` shipped this exact pattern in PR #6:

```
vitest.config.js              ← defineConfig with setupFiles
tests/setup.js                ← the env stubs
tests/events.test.js          ← uses vi.mock to replace ../src/supabase.js
tests/ui/profilePage.test.js  ← imports profilePage.js (which imports
                                 account.js → auth.js → supabase.js); the
                                 setup file makes the chain importable
tests/ui/signInModal.test.js  ← uses vi.mock for both auth.js and supabase.js
```

29/29 tests pass under Node 25. Clean teardown — no global state leaks between tests because the env values are constants, and `vi.clearAllMocks()` in beforeEach handles the rest.

## Related

- Vitest docs: `setupFiles` config option.
- Vite docs: `import.meta.env` and the `VITE_` prefix convention.
- `docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md` — sibling test-setup pattern for jsdom prototype gaps.
