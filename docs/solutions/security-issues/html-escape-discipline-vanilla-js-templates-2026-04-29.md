---
title: HTML escape discipline in vanilla-JS template-string view layers
date: 2026-04-29
category: security-issues
module: apps.geoglows
problem_type: security_issue
component: rails_view
severity: high
symptoms:
  - User-controlled text rendered into innerHTML via template string interpolation produces XSS
  - first_name = '<img src=x onerror=alert(1)>' fired alert via display_name composition flowing into the navbar
  - No CSP, no React, no template engine — every interpolation is a potential injection point
root_cause: missing_validation
resolution_type: code_fix
tags:
  - xss
  - html-escape
  - innerhtml
  - template-strings
  - vanilla-js
  - security
---

# HTML escape discipline in vanilla-JS template-string view layers

## Problem

`apps.geoglows` is a vanilla-JS portal that renders its UI by interpolating values into template strings and assigning the result to `innerHTML`. There is no React, no template engine, no CSP — every `${value}` inside a template literal is a raw HTML injection point unless explicitly escaped. Two regressions slipped past 0.3.0:

- **`src/ui/navbar.js`** interpolated `display_name`, `email`, and `initials` directly into innerHTML.
- **`src/ui/profilePage.js`** had a local `escape()` helper but several interpolations bypassed it.

A user who saved `first_name = '<img src=x onerror=alert(1)>'` could trigger script execution via `display_name` (composed from first/last names by `updateProfile`) flowing into the navbar.

Caught by `/ce-review` as **SEC-001** (severity high, confidence 0.85).

## Symptoms

- Rendered DOM contains `<img>` / `<script>` / arbitrary tags injected via user input.
- Stored XSS path through `profiles.first_name` → `updateProfile` composes `display_name` → `loadAccountSummary` returns it → `renderAuthAction` template-strings it into innerHTML.
- Inspecting the page source shows the injected tags as real DOM nodes, not escaped text.

## What Didn't Work

- **Per-file inline `escape()` helpers.** `profilePage.js` defined its own `escape()`, which was correct in the abstract but easy to forget at every interpolation. A template literal with eight `${value}` expressions has eight chances to miss one. New files written without the helper (like `navbar.js`) had no escape at all.
- **Trusting "internal" data.** The mental model of "this comes from our own DB so it's safe" is wrong when *any* of those columns are populated by user input (the profile-edit form), even indirectly through composition (`display_name` derived from `first_name + last_name`).
- **Relying on the database column type.** PostgreSQL `text` columns store XSS payloads as literal strings without complaint. There is no input validation that prevents `<img>` from being saved; the frontend has to escape on read.

## Solution

**Step 1 — extract a single shared `escape()` helper:**

```javascript
// src/ui/escape.js
export function escape(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

**Step 2 — every UI module imports the same helper:**

```javascript
// src/ui/navbar.js
import { escape } from "./escape.js";

// Before:
return `<p class="...">${name}</p>`;        // ← XSS via name
// After:
return `<p class="...">${escape(name)}</p>`;
```

**Step 3 — apply at every interpolation that could carry user input.** No exceptions for "this looks safe":

```javascript
// All of these need escape():
${escape(name)}
${escape(email)}
${escape(initials)}
${escape(profile.first_name ?? "")}
${escape(profile.user_link)}     // even href values — see below
```

**Step 4 — for HTML attributes, escape inside the attribute too:**

```javascript
<a href="${escape(profile.user_link)}" ...>${escape(profile.user_link)}</a>
```

The href needs escaping because a payload like `"https://example.com" onmouseover="alert(1)"` would break out of the quoted attribute if not escaped. The `escape()` helper above turns `"` into `&quot;`, which keeps the value contained inside the attribute.

**Step 5 — when you legitimately have HTML to render, use a separate helper that doesn't escape, and audit usages:**

See `docs/solutions/ui-bugs/double-escape-prebuilt-html-via-value-escaping-renderer-2026-04-29.md` — `fieldRow(label, displayHtml)` for the rare HTML-passthrough case, `field(label, value)` for the common escape case.

## Why This Works

In vanilla-JS template-string rendering, every `${...}` interpolation injected into `innerHTML` is concatenated as raw HTML. The browser parses the result; it has no way to distinguish "this string came from a constant" from "this string came from user input." A single shared `escape()` helper:

- Forces every UI module to depend on the same escape semantics (one bug to fix if the helper changes; one place to audit).
- Makes the absence of `escape()` at a `${value}` site visible — a reviewer or grep can find every interpolation that lacks it.
- Eliminates the per-file copy-paste drift where one module has the right escape and another silently doesn't.

The escape function maps the five HTML-significant characters (`&`, `<`, `>`, `"`, `'`) into entity references. That's enough to safely render user data inside text content and inside attribute values. (It is not enough for `<script>` content, `<style>` content, URLs in `javascript:` schemes, or `srcdoc` — but those are fundamentally unsafe in template-string view layers and shouldn't be used.)

## Prevention

- **One shared `escape()` helper, imported by every UI module.** Never copy-paste it. The contract: turn five HTML-significant characters into entity references; return `""` for null/undefined.
- **Apply at every `${value}` interpolation that produces output.** Treat the absence of `escape()` as a security finding, not a style nit. Linting rule worth adding (future): warn on any `\${[^}]*}` inside a backtick-template that isn't `\${escape(...)}` or a known-safe constant.
- **Don't trust "internal" data.** If any column in a row was ever populated by user input (directly or via composition), treat the whole row as user-controlled. Profile rows where `display_name` is derived from `first_name + last_name` are user-controlled even though `display_name` "wasn't typed by the user."
- **Test with a real XSS payload.** Regression tests in `tests/ui/profilePage.test.js`:
  ```javascript
  it("escapes XSS payloads in display_name", () => {
    const dom = render(buildState({
      account: { profile: { display_name: "<img src=x onerror=alert(1)>", ... } }
    }));
    expect(dom.querySelector("img")).toBeNull();    // <-- the assertion
    expect(dom.innerHTML).toContain("&lt;img");
  });
  ```
  The assertion must be on a *DOM query*, not an `innerHTML` substring — `innerHTML.includes("img")` matches both real `<img>` tags and the escaped text `&lt;img&gt;`.
- **`href` values must escape too.** Even if the URL "looks fine," an unescaped `"` in the value breaks out of the attribute.
- **Build server-side escaping into the data layer when feasible.** If a future column is meant to hold raw HTML (e.g., user-authored markdown), make that intent explicit in the schema (column suffix `_html`) and audit every read site separately.

## Related Issues

- **`/ce-review` finding ID SEC-001** (severity high, confidence 0.85).
- **PR `Aquaveo/apps.geoglows#4`** — the fix added `src/ui/escape.js` and routed `navbar.js` and `profilePage.js` through it.
- **PR `Aquaveo/apps.geoglows#6`** — adds regression tests asserting XSS payloads don't produce real DOM nodes.
- **`docs/solutions/ui-bugs/double-escape-prebuilt-html-via-value-escaping-renderer-2026-04-29.md`** — the related "what happens when you escape HTML that's already HTML" bug.
