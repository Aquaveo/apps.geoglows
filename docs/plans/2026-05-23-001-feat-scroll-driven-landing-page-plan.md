---
title: "feat: Replace onboarding with permanent scroll-driven landing page"
type: feat
status: active
date: 2026-05-23
---

# feat: Replace onboarding with permanent scroll-driven landing page

## Overview

Replace the current dismissible onboarding experience and static app library page with a single, permanent scroll-driven landing page. Every visitor (first-time and returning) sees the same page: a hero section that scrolls into individual app showcases with anime.js-powered reveal animations, ending with interactive app cards + sign-in access. The onboarding localStorage persistence system is removed entirely.

## Problem Frame

The current portal has two competing page modes:
1. A first-visit onboarding (4 scroll sections with IntersectionObserver reveals) that dismisses permanently via localStorage
2. A static app library page (2-column card grid) shown after onboarding dismissal

Problems with this split:
- The onboarding disappears forever, wasting its content for returning users
- The static app library is functional but uninspiring; it doesn't generate interest in the tools
- The "Scroll to explore" text and dismiss-based flow feel unfinished
- There's no narrative arc connecting the GEOGLOWS mission to the specific tools

The new page unifies both into a scroll-driven experience that serves as the permanent homepage, introducing each app with purpose and ending with actionable cards.

## Requirements Trace

- R1. The portal homepage is a single scroll-driven page; no separate onboarding or app library
- R2. Hero/welcome section introduces GEOGLOWS and its mission
- R3. Each visible app gets a dedicated scroll section with description, icon, and app-specific context to generate interest
- R4. Scroll-linked animations powered by anime.js reveal content as the user scrolls
- R5. The page ends with interactive app cards providing direct access, plus sign-in/auth
- R6. Animations respect `prefers-reduced-motion` (WCAG AA)
- R7. No localStorage persistence or dismiss mechanism; every visit shows the same page
- R8. Header, footer, auth integration, disclaimer modal, and theme toggle continue working unchanged
- R9. Profile page (`#profile` hash route) is unaffected

## Scope Boundaries

- The header, footer, disclaimer modal, auth flow, and profile page are unchanged
- No changes to `vercel.json` rewrites, `apps.json` schema, or sub-app routing
- No changes to the geoglows-auth library
- anime.js is used for scroll-linked reveals only; no scroll hijacking, parallax, or physics-based animations
- Copy/content for each app showcase section is derived from `apps.json` descriptions; no new marketing copy is authored in this plan

### Deferred to Separate Tasks

- Updating DESIGN.md to reflect the new page structure: run `/impeccable document` after implementation
- Video or media embeds in app showcase sections: future enhancement

## Context & Research

### Relevant Code and Patterns

- `src/onboarding.js` — current scroll-driven onboarding with IntersectionObserver reveals (to be replaced)
- `src/ui/appsPage.js` — current static app library (to be replaced)
- `src/main.js` — owns `appState`, `render(state)`, conditional rendering of onboarding vs apps page
- `src/events.js` — binds `onboardingDismiss` and `onboardingDismissEnd` handlers (to be removed)
- `src/style.css` — `.onboarding-reveal` class with opacity/translateY transitions (to be replaced by anime.js)
- `src/appIcons.js` — `getAppIcon(iconName)` loads SVG icons from `src/icons/*.svg` via Vite glob import
- `apps.json` — app catalog with `name`, `description`, `path`, `tags`, `iconName`, `iconClass`, `hidden`, `disabled` fields

### Architecture Constraints

- **innerHTML re-render**: the app re-renders the entire `#app` on every `setState()` call. Anime.js animations must be re-initialized after each render since DOM nodes are replaced. This means animation setup belongs in a post-render hook (like the current `initOnboardingObserver()` pattern)
- **No virtual DOM**: animations targeting specific elements need stable selectors (IDs or data attributes) that survive re-renders
- **HTML escape discipline**: any user-facing string interpolated via `${}` must use `escapeHtml()`. App data from `apps.json` is static/trusted, but the pattern should be maintained for consistency

### Institutional Learnings

