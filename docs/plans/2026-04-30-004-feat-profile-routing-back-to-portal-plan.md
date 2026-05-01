---
title: "feat: Configurable Profile link target + back-to-portal navigation across sub-apps"
type: feat
status: active
date: 2026-04-30
---

# feat: Configurable Profile link target + back-to-portal navigation across sub-apps

## Overview

Two related navigation improvements:

1. **Profile link goes somewhere real.** The lib's vanilla `renderAuthAction` hardcodes `<a href="#profile">`. In apps.geoglows that resolves correctly (it owns `#profile` hash routing). In sub-apps (grace, rfs, aquiferx), clicking the Profile link in the avatar dropdown does nothing — there's no `#profile` route handler in any of them, and the hash is same-document anyway. This plan makes the Profile link target configurable so sub-apps can point at `https://portal-dev.geoglows.org/#profile` (or `/#profile` when same-origin via portal proxy), where apps.geoglows actually handles the hash. apps.geoglows's existing hash routing is preserved as-is.
2. **Back to portal from any sub-app.** Once a user clicks into a sub-app from the portal, there's no obvious way back. Each sub-app gains a "GEOGloWS Portal" link (logo + label) in its navbar header.

The two are bundled because they share the same architectural seam (sub-app navigation back to apps.geoglows) and benefit from being shipped together.

## Problem Frame

After today's work shipping the auth + portal integration across 4 sub-apps, two navigation gaps surfaced in user testing:

- **Profile click is a dead end** in grace, rfs, and aquiferx. The lib's vanilla `renderAuthAction` (used by grace + rfs via the navbar slot) renders `<a href="#profile">Profile</a>`. From within grace at `portal-dev.geoglows.org/grace-groundwater/`, clicking that link is a same-document hash change — it does NOT navigate anywhere; the hash gets appended to the grace URL and grace has no `#profile` handler. apps.geoglows handles `#profile` via its `pageFromHash` router, but sub-apps don't reach apps.geoglows from a hash-only href. aquiferx uses the React `<UserMenu>` which has no Profile link at all (acceptable historically, but inconsistent with the vanilla side).
- **No way back to the portal from a sub-app.** Sub-apps render their own UI without any visual reference back to GEOGloWS. The user has to manually edit the URL or hit browser back. Each sub-app needs a navbar element that visibly anchors them in the portal ecosystem and links home.

## Requirements Trace

- **R1.** The lib's `renderAuthAction` (vanilla) and `<UserMenu>` (React) accept a configurable `profileHref` so consumers can point the Profile link wherever they need. Default behavior is preserved (`#profile` for `renderAuthAction`, no link for `<UserMenu>`).
- **R2.** Sub-apps (grace, rfs, aquiferx) configure the Profile link to point at the portal's `#profile` page using paths that actually navigate: root-relative `/#profile` for proxied sub-apps (same origin as the portal); absolute `${VITE_PORTAL_URL}/#profile` for aquiferx (different origin).
- **R3.** Each sub-app's navbar gains a visible "back to portal" affordance — icon + text link with `href` to the portal root: `/` for proxied sub-apps; `${VITE_PORTAL_URL}` for aquiferx.
- **R4.** Aquiferx introduces a `VITE_PORTAL_URL` env var (default `https://portal-dev.geoglows.org`) so the production portal target is overrideable per-environment without a code change.
- **R5.** The lib's new `profileHref` value is sanitized against dangerous URL schemes (`javascript:` / `data:` / `vbscript:`) before rendering — proactive security control, not consumer-responsibility.
- **R6.** No regression in any existing behavior: apps.geoglows's hash routing is unchanged (`#profile` / `#workspace` still work as the profile page route), sub-app proxy rewrites unchanged, all 4 portal apps' auth flows unchanged. apps.geoglows itself does not need to bump the lib dep for this plan unless it wants the security control (optional).

## Scope Boundaries

