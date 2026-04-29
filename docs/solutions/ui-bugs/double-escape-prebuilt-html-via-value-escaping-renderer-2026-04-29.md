---
title: Pre-built HTML passed to a value-escaping field renderer renders as literal escaped text
date: 2026-04-29
category: ui-bugs
module: apps.geoglows
problem_type: ui_bug
component: rails_view
severity: high
symptoms:
  - Personal-link field on the profile page rendered as literal text "<a href=…>https://…</a>" instead of a clickable anchor
  - Page source showed escaped entities (&lt;a, &amp;quot;, etc.) where an anchor element was expected
  - Other text fields on the same page rendered correctly
root_cause: wrong_api
resolution_type: code_fix
tags:
  - xss
  - html-escape
  - double-escape
  - template-strings
  - vanilla-js
  - profile-ui
---

# Pre-built HTML passed to a value-escaping field renderer renders as literal escaped text

## Problem

`renderViewMode` in `src/ui/profilePage.js` built the personal-link `<a>` element as a string of HTML, then passed that string into a `field(label, value)` helper that called `escape()` on its `value` argument before injecting it. The escape helper turned the `<` and `>` into `&lt;` / `&gt;`, so the user saw `<a href="…">https://…</a>` as literal text instead of a clickable link.

Caught by `/ce-review` as **COR-001** (severity high, confidence 0.98).

## Symptoms

- Profile page renders `<a href="https://example.com">https://example.com</a>` as visible plain text where an anchor should be.
- Inspecting the DOM shows escaped entities (`&lt;a`, `&quot;`) instead of an `<a>` element.
- Other fields rendered through the same helper (`First name`, `Last name`, etc.) display correctly because their values are plain text.
- Only fields whose value is HTML are affected.

## What Didn't Work

- **Treating `field()` as polymorphic.** The helper was designed for the common case (escape user data into a label/value pair). Threading HTML through it relied on the helper *not* escaping — but its job is to escape. The two callers ("plain string" and "pre-built anchor HTML") needed different treatments.
- **Trying to "pre-escape" before passing to `field()`.** `field()` always escapes its input; pre-escaping just produces double-escaped output (`&amp;lt;a` instead of `&lt;a`). There's no way to make `field()` accept HTML by massaging the input.
- **Disabling escape inside `field()`.** Tempting, but defeats the helper's only safety guarantee for every other caller. Don't break the value-escaping contract.

## Solution

Split the helper into two functions: one that escapes its value (the common case), and one that takes a pre-built HTML fragment (the rare case).

**Before (broken):**

```javascript
function field(label, value, opts = {}) {
  const display = value
    ? `<span class="text-slate-800 dark:text-slate-200">${escape(value)}</span>`
    : `<span class="italic text-slate-400 dark:text-slate-500">${escape(opts.empty ?? "Not provided")}</span>`;
  return `
    <div>
      <p class="...">${escape(label)}</p>
      <p class="mt-1 text-sm">${display}</p>
    </div>
  `;
}

// Caller built HTML, passed through field() — gets double-escaped:
const userLink = profile?.user_link
  ? `<a href="${escape(profile.user_link)}" target="_blank" rel="noopener noreferrer" class="…">${escape(profile.user_link)}</a>`
  : null;

// ...
${field("Personal link", userLink, { empty: "—" })}   // ← escapes again, breaks the link
```

**After (fixed):**

```javascript
function fieldRow(label, displayHtml) {
  // Caller is responsible for ensuring displayHtml is safe.
  return `
    <div>
      <p class="...">${escape(label)}</p>
      <p class="mt-1 text-sm">${displayHtml}</p>
    </div>
  `;
}

function field(label, value, opts = {}) {
  // Common case — escapes value as text.
  const display = value
    ? `<span class="text-slate-800 dark:text-slate-200">${escape(value)}</span>`
    : `<span class="italic text-slate-400 dark:text-slate-500">${escape(opts.empty ?? "Not provided")}</span>`;
  return fieldRow(label, display);
}

// Anchor caller uses fieldRow directly:
const userLinkRow = profile?.user_link
  ? fieldRow(
      "Personal link",
      `<a href="${escape(profile.user_link)}" target="_blank" rel="noopener noreferrer" class="…">${escape(profile.user_link)}</a>`,
    )
  : field("Personal link", null, { empty: "—" });
```

`fieldRow(label, displayHtml)` is the lower-level primitive; `field(label, value)` builds on it for the safe-escape common case. The boundary makes "this is HTML, I am taking responsibility" explicit at the call site.

## Why This Works

The bug is a category mismatch: a value-escaping helper was being asked to handle a value that was already HTML. There is no flag-on-the-call-site fix that's safe — either the helper escapes (corrupts HTML callers) or it doesn't (vulnerable to XSS in plain-text callers).

The fix moves the escape decision *to the call site* by introducing a separate primitive whose contract is "you give me HTML, I trust you." Anyone using `fieldRow` is now visibly accepting responsibility for the HTML they pass in, and any future reviewer can grep for `fieldRow(` to audit every place that bypasses escape.

This is the same pattern as React's `dangerouslySetInnerHTML` vs. `{value}` — two distinct APIs by intent, named to make the dangerous one obvious.

## Prevention

- **A value-escaping renderer must never accept HTML.** If a helper escapes its input, route HTML through a different helper. Don't add a flag like `{ skipEscape: true }` — that's the wrong abstraction; the call sites that need HTML deserve their own primitive.
- **Audit at the call site, not the helper.** When introducing a "rendering helper" like `field()`, document its contract clearly (escapes the value) and grep usages on every refactor. Helpers with implicit "trust me" semantics rot fast.
- **`<a>`-as-string is a smell.** Building anchor HTML in JS strings is fragile (escape twice, miss once, get XSS or broken display). When the rendering layer is template-string-based, isolate HTML-building inside dedicated helpers with HTML in the name (`linkHtml(href, text)`, `fieldRow(label, html)`) so the type at the call site is unambiguous.
- **Test for the rendered shape, not just presence of text.** Regression test added in `tests/ui/profilePage.test.js`: parse the rendered output, assert `dom.querySelector('a[href="..."]')` is non-null. The XSS analog tests assert `dom.querySelector("img")` is null even after a payload like `<img src=x onerror=…>` flows through the field. Both rely on observable DOM shape, not innerHTML substring matches.

## Related Issues

- **`/ce-review` finding ID COR-001** (severity high, confidence 0.98) — the diagnostic that surfaced this.
- **PR `Aquaveo/apps.geoglows#4`** — the fix landed alongside the SEC-001 escape pass and the auth lib bump.
- **PR `Aquaveo/apps.geoglows#6`** — added regression tests in `tests/ui/profilePage.test.js`.
- **`docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md`** — the broader rule about HTML escape in vanilla JS template view layers.
