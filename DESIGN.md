---
name: GEOGLOWS Portal
description: Open-access water intelligence tools for researchers and decision-makers worldwide.
colors:
  primary: "#2563eb"
  primary-hover: "#1d4ed8"
  primary-light: "#eff6ff"
  canvas-light: "#f8fafc"
  canvas-dark: "#0f172a"
  surface-light: "#ffffff"
  ticker-bg: "#1e293b"
  text-primary-light: "#1e293b"
  text-secondary-light: "#475569"
  text-muted-light: "#94a3b8"
  border-light: "#e2e8f0"
  coming-soon-bg: "#fef3c7"
  coming-soon-text: "#a16207"
  manifesto-accent: "#2563eb"
typography:
  display:
    fontFamily: "'Playfair Display', Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.1
  heading:
    fontFamily: "'Playfair Display', Georgia, serif"
    fontSize: "clamp(1.875rem, 3vw, 2.25rem)"
    fontWeight: 400
    lineHeight: 1.2
  manifesto:
    fontFamily: "'Playfair Display', Georgia, serif"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.15
  body:
    fontFamily: "'Inter', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Inter', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.1em"
  ticker:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    letterSpacing: "0.05em"
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
  section: "5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  glass-card:
    backgroundColor: "{colors.surface-light}"
    rounded: "{rounded.lg}"
    padding: "1.5rem 2rem"
---

# Design System: GEOGLOWS Portal

## 1. Overview

**Creative North Star: "The Field Station"**

A clean, well-organized workspace where researchers come to access instruments. The tools and data are the value; the interface is the workbench. Every design choice reduces the distance between the user and their work.

The portal serves two modes: anonymous visitors see a scroll-driven landing page with satellite imagery, tool showcases, and scroll-linked animations that present each application with editorial depth. Authenticated users skip directly to a compact app library grid. The transition is seamless; the portal adapts to who you are without asking.

The visual language is restrained: blue-tinted slate neutrals, one saturated blue accent reserved for interactive elements, and real tool output (maps, charts, satellite photography) providing all the color richness the page needs. The portal frame stays quiet so the data speaks.

This system explicitly rejects generic SaaS dashboards (too corporate), dense academic data portals (too intimidating), and flashy marketing sites (animation-heavy, scroll-hijacking). GEOGLOWS is a public good, not a product being sold.

**Key Characteristics:**
- Tool-first: screenshots of real data output carry the visual weight, not decorative elements
- Scroll-driven storytelling for first-time visitors; direct access for returning users
- Serif display headings (Playfair Display) for editorial authority; Inter body for UI clarity; monospace ticker for ambient credibility
- Blue accent reserved for interactive affordances and the manifesto accent; headings and text use dark neutrals
- Purposeful scroll animations via anime.js with bidirectional enter/leave behavior; respects prefers-reduced-motion
- 3D perspective transforms on editorial image panels for dimensional depth

## 2. Colors: The Workbench Palette

A restrained palette where tinted slate neutrals dominate and the primary blue appears only on actionable elements. The portal's visual richness comes from the tool screenshots and satellite imagery, not from the chrome.