- **No apps.geoglows routing change.** apps.geoglows stays on hash-based routing (`#profile` / `#workspace`). No `pageFromPath`, no popstate listener, no click delegation, no Vercel SPA fallback rewrite. A real-path migration to `/profile` is a separate forward-looking infrastructure plan, not part of this user-complaint fix.
- **No `<UserMenu>` redesign.** The React `<UserMenu>` is currently a minimal `email + sign-out` widget (no Profile link). This plan adds a Profile link gated on the new `profileHref?` prop, but does not redesign the dropdown or pursue full parity with the vanilla `renderAuthAction` shape.
- **No new sub-app pages.** Sub-apps don't gain their own profile pages; the Profile link in a sub-app navbar always navigates to the portal's profile page.
- **No deep linking inside sub-apps.** Each sub-app continues to live at its proxied root path. Sub-apps don't get their own path routing as part of this plan.
- **Scope of "back to portal" UI is conservative.** A single icon + text link in the navbar — not a full sidebar or breadcrumb system.

### Deferred to Separate Tasks

- **apps.geoglows hash-to-path migration.** Converting apps.geoglows from `#profile` to `/profile` is a forward-looking infrastructure improvement that should justify itself with a list of planned future routes (e.g., `/settings`, `/admin`, `/notifications`, per-app deep links). Not in this plan; if pursued, it will need its own plan covering Vercel SPA fallback rewrite, click-delegation handler with HMR cleanup, popstate listener, legacy-hash redirect ordering vs Supabase auth, and cross-deploy history-stack handling.
- **Back-to-portal design dimensions.** Information architecture (placement: top-left vs top-right vs inline with title), responsive collapse behavior at narrow viewports (icon-only vs hamburger menu vs hide), touch-target sizing, SVG accessibility (`aria-label` strategy), and brand-mark fidelity (whether aquiferx uses lucide-react or extracts the GEOGloWS droplet SVG into a React component). These cross-sub-app design decisions deserve a focused design plan; this plan ships icon + text in a conservative position with per-sub-app implementation review handling pixel-level details.
- **Per-sub-app profile pages** — today's profile UI lives only on apps.geoglows.
- **Sub-app path routing** — if a sub-app (e.g., aquiferx) ever wants its own `/recover`, `/explore`, etc.

## Context & Research

### Relevant Code and Patterns

- **`geoglows-auth/src/core/auth-action.ts`**:
  - line 96 — `<a href="#profile" class="geoglows-auth-action-menu-link">Profile</a>` hardcoded. Becomes a configurable href via a second `options` argument to `renderAuthAction(state, options?)`. Default stays `"#profile"` to preserve apps.geoglows's current behavior without requiring changes.
- **`geoglows-auth/src/core/escape.ts`** — currently exports `escapeHtml`. Gain a new `sanitizeHref` helper (security control).
- **`geoglows-auth/src/react/UserMenu.tsx`** — currently 16 lines: email span + Log out button. No Profile link today. Adding one is straightforward.
- **`grace-groundwater-dashboard/index.html` lines 11-27** — existing nav-bar structure: title, button cluster, auth slot. Back-to-portal slot lands inside this navbar.
- **`rfs-v2-hydroviewer/index.html` lines 314-331** — `nav-bar-wrapper` with title + button cluster + auth slot. Same.
- **`aquiferx/App.tsx` ~line 1441** — `<UserMenu />` mount point in the navbar. Back-to-portal can be a sibling.

### Institutional Learnings

- **Sub-app proxy rewrites are origin-rewriting** — `portal-dev.geoglows.org/aquifer-analyst/...` proxies to `aquiferx-bay.vercel.app` but `window.location.origin` stays `portal-dev.geoglows.org`. So a sub-app at the proxied path can use root-relative URLs (`/#profile`, `/`) and they resolve to the portal — no absolute URL needed.
- **Direct-URL aquiferx is its own origin** (`aquiferx-bay.vercel.app`) — the recently-shipped forgot-password plan documented this distinction. Relative URLs from aquiferx via direct-URL resolve to its own origin (which has no `#profile` handler). For this plan: aquiferx's Profile link and back-to-portal link must use absolute URLs.
- **Hash-only links don't navigate** — `<a href="#profile">` from inside grace at `/grace-groundwater/` is a same-document hash change; the browser updates `window.location.hash` on the grace URL but never navigates to apps.geoglows. The fix is `<a href="/#profile">` (root-relative path with hash) so the browser navigates to the root path AND sets the hash; apps.geoglows then handles the hash.

### External References

- [Supabase Auth — onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) (background — auth flows are unchanged by this plan).

## Key Technical Decisions

