---
title: Native <dialog> + Tailwind — explicit centering required, flex-col scroll children need flex-1 min-h-0
date: 2026-04-30
category: ui-bugs
module: apps.geoglows
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - Native <dialog> renders in the top-left corner instead of viewport-centered
  - Two scrollbars on the same modal — one on the dialog frame, one on the inner content
  - Modal "looks unstyled" relative to the lib's auth modal which uses the same pattern
root_cause: incomplete_setup
resolution_type: code_fix
tags:
  - dialog
  - tailwind
  - modal
  - flex
  - css
  - overflow
---

# Native `<dialog>` + Tailwind — explicit centering required, flex-col scroll children need `flex-1 min-h-0`

## Problem

When mounting a native `<dialog>` in apps.geoglows (which uses Tailwind CSS v4 with preflight), two visual bugs surfaced in quick succession on the disclaimer modal:

1. **The modal opened in the top-left corner of the viewport** instead of centered. The browser's `<dialog>:modal` UA centering didn't fire under Tailwind preflight.
2. **After fixing centering, the modal had two scrollbars** — one on the outer dialog frame, one on the inner scrollable body region — even though only the body region was supposed to scroll.

Both bugs were filed against the same modal within minutes of each other; both are well-known interactions between native `<dialog>`, Tailwind's preflight, and CSS flex sizing defaults. Documented together because in practice you hit both at once.

## Symptoms

**Bug 1 — top-left corner rendering:**
- Dialog visible at coordinates (0, 0) instead of centered.
- Backdrop covers the viewport correctly; only the dialog itself is mis-positioned.
- Affects the dialog regardless of inner content.

**Bug 2 — double scrollbar:**
- Two visible vertical scrollbars on the same modal.
- The inner scrollbar scrolls the body text (correct).
- The outer scrollbar scrolls the entire dialog frame (wrong) — including header and footer.
- Footer ("Accept" button) jumps off-screen when the user scrolls because both scrollbars are alive at once.

## What Didn't Work

- **Relying on UA `<dialog>:modal` centering.** Native browser default for an open modal dialog is centered, but Tailwind preflight's `border-style: solid` and `box-sizing: border-box` resets, plus apps.geoglows's own resets, make UA centering inconsistent across browsers. Apps.geoglows's CLAUDE.md `§ Conventions` already documents this as a project-wide convention, but it's easy to forget when adding a new modal.
- **Setting `max-height: 80vh` on the inner flex column only.** The flex column still had `min-height: auto` (the flex default), so it sized to its content's full natural height, exceeding the dialog's eventual cap. Result: content overflowed the dialog → dialog itself scrolled.
- **`overflow-y-auto` on the inner content alone.** Tailwind's `overflow-y-auto` adds a scrollbar IF the content overflows. Without `flex-1 min-h-0`, the flex item sized to content (no constraint to overflow), and the dialog sized to fit the flex item (so dialog overflowed instead). Both ended up with scrollbars in different conditions.
- **Mixing the two fixes piecemeal.** Tried fix 1 first (centering only), shipped, user reported double scrollbar. Each fix is one line; they should have shipped together with the modal.

## Solution

**For centering**, add explicit Tailwind classes on the `<dialog>` to override UA defaults:

```html
<dialog
  id="geoglows-disclaimer-modal"
  class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 rounded-2xl p-0 max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
></dialog>
```

Key classes:
- `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` — explicit centering. The `-translate` pulls the element back by half its own dimensions.
- `m-0` — strip the UA dialog margin.
- `max-h-[90vh]` — cap the dialog height.
- `overflow-hidden` — kill any chance of the dialog frame itself scrolling. Belt and suspenders for the double-scrollbar bug.

**For the flex-col scroll child**, add `flex-1 min-h-0` to the scrollable region:

```html
<div class="flex flex-col h-full max-h-[90vh]">
  <header class="px-6 pt-6 pb-3 border-b border-slate-200">
    <h2>Disclaimers</h2>
  </header>
  <div tabindex="0" class="flex-1 min-h-0 overflow-y-auto px-6 py-4 ...">
    <!-- scrollable content -->
  </div>
  <footer class="px-6 py-4 border-t border-slate-200 flex justify-end ...">
    <button>Accept</button>
  </footer>
</div>
```

Key classes on the scrollable child:
- `flex-1` — grow to fill remaining space after header and footer take their natural height.
- `min-h-0` — override the default `min-height: auto` that prevents flex items from shrinking below content size. **This is the load-bearing fix** — without it, `flex-1` doesn't actually shrink the child below content height.
- `overflow-y-auto` — scroll within the bounded flex item.

## Why This Works

**Centering**: native `<dialog>:modal` uses UA-stylesheet centering that only fires when the element has its initial `position: static` and no margin/border resets in play. Tailwind preflight changes `box-sizing` and resets `border-style` globally, which breaks the UA assumption silently. Explicit `position: fixed` + 50% offset + `-translate-1/2` gives deterministic centering that doesn't depend on UA defaults.

**Flex sizing**: in a flex column, the default `min-height` of every flex item is `auto`, which means "at least the content's natural height." So even when you give a child `flex-1`, the child can't actually shrink below its content. Setting `min-h-0` overrides that default, letting `flex-1` constrain the child to the remaining space. With the child's height now bounded, its own `overflow-y-auto` produces a scrollbar that scrolls the content within that bounded region. The parent (the dialog) doesn't see overflow because every child fits in its allocated space.

`overflow-hidden` on the dialog itself is defense-in-depth: even if the inner sizing is wrong, the dialog frame won't paint a scrollbar.

## Prevention

- **Add a checklist to apps.geoglows CLAUDE.md `§ Conventions` Modals subsection** (already documents centering; add the flex-scroll rule):
  > When using `<dialog>` with a flex-column inner layout (header + scrollable body + footer), the scrollable body MUST have `flex-1 min-h-0` and the dialog itself should have `overflow-hidden` to prevent double scrollbars. Native `<dialog>:modal` centering is unreliable under Tailwind preflight — use `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0`.
- **Reuse the lib's auth modal as a reference**: `geoglows-auth/src/core/sign-in.css` already gets centering right via plain CSS. When mounting a new dialog, copy its frame dimensions and translate-based centering.
- **Visual test on first deploy.** Both bugs were caught by the user looking at the deployed modal, not by tests. Manual smoke is the right tool — these are layout bugs that don't fire in jsdom (the dialog patch doesn't simulate centering or overflow).
- **One unified bug-shape**: when you see "modal has weird positioning" and "modal has scrollbar where it shouldn't," check both at once. They share the same family of root causes (Tailwind preflight + native dialog + flex defaults).

## Related Issues

- **Lib pattern reference**: `geoglows-auth/src/core/sign-in.css` `.geoglows-signin-modal` — uses plain CSS for centering with the same `position: fixed; transform: translate(-50%, -50%)` approach. Apps.geoglows's CLAUDE.md `§ Conventions` references this.
- **PRs**:
  - `Aquaveo/apps.geoglows#24` — fix: center disclaimer modal explicitly
  - `Aquaveo/apps.geoglows#25` — fix: eliminate disclaimer modal double scrollbar
- **Related solution**: `docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md` — the dialog prototype patch. Note: jsdom doesn't simulate dialog centering or overflow, so these bugs cannot be caught in unit tests; manual smoke is required.
- **Related solution**: `docs/solutions/best-practices/cross-surface-css-shared-stylesheet-2026-04-30.md` — when to share CSS across surfaces. The auth modal's centering CSS is one of the shared primitives.