- `docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md` — all dynamic interpolation must go through `escapeHtml()`

## Key Technical Decisions

- **anime.js v4 via npm**: install as a production dependency (`npm install animejs`). v4 is ES-module-native and tree-shakeable. Bundle impact: ~10KB gzipped, zero dependencies. This is the first animation library in the project. **Important**: v4 API differs from v3 — use `animate()` not `anime()`, `onScroll()` built-in, `ease` not `easing`, `alternate: true` not `direction: 'alternate'`
- **Use anime.js built-in `onScroll()` API**: v4 has a native scroll observer (`import { onScroll } from 'animejs'`) that both triggers animations at scroll thresholds and can synchronize animation progress to scroll position. No IntersectionObserver needed. Pass `onScroll({ target, enter, leave })` as the `autoplay` parameter to `animate()` or `createTimeline()`. Cleanup via `scrollObserver.revert()` before DOM teardown
- **`createScope({ mediaQueries })` for reduced-motion**: anime.js v4's `createScope()` can detect `prefers-reduced-motion` natively and auto-refresh when the OS setting changes. Skip all animations when reduced motion is preferred
- **No scroll hijacking**: PRODUCT.md anti-references explicitly warn against "animation-heavy, scroll-hijacking" patterns. The animations reveal content on scroll but never take control of scroll position or velocity. Use `onScroll()` in trigger mode (not `sync: true`) so animations play naturally when sections enter the viewport rather than being rigidly locked to scroll position
- **Single page, no state bifurcation**: remove the `onboardingStatus` state field and the conditional rendering branch in `main.js`. The apps page template becomes the only content renderer for the `#apps` hash route
- **Replace onboarding.js with landingPage.js**: new module renders the full scroll-driven page. The old `appsPage.js` is absorbed into this
- **Animation re-initialization pattern**: after each `renderApp()` call, if the current page is `apps`, call `initScrollAnimations()` which sets up IntersectionObserver + anime.js timelines for each section. Guard against double-init by disconnecting previous observers

## Open Questions

### Resolved During Planning

- **Should anime.js control scroll position?** No. Native scroll only. Anime.js handles element reveal animations triggered by scroll position. This avoids the "flashy marketing sites" anti-reference
- **Should the page use scroll snapping?** No. Scroll snapping fights native scroll on touch devices and creates accessibility issues. Sections should flow naturally
- **Where do the app cards go?** Final section of the page, after the individual app showcase sections. Cards provide the actual navigation links

### Deferred to Implementation

- Exact animation parameters (duration, easing, translateY offset) to be tuned visually during implementation
- Whether each app showcase section needs a unique visual treatment or a consistent template with app-specific color accents
- Precise responsive breakpoint behavior for the showcase sections (single-column layout may need different animation choreography than desktop)

## Implementation Units

- [ ] **Unit 1: Add anime.js dependency**

**Goal:** Install anime.js and verify it builds with Vite

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `package.json`

**Approach:**
- `npm install animejs`
- Verify `npm run build` succeeds and the import resolves

**Test expectation:** none — dependency installation, no behavioral change

**Verification:**
- `npm run build` completes without errors
- `import anime from 'animejs'` resolves in a test file

---

- [ ] **Unit 2: Create landing page module**

**Goal:** Create `src/ui/landingPage.js` that renders the complete scroll-driven page: hero section, per-app showcase sections, and final cards section

**Requirements:** R1, R2, R3, R5

**Dependencies:** Unit 1

**Files:**
- Create: `src/ui/landingPage.js`
- Test: `tests/ui/landingPage.test.js`