- **apps.geoglows's hash routing stays.** No path-routing migration. The Profile link inside apps.geoglows continues to use `#profile` (the existing default in the lib). Phase B from the original plan revision is dropped entirely; if hash-to-path is desired later, it gets its own plan with explicit forward-looking justification.
- **Lib API: extend additively.** `renderAuthAction(state, options?)` gains an optional second arg with `profileHref?: string | null`. Default behavior is `"#profile"` (preserves apps.geoglows backward compat — apps.geoglows does NOT need to change `main.js` or bump the lib dep). When `null`, the Profile link is omitted entirely. `<UserMenu>` (React) gains a `profileHref?: string | null` prop with the same semantics + actually renders a Profile link (it doesn't today). Default `undefined` (no link rendered) for `<UserMenu>` so existing aquiferx behavior is unchanged unless the prop is explicitly passed.
- **Lib version bump 1.3.0 → 1.4.0** (minor, additive). The `renderAuthAction` signature is backward-compatible (second arg optional, default unchanged). `<UserMenu>` adds a new prop with a no-op default. New `sanitizeHref` export. No behavioral default change.
- **Scheme sanitization (security control).** `sanitizeHref` rejects dangerous URL schemes (`javascript:`, `data:`, `vbscript:`, case-insensitive after trimming leading whitespace) proactively in both vanilla and React surfaces. Consumer is NOT responsible for safe href values; the lib refuses dangerous schemes on their behalf.
- **Sub-app Profile link target:**
  - apps.geoglows: no change (still uses default `#profile` from the lib; no main.js edit needed).
  - grace, rfs (always proxied to portal in production): `"/#profile"` — root-relative path with hash. Same origin via proxy, so the browser navigates to apps.geoglows root, which reads the hash and shows the profile page.
  - aquiferx (intentionally accessed via direct Vercel URL after the forgot-password plan landed): `${VITE_PORTAL_URL}/#profile` — absolute URL via env var.
- **Sub-app back-to-portal target:**
  - grace, rfs: `"/"` — same origin via proxy.
  - aquiferx: `${VITE_PORTAL_URL}` — absolute URL via env var.
  - apps.geoglows: no change (it IS the portal).
- **`VITE_PORTAL_URL` env var (introduced in this plan).** Aquiferx-only — grace/rfs use root-relative URLs. Default `https://portal-dev.geoglows.org` if unset. Read at build time by Vite. Future portal domain cutovers (e.g., `portal.geoglows.org`) become a Vercel env var change, not a code change. Aquiferx Vercel preview branches can override this env var to point at preview portal deploys.
- **Back-to-portal UI shape: text + GEOGLOWS logo, not just text.** Each sub-app already has its own brand identity in its navbar. The back-to-portal link visually anchors the user without competing with the sub-app's identity — a small GEOGloWS droplet icon (already used in apps.geoglows's `ICONS.droplet`) + the text "GEOGLOWS Portal", left-aligned in the navbar header. Pixel-level styling and responsive collapse behavior are deferred to per-sub-app implementation review (see "Deferred to Separate Tasks" for the cross-cutting design plan).
- **Same-tab navigation for both Profile and back-to-portal.** No `target="_blank"`. Both are intentional in-place navigations: Profile is "I want to manage my account"; back-to-portal is "I'm leaving this sub-app." New-tab behavior is left to user-controlled affordances (Cmd-click, middle-click).
- **No Vercel changes anywhere.** apps.geoglows's `vercel.json` stays as-is. Sub-apps don't gain path routing.

## Open Questions

### Resolved During Planning

- **Convert apps.geoglows from hash to path routing?** → No, deferred to a separate forward-looking plan with explicit route justification.
- **Lib API shape for configurable Profile link?** → Optional second `options` arg to `renderAuthAction`; optional `profileHref?` prop on `<UserMenu>`. Default `#profile` (vanilla) / `undefined` (React). `null` hides the link.
- **Should `<UserMenu>` finally get a Profile link?** → Yes, as a parity addition with the vanilla surface, gated on the new prop.
- **Sub-app back-to-portal href: relative or absolute?** → Root-relative (`/`) for proxied sub-apps (grace, rfs). Absolute (`${VITE_PORTAL_URL}`) for aquiferx via env var.
- **`VITE_PORTAL_URL` — defer or now?** → Now. Aquiferx-only. Default `https://portal-dev.geoglows.org`.
- **Lib version?** → 1.4.0 (minor, additive — no behavioral default change).
- **Profile link label?** → Hardcoded to the literal string "Profile". Only the href is configurable.
- **Scheme sanitization for `profileHref`?** → Yes — the lib refuses `javascript:`, `data:`, `vbscript:` schemes proactively. Both vanilla and React surfaces share `sanitizeHref` from `geoglows-auth/src/core/escape.ts`.
- **Profile link from sub-app — same-tab or new-tab?** → Same-tab. User can Cmd-click for new-tab if desired.
- **Is back-to-portal link an icon, text, or both?** → Both: GEOGloWS droplet + "GEOGLOWS Portal" text. Visually compact, unmistakable.

