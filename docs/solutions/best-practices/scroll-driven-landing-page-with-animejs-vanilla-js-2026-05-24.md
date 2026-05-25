---
title: "Scroll-driven landing page with anime.js in a vanilla JS innerHTML app"
module: apps.geoglows
date: 2026-05-24
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when: "Building scroll-driven animations in a vanilla JS SPA that re-renders via innerHTML on every state change"
tags:
  - anime-js
  - scroll-animation
  - vanilla-js
  - innerhtml
  - landing-page
  - design-system
  - responsive
---

# Scroll-driven landing page with anime.js in a vanilla JS innerHTML app

## Context

The GEOGLOWS portal needed a permanent scroll-driven landing page replacing a dismissible onboarding experience. The app architecture uses `innerHTML` template-string rendering with full DOM replacement on every `setState()` call. This creates a fundamental tension with animation libraries that depend on DOM node persistence.

The design goals included: anime.js v4 scroll-linked animations, bidirectional enter/leave behavior, editorial overlapping image compositions with 3D CSS perspective, an ambient coordinate ticker, and a manifesto typography moment. All while maintaining `prefers-reduced-motion` compliance and mobile responsiveness.

## Guidance

### anime.js v4 in innerHTML apps: the re-initialization pattern

anime.js v4 has a built-in `onScroll()` API that replaces the need for IntersectionObserver. Use `autoplay: false` on animations and control them via `onScroll` callbacks.

The critical pattern: since `innerHTML` replacement destroys all DOM nodes, animations must be re-initialized after every render. Track active animations at module scope and call `.revert()` before creating new ones.

```javascript
import { animate, onScroll, stagger, createScope } from "animejs";

let activeScope = null;

export function initScrollAnimations() {
  if (activeScope) {
    activeScope.revert();
    activeScope = null;
  }

  activeScope = createScope({
    mediaQueries: { reduceMotion: "(prefers-reduced-motion: reduce)" },
  }).add((self) => {
    if (self.matches.reduceMotion) {
      for (const el of document.querySelectorAll(".scroll-reveal")) {
        el.style.opacity = "1";
        el.style.transform = "none";
      }
      return;
    }
    // Set up animations per section...
  });
}
```

Call `initScrollAnimations()` in the post-render hook (after `innerHTML` assignment + event binding).

### Bidirectional scroll animation

For animations that reverse when scrolling backward, use `onScroll` callbacks instead of `sync` mode. Sync mode has edge-case issues at the top and bottom of the page (first/last sections may not complete).

```javascript
function animateReveal(el, section) {
  const anims = buildAnimations(el);
  let revealed = false;

  onScroll({
    target: section,
    enter: "bottom top",
    leave: "top bottom",
    onEnter: () => {
      if (!revealed) {
        revealed = true;
        for (const a of anims) a.restart();
      }
    },
    onLeave: () => {
      if (revealed) {
        revealed = false;
        for (const a of anims) { a.reverse(); a.restart(); }
      }
    },
  });
}
```

### Cascade animations must return ALL animation handles

When animating both a container and its children (cascade pattern), return all animation instances so the scroll callbacks can control both. A common bug: creating the children animation but discarding its reference.

```javascript
// Wrong: children animation created but never controlled
if (anim === "cascade") {
  animate(children, { opacity: [0, 1], ... }); // lost!
  return animate(el, { opacity: [0, 1], ... });
}

// Correct: return both
if (anim === "cascade") {
  const anims = [];
  anims.push(animate(children, { opacity: [0, 1], ... }));
  anims.push(animate(el, { opacity: [0, 1], ... }));
  return anims;
}
```

### CSS initial state for scroll-reveal elements

Set `opacity: 0` in CSS so elements are hidden before JS runs. For cascade children, also hide them in CSS:

```css
.scroll-reveal { opacity: 0; }
.scroll-reveal[data-anim="cascade"] > * { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .scroll-reveal,
  .scroll-reveal[data-anim="cascade"] > * {
    opacity: 1;
    transform: none;
  }
}
```

### 3D perspective transforms: desktop only

CSS perspective transforms (`rotateY`) on editorial image panels look odd on mobile and should be scoped to desktop via media queries, not inline `md:` classes on the transform itself:

```css
@media (min-width: 768px) {
  .perspective-panel-left { transform: perspective(1200px) rotateY(3deg); }
  .perspective-panel-right { transform: perspective(1200px) rotateY(-3deg); }
  .perspective-panel:hover { transform: perspective(1200px) rotateY(0deg); }
}
```

### Mobile responsive patterns for scroll pages

Key mobile adaptations discovered during this implementation:

1. **Header nav**: Use `md:absolute` for desktop positioning; let nav flow normally on mobile to avoid logo overlap
2. **Editorial overlapping images**: Stack vertically on mobile (no negative margins, no overlap)
3. **Showcase sections**: Remove forced `min-h-[80vh]` on mobile; let content flow naturally
4. **Wide panoramic screenshots**: Wrap in `aspect-[4/3]` containers with `object-cover` on mobile so they render as visually substantial blocks instead of thin strips
5. **Text alignment**: Force left-aligned on mobile regardless of alternating desktop layout

### Authenticated vs anonymous routing

For portals with auth, skip the scroll experience for signed-in users:

```javascript
${isApps ? (state.user ? renderAppsGrid() : renderLandingPage()) : renderProfilePage(state)}
```

Only initialize scroll animations for anonymous visitors:
```javascript
if (appState.currentPage !== "profile" && !appState.user) initScrollAnimations();
```

## Why This Matters

The `innerHTML` re-render pattern is common in lightweight vanilla JS SPAs but creates specific challenges for animation libraries that assume DOM persistence. Without the re-initialization pattern, animations silently break after any state change (auth bootstrap, theme toggle, navigation). Without returning all animation handles, cascade children stay invisible. Without the CSS initial state, elements flash before JS runs.

These patterns are not documented in anime.js v4's own docs because they assume persistent DOM. This learning captures the integration pattern specific to template-string innerHTML architectures.

## When to Apply

- Building scroll-driven animations in any vanilla JS app that uses innerHTML for rendering
- Integrating anime.js v4 into an app without a virtual DOM (no React, Vue, Svelte)
- Any animation library (GSAP, anime.js, Motion One) in an innerHTML re-render architecture
- Designing responsive scroll experiences that need to degrade gracefully on mobile

## Examples

The full implementation lives in `src/ui/landingPage.js` with supporting CSS in `src/style.css`. The design system is documented in `DESIGN.md` under the "The Field Station" creative north star.