**Approach:**
- Export `renderLandingPage()` returning the full HTML string
- Export `initScrollAnimations()` that sets up IntersectionObserver + anime.js for each `.scroll-section`
- **Hero section**: GEOGLOWS icon + wordmark + mission statement. No "scroll to explore" text; let the content below naturally invite scrolling
- **App showcase sections**: one per visible app from `apps.json`. Each section is full-viewport-height (`min-h-screen`) with the app icon, name, description, tags, and a contextual sentence about what users can do with the tool. Use `getAppIcon()` for icons
- **Cards section**: the existing app card design from `appsPage.js`, plus a sign-in CTA for unauthenticated users. This is the actionable endpoint of the page
- Each section gets a `.scroll-section` class and a nested `.scroll-reveal` container for animation targeting
- `initScrollAnimations()` uses anime.js v4's built-in `onScroll()` as the `autoplay` parameter for `animate()` calls. Each `.scroll-section` gets its own `animate()` call with `autoplay: onScroll({ target: sectionEl })` to trigger opacity + translateY reveals when the section enters the viewport. Use `stagger()` for child element delays
- Use `createScope({ mediaQueries: { reduceMotion: '(prefers-reduced-motion)' } })` to skip all animations when reduced motion is preferred
- Guard against re-initialization: track active scope/animations at module level; call `.revert()` on existing scope before creating a new one on re-render
- All app data comes from `apps.json` via the existing config import pattern

**Patterns to follow:**
- `src/onboarding.js` — current pattern for rendering scroll sections with IntersectionObserver and post-render initialization
- `src/ui/appsPage.js` — current pattern for rendering app cards from `apps.json`

**Test scenarios:**
- Happy path: `renderLandingPage()` renders a hero section with "GEOGLOWS" text
- Happy path: renders one showcase section per visible (non-hidden) app from `apps.json`
- Happy path: renders a cards section at the end with links matching each visible app's `path`
- Edge case: hidden apps (`hidden: true`) do not get showcase sections
- Edge case: disabled apps render but with appropriate disabled styling in the cards section
- Integration: `initScrollAnimations()` creates an IntersectionObserver and returns a cleanup function

**Verification:**
- The page renders hero + N app showcases + cards section where N = visible apps count
- `initScrollAnimations()` sets up observers without errors

---

- [ ] **Unit 3: Wire landing page into main.js and remove onboarding state**

**Goal:** Replace the conditional onboarding/apps rendering in `main.js` with the new landing page module. Remove all onboarding state management

**Requirements:** R1, R7, R8, R9

**Dependencies:** Unit 2

**Files:**
- Modify: `src/main.js`
- Modify: `src/events.js`
- Delete: `src/onboarding.js`
- Delete: `src/ui/appsPage.js`
- Modify: `tests/events.test.js`
- Delete: `tests/ui/appsPage.test.js` (if exists)

**Approach:**
- In `main.js`:
  - Remove `onboardingStatus` from `appState`
  - Remove imports of `getOnboardingStatus`, `dismissOnboarding`, `renderOnboardingPage`, `initOnboardingObserver`
  - Remove `renderAppsPage` import
  - Add imports of `renderLandingPage`, `initScrollAnimations` from `src/ui/landingPage.js`
  - In `render()`: replace the conditional `state.onboardingStatus === "active" ? renderOnboardingPage() : renderAppsPage()` with just `renderLandingPage()`
  - In `renderApp()`: replace `if (appState.onboardingStatus === "active") initOnboardingObserver()` with `initScrollAnimations()` (called whenever the current page is `apps`)
  - Footer continues to render always (no onboarding-conditional hiding)
- In `events.js`:
  - Remove `dismissOnboarding` import
  - Remove `onboardingDismiss` and `onboardingDismissEnd` event bindings
- Delete `src/onboarding.js` and `src/ui/appsPage.js`
- Update `tests/events.test.js` to remove onboarding dismiss expectations

**Patterns to follow:**
- Current `main.js` render/post-render pattern

**Test scenarios:**
- Happy path: `render()` with `currentPage: "apps"` renders the landing page content
- Happy path: `render()` with `currentPage: "profile"` renders the profile page (unchanged)
- Happy path: events.js no longer binds onboardingDismiss handlers
- Edge case: `appState` no longer contains `onboardingStatus` field

**Verification:**
- The portal loads and shows the scroll-driven landing page without errors
- Switching to `#profile` and back to `#apps` works correctly
- No references to onboarding localStorage keys remain in the active codebase

---

- [ ] **Unit 4: Add scroll animation CSS and reduced-motion handling**