### Deferred to Implementation

- **Visual treatment of the back-to-portal link in each sub-app** — exact font size, icon size, spacing — pick during implementation review per sub-app's existing nav style. "Low visual weight" means smaller than the sub-app's own title text and secondary to it.

## Implementation Units

### Phase A — Lib (`@aquaveo/geoglows-auth` 1.3.0 → 1.4.0)

- [ ] **Unit 1: Lib — `renderAuthAction` accepts optional `profileHref` config + `sanitizeHref` security control**

**Goal:** Add a second optional argument to `renderAuthAction(state, options?)` that controls the Profile link target. Add a `sanitizeHref` helper rejecting dangerous URL schemes. Keep the function's existing default (`#profile`) so apps.geoglows is unaffected.

**Requirements:** R1, R5.

**Dependencies:** None.

**Files:**
- Modify: `geoglows-auth/src/core/auth-action.ts` — accept `options?: { profileHref?: string | null }`. When `profileHref === null` (or sanitization rejects the scheme), omit the `<a>` entirely. Default to `"#profile"` (unchanged from current) when `options` is omitted or `profileHref` is undefined.
- Modify: `geoglows-auth/src/core/escape.ts` — add and export `sanitizeHref(value: string | null | undefined): string | null`. Returns `null` for dangerous schemes (case-insensitive `javascript:`, `data:`, `vbscript:` after trimming leading whitespace) or for empty/null input; returns the original value otherwise. Caller is responsible for HTML-escaping the returned value with `escapeHtml`.
- Modify: `geoglows-auth/src/core/index.ts` — re-export `sanitizeHref` so the React surface can use it.
- Modify: `geoglows-auth/tests/core/auth-action.test.ts` — add test cases.
- Add: `geoglows-auth/tests/core/escape.test.ts` (or extend existing) — add `sanitizeHref` test cases.

**Approach:**
- Function signature change: `renderAuthAction(state: AuthActionState, options?: AuthActionOptions): string`. New `AuthActionOptions` interface exported.
- The signed-out and loading branches don't render a Profile link, so the option only affects the signed-in branch.
- When `profileHref === null`, the entire `<a class="geoglows-auth-action-menu-link">Profile</a>` element is omitted. The dropdown still has the email header + sign-out button.
- Apply `sanitizeHref` to the resolved href value BEFORE `escapeHtml`. When sanitization returns `null`, omit the link entirely (same as `profileHref === null`).
- All `${value}` interpolations must escape via `escapeHtml` after sanitization.
- Profile link label hardcoded to the string "Profile" — only the href is configurable.

**Execution note:** Test-first.

**Patterns to follow:**
- Existing `renderAuthAction` shape; existing `escape` discipline in the lib.
- The vanilla 1.2.0 `mountSignInModal` pattern of accepting an options object with defaults.

**Test scenarios:**
- *Backward compat:* call with no options arg; assert href is `"#profile"` (UNCHANGED — apps.geoglows behavior preserved).
- *Happy path:* call with `{ profileHref: "/#profile" }`; assert href is `/#profile`.
- *Happy path:* call with `{ profileHref: "https://example.com/#profile" }`; assert href is rendered as absolute URL.
- *Edge case:* call with `{ profileHref: null }`; assert no `<a class="geoglows-auth-action-menu-link">` element renders; assert dropdown still has email + Log out.
- *Edge case (HTML escape):* call with `{ profileHref: '"><script>alert(1)</script>' }`; assert no `<script>` tag in output, the value is escaped inside the href attribute.
- *Edge case (scheme sanitization):* call with `{ profileHref: 'javascript:alert(1)' }`; assert the link is OMITTED (sanitizeHref rejected the dangerous scheme). Same for `data:text/html,<script>alert(1)</script>` and `vbscript:msgbox(1)`. Same for whitespace-prefixed `'  javascript:alert(1)'` (case-insensitive after trim).
- *Edge case (allowed schemes):* `https://example.com/profile`, `/profile`, `/#profile`, `#anchor` all render with their href escaped, not omitted.
- *Backward compat:* signed-out and loading branches unaffected; assert no Profile link in those branches regardless of `profileHref`.

