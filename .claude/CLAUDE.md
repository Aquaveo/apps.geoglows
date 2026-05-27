# apps.geoglows

## Project Overview
- Vanilla JS + Vite 6 + Tailwind CSS v4 portal for the GEOGLOWS initiative
- Single-page app with hash routing: scroll-driven landing page (`#home`), app library grid (`#library`), user profile (`#profile`)
- Authenticates against Supabase Auth via `@aquaveo/geoglows-auth/core` (no React in this app — it consumes the lib's vanilla `core` surface, not `react`)
- Hosted on Vercel (production at `apps.geoglows.org` + preview deploys per branch)
- **Hosts the portal**: portal sub-apps are catalogued in `apps.json` (user-facing card metadata) and proxied via `vercel.json` rewrites (three rules per app: bare path, trailing slash, `:path+` wildcard). Currently integrated: `aquifer-analyst` → aquiferx, `grace-groundwater` → grace-groundwater-dashboard, `hydroviewer` → rfs-v2-hydroviewer. Cross-app SSO is automatic via the shared Supabase project + same origin (rewritten paths)

## Architecture
- **State machine**: `src/main.js` owns a single `appState` object; `setState(patch)` re-renders the whole tree by re-assigning `#app.innerHTML`. No virtual DOM, no reconciliation — every re-render rebuilds. Event handlers re-bind on every render via `bindWorkspaceEvents`
- **Hash routing**: `pageFromHash()` maps `#home` → landing page, `#library` → apps grid, `#profile` / `#workspace` (legacy) → profile page. Default (no hash) → apps grid for authenticated users, landing for anonymous
- **Two render modes**: anonymous visitors see the scroll-driven landing page with anime.js animations; authenticated users see a compact header with Library/Profile nav and the apps grid with a "Recent Apps" section
- **Session bootstrap**: `bootstrapSession` from `@aquaveo/geoglows-auth/core` is called from a `supabase.auth.onAuthStateChange("INITIAL_SESSION", ...)` listener — only after Supabase JS has finished `detectSessionInUrl`. A 2s safety-net timeout backstops the listener
- **Profile data flow**: Supabase Auth issues a session → `bootstrapSession` calls `ensureProfile` (lib) → `profiles` row exists → `loadAccountSummary` returns `{ profile }`. Edits go through `updateProfile` (lib) which updates the `profiles` table directly; `display_name` is recomposed from name parts on update
- **HTML escape discipline**: every `${value}` interpolation that could carry user input MUST go through `escapeHtml()` imported from `@aquaveo/geoglows-auth/core`. The portal renders by template-string-then-innerHTML, so every interpolation is an HTML injection point. See `docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md`
- **anime.js re-initialization pattern**: since `innerHTML` replacement destroys all DOM nodes, scroll animations are re-initialized after every render via `initScrollAnimations()` which calls `activeScope.revert()` before creating new animations. Elements use the `anim-ready` CSS class (added by JS) for initial `opacity: 0` — content stays visible if JS fails

## Key Files
- `src/main.js` — app entry, `appState`, `render(state)`, hash routing (`#home` / `#library` / `#profile`), compact vs full header logic, Supabase auth-state listener, sign-out → `#home` redirect, OAuth callback URL cleanup
- `src/ui/landingPage.js` — scroll-driven landing page (`renderLandingPage`), compact app grid (`renderAppsGrid`), "Recent Apps" section, app showcases with anime.js scroll animations (`initScrollAnimations`), app card component with `data-app-id` for click tracking
- `src/ui/profilePage.js` — view + edit modes, persistent completion banner (stays until profile is complete, no dismiss), save success banner with auto-dismiss
- `src/ui/footer.js` — theme-aware GEOGLOWS logo, external links, copyright
- `src/recentApps.js` — localStorage-based recent app tracking (`recordAppVisit`, `getRecentApps`), max 5 entries
- `src/auth.js` — re-exports from the lib's Supabase Auth adapter; dispatches the `geoglows:sign-in-requested` window event the modal listens for
- `src/supabase.js` — single Supabase client constructed at module load from `import.meta.env.VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
- `src/account.js` — wrappers around `loadAccountSummary` / `updateProfile` / `isProfileComplete` from the lib; injects current user
- `src/events.js` — every DOM event handler the portal binds; records app visits on card clicks; binds the lib's namespaced auth IDs `#geoglowsSignIn` / `#geoglowsSignOut`. Re-bound on every render
- `src/disclaimer.js` — first-visit disclaimer modal logic, localStorage persistence, version-gated re-acknowledgment
- `src/style.css` — Tailwind v4 theme overrides (Playfair Display + Inter fonts, slate/blue palette), glass-card component, ticker animation, perspective panel transforms, scroll-reveal with `anim-ready` pattern, `prefers-reduced-motion` compliance
- `supabase/migrations/` — Supabase CLI migrations (forward-only). `profiles` table + RLS policies live here

The vanilla sign-in modal, navbar auth-action slot, and `escapeHtml` helper live in `@aquaveo/geoglows-auth/core` (imported via `mountSignInModal`, `renderAuthAction`, `escapeHtml`). The matching CSS ships at `@aquaveo/geoglows-auth/core/sign-in.css`.

## Conventions
- Vanilla JS only (no TypeScript, no JSX, no React)
- Tailwind utility classes inline; no `@apply` or component CSS in app-owned `src/` — UI components imported from `@aquaveo/geoglows-auth` ship their own plain CSS and are exempt
- Native `<dialog>` for modals. Use `margin: auto` for centering (not `position: fixed` + `transform: translate(-50%)` — WebKit computes 0 height with that approach). Give dialogs explicit height via inline style for Safari compatibility
- Hash links use root-relative paths (`/#home`, `/#library`, `/#profile`) to avoid sub-app path concatenation issues
- Profile-of-record is the `profiles` table. `user_metadata` from Supabase Auth is sign-up-time identity ONLY — never re-flow it into `profiles` on subsequent sign-ins. See `geoglows-auth/docs/solutions/best-practices/user-metadata-is-auth-identity-not-profile-of-record-2026-04-29.md`
- Application-layer required-field enforcement (e.g., first_name/last_name on profile save). DB columns are nullable so legacy/OAuth-skipped rows stay valid
- Build target is `['es2020', 'safari14']` for broad browser compatibility

## Commands
- `npm run dev` — start Vite dev server
- `npm run build` — production build (Vite)
- `npm test` — run vitest suite under jsdom
- `npm run preview` — serve the production build locally
- `npm run screenshots` — cross-browser screenshot matrix via Playwright Docker (Chrome, Safari, Firefox × phone, tablet, desktop). Requires `npm run build` first
- `npm run screenshots:live` — same matrix against production `apps.geoglows.org`

## Tests
- vitest 3 + jsdom 26
- `tests/setup.js` stubs `import.meta.env.VITE_*` so module-load-time singletons don't throw at test import; see `docs/solutions/developer-experience/vitest-setupfiles-for-vite-env-singletons-2026-04-29.md`
- jsdom 26 ships `HTMLDialogElement` without `showModal`/`close`; `tests/setup.js` patches the prototype. See `docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md`
- jsdom 26 also ships `localStorage` / `sessionStorage` as empty plain objects with no Storage methods; `tests/setup.js` polyfills them. See `docs/solutions/developer-experience/jsdom-26-localstorage-polyfill-2026-04-30.md`
- Test files live in `tests/` (mirrors `src/`); pattern `tests/**/*.test.js`
- Cross-browser visual testing via Playwright Docker: `scripts/playwright-screenshots.js` tests 9 browser/device combinations. Run with `npm run screenshots`

## Environment
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — required, point at the shared GEOGloWS Supabase project
- Vercel: vars must be set per-environment (Production + Preview + Development). Setting only Production silently breaks preview deploys

## Documentation
- `docs/plans/` — engineering plans (`YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.md`). Living documents with progress checkboxes; see existing plans for format
- `docs/solutions/` — captured learnings from past problems (bugs, best practices, workflow patterns), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas — grep here before reinventing
- `docs/designs/` — design remake proposals for sub-apps (Hydroviewer, GRACE)
- `.agents/context/DESIGN.md` — design system tokens, components, and conventions ("The Field Station" north star)
- `.agents/context/PRODUCT.md` — product context, users, brand personality, design principles

## Disclaimer
- Informative first-visit disclaimer modal (terms-of-use style) in `src/disclaimer.js`. Single "I understand" acknowledgment button — no rejection path. Acceptance is persisted in `localStorage` under the `geoglows-disclaimer-acceptance` key as `{ version, status: 'accepted', timestamp }`
- **To bump the disclaimer text**: edit `DISCLAIMER_TEXT` AND increment `DISCLAIMER_VERSION` (date string like `"2026-04-30"`) in `src/disclaimer.js`. Bumping the version forces all existing users to re-acknowledge. Comparison is strict equality — older or newer versions both re-prompt
- **The template MUST NOT contain `${...}` interpolation of dynamic values.** `DISCLAIMER_TEXT` is a static constant; future dynamic content must use `escapeHtml(...)` per the discipline at `docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md`
- **Dialog centering**: uses `margin: auto` + explicit `height: min(90vh, 720px)` inline style. This is required for Safari/WebKit compatibility — WebKit computes 0 intrinsic height for dialogs with `overflow-hidden` + flex children
- **Escape closes the modal without writing to localStorage** — user re-prompts on next visit. Native `<dialog>` semantics; not a "decline" mechanism
- **Recovery flow is NOT gated by the disclaimer.** Password-recovery and OAuth callbacks proceed normally; the disclaimer modal opens AFTER the recovery modal closes (or on next normal visit)
- **Sub-apps (grace, rfs, aquiferx) do NOT enforce the disclaimer.** Bookmarks to sub-apps bypass the gate entirely. This is acceptable for the "best-effort acknowledgment notice" framing
- **Rejection / decline path is deferred** to a future plan along with audit trail, entity attribution, and per-account enforcement. The current mechanism is informational acknowledgment, not technical enforcement; localStorage is dev-tools-bypassable
- Plan: `docs/plans/2026-04-30-006-feat-disclaimer-acceptance-modal-plan.md`