### Primary
- **Workbench Blue** (#2563eb): Buttons, links, focus rings, interactive accent states, and the manifesto accent line. Never on headings or body text (except the manifesto moment). Its restraint is the point.

### Neutral
- **Canvas** (#f8fafc light / #0f172a dark): Page background. Blue-tinted slate, never pure white or pure black.
- **Surface** (#ffffff light / rgba(255,255,255,0.03) dark): Card and panel backgrounds.
- **Ticker** (#1e293b light / #020617 dark): Dark ribbon background for the ambient coordinate ticker.
- **Text Primary** (#1e293b light / #f1f5f9 dark): Headings and body copy.
- **Text Secondary** (#475569 light / #94a3b8 dark): Descriptions, supporting text.
- **Text Muted** (#94a3b8 light / #475569 dark): Labels, captions, metadata, ticker text.
- **Border** (#e2e8f0 light / rgba(255,255,255,0.1) dark): Card edges, separators.

### Named Rules
**The Quiet Chrome Rule.** The portal frame (header, footer, navigation) uses only neutrals and the primary blue on interactive elements. Headings are dark slate, not blue. The tool screenshots and satellite imagery provide all the color the page needs. The single exception is the manifesto moment, where blue carries emotional emphasis.

## 3. Typography

**Display Font:** Playfair Display (with Georgia, serif fallback)
**Body Font:** Inter (with system sans-serif fallback)
**Ticker Font:** System monospace (ui-monospace, SFMono-Regular)

**Character:** High-contrast serif headings create editorial authority and institutional credibility. Inter body text stays invisible, letting the content and data carry the reader. Monospace in the ambient ticker creates a "mission control" atmosphere. The pairing says "scientific journal" more than "SaaS product."

### Hierarchy
- **Display** (400, clamp(2rem, 5vw, 4.5rem), line-height 1.1): Hero heading "Global Water Intelligence." Playfair Display at normal weight; the high-contrast letterforms provide enough visual weight without bold.
- **Manifesto** (400, text-3xl md:text-5xl, line-height 1.15): The typographic statement "Don't just monitor water. Understand it." Playfair Display. Second line uses Workbench Blue for color-split emphasis.
- **Heading** (400, clamp(1.875rem, 3vw, 2.25rem), line-height 1.2): Section and app names in showcases, "Get started," profile page titles. Playfair Display.
- **Body** (400-500, 1rem, line-height 1.6): Descriptions, paragraphs. Inter. Max line length capped at max-w-3xl (65ch).
- **Label** (700, 0.75rem, tracking 0.1em, uppercase): Section eyebrows ("Surface Water," "Coming soon"), feature captions. Inter bold uppercase with wide tracking.
- **Ticker** (400, 0.75rem, tracking 0.05em): Scrolling coordinate ribbon. System monospace. Slate-400 on slate-800 background.

### Named Rules
**The Two-Voice Rule.** Playfair Display speaks in headings and the manifesto (h1, h2, h3, card titles, modal titles, manifesto lines). Inter handles everything else. The monospace ticker is a third voice used exclusively for ambient data decoration; it never appears in content.

## 4. Elevation

Flat by default. Shadows appear as a response to state (hover, modal elevation), never as resting decoration. Dark mode uses borders instead of shadows for layering. 3D perspective transforms add dimensional depth to editorial image compositions.

### Shadow Vocabulary
- **Resting card** (`0 4px 6px -1px rgba(0,0,0,0.05)`): Subtle depth on glass-card elements at rest. Light mode only.
- **Hover card** (`0 20px 25px -5px rgba(59,130,246,0.1)`): Blue-tinted glow on card hover. Signals interactivity.
- **Modal** (`0 25px 50px -12px rgba(0,0,0,0.25)`): High elevation for dialogs and the sign-in modal.
- **Editorial overlap** (`shadow-xl`): Used on the GRACE map image when overlapping the HydroSOS map. Creates depth in the layered editorial composition.

### Perspective Panels
Editorial image panels use CSS 3D perspective transforms (`perspective(1200px) rotateY(±3deg)`) to create dimensional depth. The HydroSOS map tilts slightly right; the GRACE map tilts slightly left. Hover flattens to 0deg with a 0.5s ease-out-expo transition. Disabled under prefers-reduced-motion.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, focus, modal elevation) or in editorial compositions where images overlap intentionally. Perspective transforms are reserved for the editorial image bridge, never on UI components.

## 5. Components

### Ambient Ticker
A full-width dark ribbon (`bg-slate-800`) scrolling continuously with global river station coordinates (Zurich, São Paulo, Tokyo, Cairo) interspersed with data stats ("7M+ RIVER REACHES", "DAILY FORECASTS"). Monospace font, slate-400 text. CSS `translateX` animation at 30s linear infinite. Creates a "mission control" atmosphere. Hidden from screen readers (`aria-hidden="true"`). Disabled under prefers-reduced-motion.

### Header
Top-center layout. GEOGLOWS droplet icon + wordmark centered; nav links ("App Library") and auth action positioned absolute top-right. Full-width with backdrop blur (bg-white/80 light, bg-slate-950/80 dark). Bottom border separator. Padding: py-12 mobile, py-20 desktop.

### Hero Bridge (anonymous visitors only)
Satellite photograph (aerial braided river delta) spanning full content width at 60vh mobile / 80vh desktop. Dark gradient overlay (bottom-to-top, from-slate-900/80) carries the GEOGLOWS mission tagline in Playfair Display and supporting stats in Inter. Scales in on scroll via anime.js. Rounded-2xl container.

Below: two editorial images (HydroSOS global map + GRACE groundwater map) in an overlapping composition with 3D perspective transforms. HydroSOS at 82% width slides from left with 3deg rightward tilt; GRACE at 55% width overlaps its bottom-right and slides from right with 3deg leftward tilt. Both in 16:9 aspect-ratio containers with object-cover. Labels below each image in muted uppercase.

### Manifesto Moment
A centered typographic statement between the editorial images and the app showcases. Two lines in Playfair Display at text-3xl/text-5xl: first line in dark slate, second line in Workbench Blue. Scales in on scroll. The color split creates a punchy moment that breaks the neutral pattern deliberately. Generous vertical padding (py-16 md:py-24).

### App Showcases
Alternating layout: images left / text right, then reversed. Each showcase is a scroll section (min-h-80vh) with anime.js directional slide animations matching the layout direction. Images slide from the image side; text slides from the opposite side. Bidirectional: animations reverse when scrolling back up.

Text block: icon + category label, Playfair Display heading, Inter description, blue "Open [App]" link.

### Coming Soon Section
Same alternating showcase layout. Amber "Coming soon" pill (bg-amber-100, text-amber-700) replaces the icon + category label. No link (app not yet available).

### App Cards (Get Started section / authenticated view)
Glass-card style in a 2-column responsive grid. Each card: icon container (blue-50 bg, rounded-xl), Playfair Display title, Inter description, plain-text tags at bottom. Hover: arrow-up-right icon reveals, border tints blue, blue-tinted box-shadow appears. Cascade animation with stagger on scroll.

### Buttons
- **Primary:** Workbench Blue (#2563eb) background, white text, rounded-xl (0.75rem), px-4 py-2, Inter semibold. Hover: blue-700. Disabled: opacity-60. Focus-visible: 2px blue ring with offset.
- **Secondary:** White background (dark: slate-900), slate-700 text, slate-300 border, rounded-xl. Hover: slate-50 background.
- **Minimum touch target:** 44px height on all interactive buttons (min-h-[44px]).

### Modals
Native `<dialog>` element. Fixed center positioning with explicit translate (UA centering unreliable under Tailwind preflight). Max-w-2xl (sign-in: max-w-28rem), max-h-90vh. Rounded-2xl. Backdrop: slate-900/60 with backdrop-blur-sm. Playfair Display title.

### Footer
Theme-aware GEOGLOWS logo (color for light, white for dark) at w-72. Tagline, pill-style external links (geoglows.org, Training). Contributors and sponsors as plain text. Copyright line with top border separator. Spacing: mt-16 pt-10 pb-8.

### Profile Page
Save success banner: emerald-50 background with emerald-700 text, auto-dismisses after 3 seconds. Completion banner: amber accent matching the Coming Soon treatment. View mode: Playfair Display name heading, 2-column field grid. Edit mode: labeled inputs with placeholder hints (phone, address), Inter semibold field labels in uppercase.

### Disclaimer Modal
"Before you begin" heading in Playfair Display. GEOGLOWS branding (droplet + wordmark). Four grouped legal sections with h3 subheadings. Custom scrollbar styling. Branded shell (water-mesh gradient at 30% opacity) visible behind the modal.

## 6. Do's and Don'ts

### Do:
- **Do** use Playfair Display for headings and the manifesto moment. Inter for body and UI. Monospace for the ticker only.
- **Do** reserve blue-600 for interactive elements (buttons, links, focus rings) and the manifesto accent. Headings use dark slate.
- **Do** use real tool output (screenshots, satellite imagery) as the primary visual content. The data IS the design.
- **Do** use the ambient ticker to create a "mission control" atmosphere with real coordinate data.
- **Do** use 3D perspective transforms on editorial image panels for dimensional depth. Flatten on hover.
- **Do** respect prefers-reduced-motion: disable all anime.js animations, CSS ticker scrolling, and perspective transforms.
- **Do** use focus-visible rings (2px, blue-500) on every interactive element for keyboard accessibility.
- **Do** use native `<dialog>` for modals with explicit Tailwind centering (fixed top-1/2 left-1/2 -translate).
- **Do** use `escapeHtml()` on every user-controlled interpolation in innerHTML templates.
- **Do** provide min-h-[44px] on all buttons and interactive targets for touch accessibility.
- **Do** use `aria-hidden="true"` on decorative elements (ticker, icons) that would confuse screen readers.
- **Do** show a success banner after profile save (auto-dismiss after 3s).

### Don't:
- **Don't** use gradient text (background-clip: text). Use a single solid color; emphasis through weight or size.
- **Don't** use border-left or border-right greater than 1px as colored accents on cards or list items.
- **Don't** use glassmorphism decoratively. Backdrop blur is purposeful (header nav, modal backdrop) or nothing.
- **Don't** use big-number hero-metric templates (SaaS cliché). GEOGLOWS is a public good, not a product being sold.
- **Don't** use animation-heavy scroll-hijacking (controls scroll position or velocity). Animations reveal content on scroll but never take control of the scrollbar.
- **Don't** mimic generic SaaS dashboards (too corporate and transactional for an open science platform).
- **Don't** mimic dense academic data portals (intimidating, buried navigation, walls of controls).
- **Don't** use Inter for headings. It's the default AI-generated-UI font and communicates "template."
- **Don't** animate CSS layout properties. Use transform and opacity only.
- **Don't** use em dashes. Use commas, colons, semicolons, periods, or parentheses.
- **Don't** use perspective transforms on UI components (buttons, cards, inputs). Reserved for editorial image compositions only.