**`sanitizeHref` test scenarios:**
- Returns `null` for `null`, `undefined`, `''`.
- Returns `null` for `'javascript:alert(1)'`, `'JavaScript:alert(1)'`, `'  javascript:alert(1)'`, `'data:text/html,...'`, `'vbscript:msgbox(1)'`.
- Returns the value unchanged for `'/profile'`, `'/#profile'`, `'#anchor'`, `'https://example.com'`, `'http://example.com'`, `'profile-relative'`.

**Verification:**
- 9 new auth-action test cases pass; 8 new sanitizeHref test cases pass; existing 16 auth-action tests still pass.

---

- [ ] **Unit 2: Lib — `<UserMenu>` accepts `profileHref` prop and renders Profile link**

**Goal:** Bring the React `<UserMenu>` to parity with vanilla `renderAuthAction` for the Profile link. Currently `<UserMenu>` shows only email + Log out — no Profile link. This unit adds an optional Profile link gated on the new `profileHref?` prop. Reuses Unit 1's `sanitizeHref` for proactive scheme rejection.

**Requirements:** R1, R5.

**Dependencies:** Unit 1 (for `sanitizeHref` export).

**Files:**
- Modify: `geoglows-auth/src/react/UserMenu.tsx` — add `profileHref?: string | null` prop; render `<a>` only when prop is non-null AND `sanitizeHref` accepts the scheme.
- Test: `geoglows-auth/tests/react/UserMenu.test.tsx` — currently has minimal coverage; add new test cases.

**Approach:**
- Props: `{ profileHref?: string | null }`. Default `undefined` (no link rendered) for backward compat with consumers who haven't migrated. Aquiferx today shows no Profile link; that stays true unless aquiferx explicitly passes the new prop.
- When `profileHref` is a string, run it through `sanitizeHref` (imported from `@aquaveo/geoglows-auth/core`); if the result is `null`, omit the link. Otherwise render `<a href={sanitizedHref}>Profile</a>` as a dropdown item alongside Log out.
- JSX auto-escapes HTML entities in attribute values; `sanitizeHref` blocks dangerous URL schemes that JSX does NOT block.
- Profile link label hardcoded to the string "Profile".
- Keep the visual treatment minimal — match existing UserMenu inline-CSS style.

**Execution note:** Test-first.

**Patterns to follow:**
- Existing `<UserMenu>` shape; existing inline-`CSSProperties` styling convention from `<ProfileSetupForm>` etc.
- Reuse Unit 1's `sanitizeHref` rather than duplicating scheme logic.

**Test scenarios:**
- *Happy path:* render with `profileHref="/#profile"`; assert link with `href="/#profile"` and visible text "Profile" is in the DOM.
- *Backward compat:* render without `profileHref`; assert no Profile link in DOM (only email + Log out).
- *Happy path:* render with `profileHref="https://example.com/#profile"`; assert link href is the absolute URL.
- *Edge case:* `profileHref={null}` — same as omitting; no link.
- *Edge case (scheme sanitization):* `profileHref='javascript:alert(1)'` — assert NO Profile link in the DOM (sanitizeHref rejected). Same for `data:text/html,<script>alert(1)</script>` and `vbscript:msgbox(1)`.
- *Edge case (allowed schemes):* `https://example.com/profile`, `/profile`, `/#profile`, `#anchor` all render the link.

**Verification:**
- 6 new test cases pass.

---

- [ ] **Unit 3: Lib release — version 1.4.0 + CHANGELOG**

**Goal:** Ship the new public API.

**Requirements:** Release prerequisite for Phase B.

**Dependencies:** Units 1, 2.

