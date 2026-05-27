# GEOGLOWS Portal

The app library and landing page for the [GEOGLOWS](https://www.geoglows.org) initiative. Connects researchers and water professionals to open-access tools for river forecasting, groundwater monitoring, and water intelligence.

**Production:** [apps.geoglows.org](https://apps.geoglows.org)

## Stack

- Vanilla JS, Vite 6, Tailwind CSS v4
- Supabase Auth (via [@aquaveo/geoglows-auth](https://www.npmjs.com/package/@aquaveo/geoglows-auth))
- anime.js v4 (scroll animations)
- Vercel (hosting, sub-app rewrites)

## Setup

### Prerequisites

- Node.js 18+
- npm 9+
- A Supabase project with Auth enabled (shared across portal + sub-apps)

### Install

```bash
git clone git@github.com:Aquaveo/apps.geoglows.git
cd apps.geoglows
npm install
```

### Environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL (Settings > API) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |

### Run

```bash
npm run dev          # dev server at localhost:5173
npm run build        # production build to dist/
npm run preview      # serve production build locally
npm test             # vitest under jsdom
```

### Cross-browser screenshots

Requires Docker. Tests Chrome, Safari (WebKit), and Firefox across phone, tablet, and desktop viewports using Playwright.

```bash
npm run build
npm run screenshots           # test local build
npm run screenshots:live      # test production (apps.geoglows.org)
```

Screenshots are saved to `/tmp/pw-screenshots/`.

## Project structure

```
src/
  main.js              App entry, state, routing, render
  ui/
    landingPage.js      Scroll-driven landing page + app grid
    profilePage.js      User profile (view/edit)
    footer.js           Footer
  auth.js               Supabase Auth adapter
  events.js             DOM event handlers
  recentApps.js         localStorage recent app tracking
  disclaimer.js         First-visit disclaimer modal
  style.css             Tailwind theme, animations, components
public/
  showcase/             Hero and app screenshot images
scripts/
  playwright-screenshots.js   Cross-browser test matrix
docs/
  plans/                Engineering plans
  solutions/            Documented learnings (bugs, patterns)
  designs/              Sub-app design proposals
```

## Sub-app integration

Sub-apps are proxied through Vercel rewrites so they share the portal's origin (enabling SSO via shared Supabase cookies). Each app needs three rewrite rules in `vercel.json` and an entry in `apps.json`.

| App | Portal path | Repo |
|-----|-------------|------|
| Hydroviewer RFS v2 | `/hydroviewer` | rfs-v2-hydroviewer |
| GRACE Groundwater | `/grace-groundwater` | grace-groundwater-dashboard |
| Aquifer Analyst | `/aquifer-analyst` | aquiferx |

## Deployment

Push to `main` triggers Vercel production deployment automatically. Preview deploys are created for pull request branches.

Environment variables must be set per-environment on Vercel (Production + Preview + Development). Setting only Production silently breaks preview deploys.

## License

See [geoglows.org](https://www.geoglows.org) for terms.
