# Changelog

All notable changes to the GEOGLOWS Portal (apps.geoglows) are documented here.

## 2026-05-27

### Added
- Developer setup README with local Supabase, cross-browser screenshots, and sub-app integration guide
- Playwright cross-browser screenshot tooling (Chrome, Safari, Firefox x phone, tablet, desktop)
- `/screenshots` slash command for running the test matrix

### Changed
- Consolidated AI config files: CLAUDE.md to `.claude/`, PRODUCT.md and DESIGN.md to `.agents/context/`
- Cleaned project root of non-source markdown files

## 2026-05-26

### Added
- River network hero image replacing the satellite photo
- App cards moved above the fold (immediately after hero)
- `#home` route: logo links to landing page for all users
- `#library` route: bookmarkable URL for the apps grid
- Recent Apps section on the apps grid (localStorage-based tracking)
- Library and Profile nav links in compact header for authenticated users
- Build target `safari14` for broader browser compatibility

### Fixed
- Safari blank page: WebKit computed 0 height for `<dialog>` with `overflow-hidden` + flex children. Fixed with explicit `height: min(90vh, 720px)` and `margin: auto` centering
- Safari invisible content: scroll-reveal elements used CSS `opacity: 0` that stayed invisible if anime.js failed. Added `anim-ready` class pattern so content is visible by default
- Profile completion banner flashing during auth bootstrap (showed when `account` was still null)
- Sign-out now redirects to `#home` immediately instead of briefly showing the previous page
- Hash links use root-relative paths (`/#home`) to prevent sub-app path concatenation

### Removed
- "App Library" nav link (redundant with the scroll landing page)
- "Funded By" and "A Collection of Work From" footer sections (commented out)
- Standalone GRACE editorial image section
- HydroSOS global image from the landing page

## 2026-05-23 to 2026-05-24

### Added
- Scroll-driven landing page with anime.js v4 replacing the dismissible onboarding
- Playfair Display + Inter typography pairing ("The Field Station" design system)
- Satellite hero image with gradient overlay and mission text
- Editorial overlapping image composition with 3D CSS perspective transforms
- Manifesto typography moment ("Don't just monitor water. Understand it.")
- Ambient coordinate ticker ribbon (CSS scroll animation)
- Per-app showcase sections with real tool screenshots
- Coming Soon section for Aquifer Analyst
- `prefers-reduced-motion` compliance for all animations
- Design remake proposals for Hydroviewer and GRACE sub-apps (`docs/designs/`)
- DESIGN.md with "The Field Station" creative north star
- PRODUCT.md with product context, users, and design principles

### Changed
- Authenticated users go directly to the compact app grid (no scroll experience)
- Hero heading uses dark slate instead of blue (Quiet Chrome Rule)
- Profile page headings use Playfair Display
- geoglows-auth bumped to 1.6.0 (Playfair Display title in sign-in modal, dark theme compat)

### Removed
- Dismissible onboarding (`src/onboarding.js`)
- Static app library page (`src/ui/appsPage.js`)
- SVG favicon (replaced with PNG)

## 2026-04-30

### Added
- First-visit disclaimer modal with "I understand" acknowledgment
- Version-gated re-acknowledgment (bump `DISCLAIMER_VERSION` to re-prompt all users)
- GRACE Groundwater dashboard integration (`/grace-groundwater` rewrite)
- Hydroviewer RFS v2 integration (`/hydroviewer` rewrite)
- Vanilla sign-in modal from geoglows-auth (replaces redirect-based sign-in)
- Profile page (view/edit) replacing the workspace page
- Password recovery flow with recovery URL detection
- Cross-tab disclaimer sync via `storage` event

### Fixed
- Dialog centering under Tailwind preflight (explicit positioning)
- Dialog double scrollbar (flex-1 min-h-0 pattern)
- Cross-tab PASSWORD_RECOVERY modal firing (gated on this-tab snapshot)
- Recovery URL race condition (inline `<script>` captures URL before module load)

## 2026-04-29

### Added
- Rich user profiles: first/last/middle name, phone, address, user type, personal link
- Profiles relocated to `core` schema for multi-app access
- HTML escape discipline for all innerHTML template interpolation
- Vitest test infrastructure with jsdom 26 patches

### Changed
- Auth migration from AWS Cognito to Supabase Auth
- Profile-of-record moved from `user_metadata` to `core.profiles` table

### Removed
- Organizations and org_memberships tables
- Cognito OIDC adapter (still shipped in geoglows-auth but unused)

## 2026-03 to 2026-04-28

### Added
- Initial portal SPA (Vite 6, Tailwind CSS v4, vanilla JS)
- App catalog with card grid
- Vercel deployment with sub-app rewrites
- Supabase integration for data layer
- Vercel Analytics and Speed Insights