**Files:**
- Modify: `geoglows-auth/package.json` — version `1.3.0` → `1.4.0`.
- Modify: `geoglows-auth/CHANGELOG.md` — `[1.4.0]` entry covering: `renderAuthAction(state, options)` overload + `AuthActionOptions` type, `<UserMenu>` `profileHref` prop, exported `sanitizeHref` helper. **No behavioral default change** — default `profileHref` for `renderAuthAction` stays `"#profile"`.
- Modify: `geoglows-auth/CLAUDE.md` — add the new optional API to the Key Files section.

**Approach:**
- Minor bump (additive): backward-compatible signature change, additive prop on `<UserMenu>`, new export. No consumer breaks without explicit code changes.

**Test scenarios:**
- Test expectation: none — pure version bump + docs change. `prepublishOnly` gates build + test.

**Verification:**
- After merge: `npm publish` (2FA OTP) + `git tag v1.4.0 && git push --tags`.

### Phase B — Sub-apps

- [ ] **Unit 4: grace + rfs — Profile link target + back-to-portal navbar link**

**Goal:** Both grace and rfs are vanilla-JS sub-apps that use the lib's `renderAuthAction` slot. Bump the lib dep, configure the Profile link target to `/#profile` (root-relative — same origin via portal proxy, hash routes to apps.geoglows's existing profile page), and add a back-to-portal link to the navbar.

**Requirements:** R1, R2, R3, R5.

**Dependencies:** Unit 3 (lib 1.4.0 published).

**Files:**
- Modify: `grace-groundwater-dashboard/package.json` — `@aquaveo/geoglows-auth` `^1.3.0` → `^1.4.0`. Run `npm install --legacy-peer-deps`.
- Modify: `grace-groundwater-dashboard/src/auth-bootstrap.js` — pass `{ profileHref: "/#profile" }` to `renderAuthAction`.
- Modify: `grace-groundwater-dashboard/index.html` — add a back-to-portal `<a>` element to the navbar header. Inline GEOGloWS droplet SVG (matching the apps.geoglows ICON pattern) + text "GEOGLOWS Portal", `href="/"`.
- Modify: `grace-groundwater-dashboard/src/style.css` — minimal styling for the back-to-portal link to match the existing navbar aesthetic.
- Modify: `rfs-v2-hydroviewer/package.json` — `@aquaveo/geoglows-auth` `^1.3.0` → `^1.4.0`. Run `npm install --legacy-peer-deps`.
- Modify: `rfs-v2-hydroviewer/src/auth-bootstrap.js` — pass `{ profileHref: "/#profile" }`.
- Modify: `rfs-v2-hydroviewer/index.html` — add back-to-portal link to navbar.
- Modify: `rfs-v2-hydroviewer/src/css/main.css` — minimal styling.