**Goal:** Add CSS classes for scroll sections and handle `prefers-reduced-motion`

**Requirements:** R4, R6

**Dependencies:** Unit 2

**Files:**
- Modify: `src/style.css`

**Approach:**
- Replace `.onboarding-reveal` / `.onboarding-reveal.visible` classes with new `.scroll-section` and `.scroll-reveal` classes
- `.scroll-reveal` starts with `opacity: 0` (anime.js handles the animation, but CSS provides the initial hidden state so there's no flash of unstyled content before JS runs)
- Under `prefers-reduced-motion: reduce`: `.scroll-reveal` gets `opacity: 1; transform: none` immediately (no animation wait)
- Remove dead `.onboarding-reveal` CSS

**Test expectation:** none — pure CSS, no behavioral code

**Verification:**
- Elements start hidden and reveal on scroll
- With `prefers-reduced-motion: reduce`, all content is immediately visible without animation

---

- [ ] **Unit 5: Clean up dead code and update tests**

**Goal:** Remove all onboarding-related dead code, update remaining tests, verify full test suite passes

**Requirements:** R7

**Dependencies:** Units 3, 4

**Files:**
- Modify: `tests/disclaimer.test.js` (if it references onboarding)
- Delete: `tests/onboarding.test.js` (if exists)
- Modify: any remaining files with stale onboarding references

**Approach:**
- Grep for `onboarding`, `ONBOARDING_KEY`, `onboardingStatus`, `dismissOnboarding` across the codebase
- Remove any remaining references
- Run `npm test` and fix any failures
- Run `npm run build` to verify production build

**Test scenarios:**
- Happy path: `npm test` passes with zero failures
- Happy path: `npm run build` completes without errors
- Edge case: no references to `geoglows-onboarding-dismissed` localStorage key remain in active code

**Verification:**
- Full test suite green
- Production build succeeds
- `grep -r "onboarding" src/` returns zero matches (except potentially in commit messages or plan docs)

## System-Wide Impact

- **Interaction graph:** The `renderApp()` → `bindWorkspaceEvents()` → `initScrollAnimations()` chain replaces the current `renderApp()` → `initOnboardingObserver()` chain. The auth action slot in the header, disclaimer modal, and sign-in modal are unaffected
- **Error propagation:** anime.js animation failures should not prevent page content from being visible (CSS initial state is hidden, but reduced-motion fallback shows everything; guard the JS init with try/catch)
- **State lifecycle risks:** Removing `onboardingStatus` from `appState` is a clean deletion; no other module depends on it. The `disclaimerStatus` field remains unchanged
- **API surface parity:** No external API changes. `apps.json` schema unchanged
- **Integration coverage:** The main integration to verify is that `initScrollAnimations()` correctly re-initializes after a full re-render (state change → innerHTML replacement → new DOM → re-observe)
- **Unchanged invariants:** Header nav, theme toggle, auth action, profile page, disclaimer modal, footer all continue working. Hash routing (`#apps` / `#profile`) unchanged

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| anime.js animations conflict with innerHTML full-re-render pattern | Guard `initScrollAnimations()` with observer cleanup; re-initialize on each render. Follow the pattern already established by `initOnboardingObserver()` |
| Animations feel "flashy marketing" per PRODUCT.md anti-reference | Keep animations to simple opacity + translateY reveals. No parallax, no scroll hijacking, no physics. Purposeful, not decorative |
| anime.js bundle size (~17KB) on slow connections | Acceptable for a one-time cost. Tree-shake unused features. Consider dynamic import if needed |
| Content-less showcase sections (apps only have short descriptions) | Each showcase section should add a contextual sentence beyond the `apps.json` description. Keep it factual and tool-focused per brand personality |

## Sources & References

- Current onboarding implementation: `src/onboarding.js`
- Current app library: `src/ui/appsPage.js`
- anime.js documentation: https://animejs.com/documentation/
- PRODUCT.md anti-references (flashy marketing sites warning)
- DESIGN.md motion conventions (ease-out-expo, 0.3s interactive, prefers-reduced-motion)
