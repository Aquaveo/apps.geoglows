---
title: Sharing a single CSS file across vanilla and React component surfaces — when it's the right call
date: 2026-04-30
problem_type: best-practice
module: geoglows-auth
tags:
  - css
  - cross-surface
  - design-system
  - api-design
---

# Sharing a single CSS file across vanilla + React surfaces

## Context

`@aquaveo/geoglows-auth` ships two consumer surfaces for the sign-in UI:

- **Vanilla** — `mountSignInModal` (1014 lines TS) used by apps.geoglows, grace, rfs
- **React** — `<SupabaseAuthUI>` used by aquiferx

Until 1.5.0, the React component had its own inline `style={}` constants while the vanilla modal used CSS classes from `geoglows-auth/src/core/sign-in.css`. The two surfaces had drifted visually — same component-conceptually, different look. The user's ask was "make the React one look like the vanilla one."

The 1.5.0 plan considered three approaches:

1. **Restyle inline** — port the vanilla CSS into a new `styles` constant in the React component. Decouples both surfaces.
2. **React-only stylesheet** — ship a new `sign-in-react.css` that duplicates the visuals.
3. **Reuse the existing `sign-in.css`** — migrate the React component to `className=` references; consumers import the lib's existing CSS.

Option 3 was chosen. This is the document of when that's the right call and the trade-offs to be aware of.

## Guidance

**Use a single shared CSS file across vanilla and React surfaces when ALL of these are true:**

1. Both surfaces are intended to look identical now AND in the foreseeable future. If you'd plausibly want one to diverge from the other (different brand color, different density, different responsive behavior), don't share.
2. The visual primitives (buttons, inputs, dividers, confirmation panels) are domain-agnostic — they describe interaction states (`.button-primary`, `.input`, `.divider`) rather than surface-specific layouts (`.modal-frame-vanilla`, `.dialog-frame-react`).
3. The component is small enough that drift cost (visual inconsistency between surfaces) outweighs decoupling cost (one surface's redesign affects both).
4. The plain CSS file works under the host project's CSS framework. Tailwind preflight, Calcite Components, ArcGIS Map's globals — these have all been validated for `geoglows-auth/src/core/sign-in.css`. Property-level resets (`border: 0`, `background: transparent`, `box-sizing: border-box`) explicit in the CSS file head off most collisions without requiring `:where()` or `@layer`.
5. The classes' selectors don't target the modal frame — the *frame* is per-surface (vanilla `<dialog>`, React `<dialog>` styled by aquiferx with Tailwind) but the *content* is shared. Sharing only the content classes preserves each surface's framing autonomy.

**Pattern in practice (geoglows-auth 1.5.0):**

`sign-in.css` exports content classes that both surfaces use:
- `.geoglows-signin-content`, `.geoglows-signin-header`, `.geoglows-signin-title`, `.geoglows-signin-close`
- `.geoglows-signin-providers`, `.geoglows-signin-provider-button`
- `.geoglows-signin-divider`, `.geoglows-signin-divider-label`
- `.geoglows-signin-form`, `.geoglows-signin-name-grid`, `.geoglows-signin-field`, `.geoglows-signin-label`, `.geoglows-signin-input`
- `.geoglows-signin-submit`
- `.geoglows-signin-toggle-text`, `.geoglows-signin-toggle-button`, `.geoglows-signin-forgot-row`, `.geoglows-signin-forgot-link`
- `.geoglows-signin-confirmation`, `.geoglows-signin-confirmation-text`, `.geoglows-signin-confirmation-back`
- `.geoglows-signin-error`

Vanilla `mountSignInModal` ALSO defines `.geoglows-signin-modal` for the `<dialog>` frame. The React `<SupabaseAuthUI>` does NOT use `.geoglows-signin-modal` — aquiferx's outer `<dialog>` is styled with Tailwind (`rounded-2xl backdrop:bg-slate-900/60` etc.). The frame is per-surface; only content is shared.

**Consumer setup:**

```tsx
// aquiferx/index.tsx — at app entry, before any React mount
import '@aquaveo/geoglows-auth/core/sign-in.css';
```

The CSS is a side-effect import. Tree-shaking is moot for CSS files. Importing once at app entry is cheaper than importing inside the component (no per-mount cost).

## Why this matters

**Pro: single source of truth.** A future visual change (new brand color, refined typography) lands in one place and applies everywhere. No drift.

**Con: cross-surface coupling.** A future redesign that wants ONE surface different from the other now needs to split the file first. That's a real cost — the CSS file constrains both surfaces to evolve together until it's split.

**Pro: smaller bundle.** Vanilla consumers and React consumers ship the same ~8KB CSS file. If you duplicated, every consumer that uses both surfaces would ship two near-identical sheets.

**Pro: type/discipline parity.** The vanilla side already had `escapeHtml` discipline; the React side relies on JSX auto-escape. The CSS reuse gave us a chance to introduce `sanitizeHref` (for href-shaped consumer props like `profileHref`, `oauthRedirectTo`, `emailRedirectTo`) as a shared security control — both surfaces use it.

## When to apply

- New lib component shipping a vanilla AND React surface — start with shared CSS unless you have a specific divergence requirement.
- Bringing an existing React surface to visual parity with a vanilla surface — migrate from inline styles to className references; share the CSS.
- Replatforming a single-surface component into dual-surface — extract the styles to a `.css` file BEFORE writing the second surface, so the second surface inherits styles instead of reinventing them.

**Do NOT apply** when:

- The two surfaces have different host-app contexts (e.g., one is for an external SDK shipped to third parties, one is for an internal dashboard) — divergence is likely and decoupling upfront is cheaper.
- The component is large and the visual surface is heterogeneous (a modal with 6+ views, each with its own layout). Coupling here makes any redesign a cross-surface project.
- The team strongly prefers CSS-in-JS or a component library (Tailwind classes inline, MUI, Chakra, shadcn). A plain `.css` file is operationally fine but stylistically out-of-step. Don't introduce it as a one-off if the rest of the codebase wouldn't accept it.

## Examples

### geoglows-auth 1.5.0

```tsx
// src/react/SupabaseAuthUI.tsx (React surface)
return (
  <div className="geoglows-signin-content">
    <div className="geoglows-signin-header">
      <h2 className="geoglows-signin-title">Sign in</h2>
      {onClose && <CloseButton onClose={onClose} />}
    </div>
    <div className="geoglows-signin-providers">
      <button className="geoglows-signin-provider-button" onClick={...}>
        <GoogleIcon /> Continue with Google
      </button>
    </div>
    {/* ... */}
  </div>
);
```

```ts
// src/core/sign-in.ts (vanilla surface)
return `
  <div class="geoglows-signin-content">
    <div class="geoglows-signin-header">
      <h2 class="geoglows-signin-title">Sign in</h2>
      <button class="geoglows-signin-close">×</button>
    </div>
    <div class="geoglows-signin-providers">
      <button class="geoglows-signin-provider-button">
        <svg>...</svg> Continue with Google
      </button>
    </div>
    ...
  </div>
`;
```

Same classes, same CSS file. Different runtimes.

## Related

- Plan: `apps.geoglows/docs/plans/2026-04-30-005-feat-react-sign-in-modal-parity-plan.md`
- Lib 1.5.0 CHANGELOG entry — documents the breaking change ("default visuals require importing `sign-in.css`")
- `geoglows-auth/CLAUDE.md` — `src/react/SupabaseAuthUI.tsx` line item documents the import requirement and the cross-surface coupling
- Related learning: `sub-app-portal-url-relative-vs-absolute-2026-04-30.md` (cross-surface URL pattern)