**Approach:**
- The back-to-portal link is a single `<a class="back-to-portal" href="/">` with the inline GEOGLOWS droplet SVG + " GEOGLOWS Portal" text. Consistent visual treatment across both sub-apps.
- Position: top-left of navbar header (before the sub-app's own title). Anchors users in the portal ecosystem before they read the sub-app identity.
- Root-relative `href="/"` works because both grace and rfs are reached via portal proxy in production (same origin as apps.geoglows). Likewise `/#profile` navigates to the portal root with the `#profile` hash, which apps.geoglows handles.
- Existing dev-mode access (`localhost:3000` direct on grace) — relative `/` would just refresh the page. Acceptable degradation; dev environment isn't user-facing.

**Patterns to follow:**
- apps.geoglows's `ICONS.droplet` SVG content — same shape, smaller size for the navbar-link variant.
- The existing navbar HTML structure in each sub-app (`grace/index.html` `.nav-bar`, `rfs/index.html` `.nav-bar-wrapper`).

**Test scenarios:**
- Test expectation: none — sub-apps have no test infrastructure. Manual smoke covers verification.

**Verification:**
- `npm run build` clean for both grace and rfs.
- Manual smoke (after deploy):
  - On `portal-dev.geoglows.org/grace-groundwater/`, "GEOGLOWS Portal" link in navbar → click → lands on `portal-dev.geoglows.org/`.
  - Same for rfs.
  - Profile click in avatar dropdown → navigates to `portal-dev.geoglows.org/#profile` — apps.geoglows's profile page renders.

---

- [ ] **Unit 5: aquiferx — `VITE_PORTAL_URL` env var + Profile link target + back-to-portal navbar link**

**Goal:** aquiferx is the React consumer reached via direct Vercel URL. Both the Profile link and the back-to-portal link must be absolute URLs to the portal because `aquiferx-bay.vercel.app` is a different origin. Introduce `VITE_PORTAL_URL` env var so the production target is overrideable per-environment without a code change.

**Requirements:** R1, R2, R3, R4, R5.

**Dependencies:** Unit 3 (lib 1.4.0 published).

**Files:**
- Modify: `aquiferx/package.json` — `@aquaveo/geoglows-auth` `^1.3.0` → `^1.4.0`.
- Add: `aquiferx/.env.example` (or update existing) — document `VITE_PORTAL_URL=https://portal-dev.geoglows.org` as an optional env var with that default.
- Modify: `aquiferx/App.tsx` (or a new `aquiferx/portal-url.ts` constants module):
  - Define `const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? "https://portal-dev.geoglows.org";` at module scope.
  - Pass `profileHref={`${PORTAL_URL}/#profile`}` to `<UserMenu>`.
  - Add a back-to-portal `<a href={PORTAL_URL}>` element with GEOGloWS droplet icon (lucide-react substitute is acceptable; brand-mark fidelity deferred to the cross-sub-app design plan) + "GEOGLOWS Portal" text in the navbar header. Tailwind-styled to match aquiferx's existing nav aesthetic.
- Vercel project config: ensure `VITE_PORTAL_URL` is set (or unset, taking the default) for Production, Preview, and Development environments. Setting only Production silently breaks Preview deploys (per apps.geoglows learning).

**Approach:**
- `import.meta.env.VITE_PORTAL_URL` is read at build time; the fallback `?? "https://portal-dev.geoglows.org"` ensures local dev and unset-env-var Vercel deploys still work.
- Add `target="_blank"`? Decision: NO — going back to the portal is intentional in-place navigation, not a new-tab thing. Default behavior. Same for the Profile link.

**Patterns to follow:**
- aquiferx's existing `import.meta.env.VITE_*` usage pattern (Supabase env vars).
- aquiferx's existing navbar Tailwind structure.

**Test scenarios:**
- Test expectation: none — aquiferx has no test infrastructure; `npx tsc --noEmit` covers the type check; manual smoke covers UX.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vite build` clean.
- Manual smoke (post-deploy with default env var):
  - On `aquiferx-bay.vercel.app/`, "GEOGLOWS Portal" link visible in navbar → click → lands on `portal-dev.geoglows.org/` (full navigation, leaves aquiferx).
  - Profile click in `<UserMenu>` dropdown → opens `portal-dev.geoglows.org/#profile`.
- Manual smoke with overridden env var (optional, on a Vercel preview branch): set `VITE_PORTAL_URL=https://example-preview.vercel.app` → confirm both links target the override.

## System-Wide Impact

- **Interaction graph:** Adds a configurable Profile link to the lib's auth-action API (`renderAuthAction` now has options; `<UserMenu>` now has props). Adds a new navbar element to grace, rfs, aquiferx. apps.geoglows is unchanged.
- **Error propagation:** No async paths added. No new error states.
- **State lifecycle risks:** None — apps.geoglows's hash routing is unchanged; sub-apps only gain static navbar elements.
- **API surface parity:** Vanilla and React surfaces both now support configurable Profile links. `<UserMenu>` finally gets a Profile link option (which it never had — minor parity improvement gated on explicit prop).
- **Integration coverage:** Manual smoke after deploy is the only viable end-to-end coverage for navigation. Lib-side tests cover the API logic and the security control.
- **Pre-shipping link audit:** Before merge, grep documentation, README files, email templates, and Slack pin/bookmark sources for references to `#profile`, `#workspace`, or `/profile` so any external links can be reviewed. The lib's hash-routing default is unchanged, so existing `#profile` references continue to work via apps.geoglows.
- **Unchanged invariants:**
  - apps.geoglows's `setState`-driven render architecture and hash routing.
  - Auth flow (sign-in, sign-up, forgot-password, sign-out) — unchanged.
  - apps.geoglows's `vercel.json` rewrites — unchanged.
  - Sub-app proxy rewrites in apps.geoglows's `vercel.json` — unchanged.
  - All sub-app builds + deploy infrastructure — unchanged (just a dep bump + small navbar HTML).
  - apps.geoglows itself does NOT need to bump the lib dep for this plan (default behavior is preserved; bumping is optional for the security control).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Lib `profileHref` accepts dangerous URL schemes (`javascript:` / `data:` / `vbscript:`) and a future consumer passes user-provided data directly | `sanitizeHref` helper in `geoglows-auth/src/core/escape.ts` rejects dangerous schemes proactively (case-insensitive, leading-whitespace tolerant). Both vanilla and React surfaces share it. Test scenarios assert the link is omitted entirely when the scheme is rejected. |
| `<UserMenu>` adding a Profile link surprises aquiferx users (it didn't have one before) | The prop defaults to `undefined` (no link rendered) so existing `<UserMenu>` usage is unaffected. Profile link only appears when aquiferx explicitly passes the `profileHref` prop. |
| Sub-app back-to-portal link clutters the navbar visually | Conservative design: small icon + text, top-left, low visual weight. Per-sub-app implementation review can adjust styling without changing the architecture. Pixel-level styling deferred to a cross-sub-app design plan. |
| `VITE_PORTAL_URL` not set per-Vercel-environment → preview deploys silently target the wrong portal | Set `VITE_PORTAL_URL` for Production AND Preview AND Development on the aquiferx Vercel project. The fallback default protects against missing env vars but per-env override is required for cross-environment isolation. |
| Sub-app `/#profile` from grace/rfs breaks if those apps stop being proxy-mounted (e.g., direct Vercel URL access) | Grace/rfs direct-Vercel-URL access is already broken by `VITE_BASE_PATH` (assets reference proxied paths) — not a regression introduced by this plan. If a future change makes direct-URL access supported, those apps will need absolute URLs like aquiferx (and the same `VITE_PORTAL_URL` pattern can be lifted to them). |
| Lib version bump from 1.3.0 → 1.4.0 — apps.geoglows currently declares `^1.2.0` but uses 1.3.0-only API (`detectRecoveryUrlState`) | Verify `package-lock.json` resolves to 1.3.x already. apps.geoglows does NOT need to bump its declared range for this plan (default behavior is preserved). If the lockfile is at 1.2.x, that's a pre-existing bug surfaced for separate fix. |

## Documentation / Operational Notes

- **`geoglows-auth/CHANGELOG.md`** — `[1.4.0]` entry covering the new public API (`AuthActionOptions`, `profileHref` prop, `sanitizeHref` export). Explicitly note: NO behavioral default change; default `profileHref` for `renderAuthAction` stays `"#profile"`.
- **`geoglows-auth/CLAUDE.md`** — note new optional API in Key Files / Conventions sections.
- **`aquiferx/CLAUDE.md`** — document the `VITE_PORTAL_URL` env var: purpose, default, when to override.
- **Operational runbook after merge:**
  1. Lib publish: `npm publish` (1.4.0; `prepublishOnly` enforces build+test).
  2. Tag and push: `git tag v1.4.0 && git push --tags`.
  3. Sub-app PRs (Units 4, 5) land in parallel; Vercel auto-deploys each.
  4. Set `VITE_PORTAL_URL` for aquiferx Vercel Production + Preview + Development environments (or leave unset to take the default).
  5. Smoke test from production portal: navbar Profile link in each sub-app → portal /#profile; back-to-portal link in each sub-app → portal home.
  6. Cross-origin session continuity check: sign in via aquiferx-bay.vercel.app, click Profile, verify the portal-dev.geoglows.org/#profile page loads with the same session (or document the expected behavior if cross-origin session sharing requires a sign-in re-prompt).
- **`docs/solutions/`** — at least one new learning worth capturing post-implementation:
  1. Sub-app navigation back to portal: root-relative `/` works for proxied sub-apps (same origin); env-var-driven absolute URL needed for direct-Vercel-URL sub-apps. The `VITE_PORTAL_URL` pattern with a sensible default is the canonical approach.

## Sources & References

- Related code: `geoglows-auth/src/core/auth-action.ts`, `src/core/escape.ts`, `src/react/UserMenu.tsx`, sub-app `index.html` files, `aquiferx/App.tsx`.
- Related plans: `2026-04-30-002-feat-forgot-password-flow-plan.md`, `2026-04-30-003-feat-aquiferx-forgot-password-plan.md` (origin-distinction context).
- External docs: [Supabase Auth — onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) (background — auth flows are unchanged by this plan).
