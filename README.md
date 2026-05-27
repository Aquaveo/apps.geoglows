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

### Local Supabase (optional)

For local development with a full Supabase stack (auth, database, RLS policies), use the Supabase CLI with Docker:

```bash
# Install the CLI (if not already)
npm install -g supabase

# Start the local Supabase stack (requires Docker)
supabase start
```

This spins up Postgres, Auth, Storage, and the API gateway in Docker containers. On first run it applies all migrations from `supabase/migrations/`. The CLI prints local credentials on startup:

```
API URL:   http://127.0.0.1:54321
anon key:  eyJ...
DB URL:    postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio:    http://127.0.0.1:54323
```

Point your `.env.local` at the local instance:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from supabase start output>
```

Common commands:

```bash
supabase start              # start all services
supabase stop               # stop and keep data
supabase stop --no-backup   # stop and reset data
supabase db reset           # re-run all migrations from scratch
supabase migration new <name>  # create a new migration file
supabase db diff --schema core # generate migration from schema changes
```

Migrations live in `supabase/migrations/` and run in filename order. The `core` schema holds the `profiles` table and RLS policies. See `supabase/config.toml` for the full local configuration.

Studio (local dashboard) is available at `http://127.0.0.1:54323` for inspecting data, testing queries, and managing auth users.

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

Sub-apps are separate Vercel projects that get proxied through the portal using [Vercel rewrites](https://vercel.com/docs/edge-network/rewrites). This makes them appear under `apps.geoglows.org/hydroviewer`, `apps.geoglows.org/grace-groundwater`, etc., even though each app is deployed independently.

### Why rewrites?

All apps share the same origin (`apps.geoglows.org`), which means:
- **SSO works automatically.** Supabase Auth stores its session token in `localStorage` scoped to the origin. Since the portal and all sub-apps share the same origin, a user who signs in on the portal is already signed in on every sub-app.
- **No CORS issues.** API calls from sub-apps to Supabase go through the same origin.
- **Clean URLs.** Users see `apps.geoglows.org/hydroviewer` instead of `rfs-v2-hydroviewer.vercel.app`.

### How it works

Each sub-app needs three rewrite rules in `vercel.json` (bare path, trailing slash, and wildcard for assets/routes):

```json
{
  "rewrites": [
    { "source": "/hydroviewer", "destination": "https://rfs-v2-hydroviewer.vercel.app/" },
    { "source": "/hydroviewer/", "destination": "https://rfs-v2-hydroviewer.vercel.app/" },
    { "source": "/hydroviewer/:path+", "destination": "https://rfs-v2-hydroviewer.vercel.app/:path+" }
  ]
}
```

The sub-app's Vite config must set `base` to the portal path so asset URLs resolve correctly. For example, the GRACE app sets `VITE_BASE_PATH=/grace-groundwater/` on Vercel Production, which makes its built assets load from `/grace-groundwater/assets/...` instead of `/assets/...`.

### Adding a new sub-app

1. Deploy the sub-app as its own Vercel project (it gets a `.vercel.app` URL)
2. Add three rewrite rules to `vercel.json` in this repo
3. Add the app entry to `apps.json` (name, description, path, icon, tags)
4. Set `VITE_BASE_PATH=/<portal-path>/` on the sub-app's Vercel Production environment
5. Push both repos; the portal redeploy picks up the new rewrites

### Current sub-apps

| App | Portal path | Vercel project | Repo |
|-----|-------------|----------------|------|
| Hydroviewer RFS v2 | `/hydroviewer` | rfs-v2-hydroviewer | rfs-v2-hydroviewer |
| GRACE Groundwater | `/grace-groundwater` | grace-groundwater-dashboard | grace-groundwater-dashboard |
| Aquifer Analyst | `/aquifer-analyst` | aquiferx | aquiferx |

## Deployment

Push to `main` triggers Vercel production deployment automatically. Preview deploys are created for pull request branches.

Environment variables must be set per-environment on Vercel (Production + Preview + Development). Setting only Production silently breaks preview deploys.

## AI-assisted development

This project uses [Claude Code](https://claude.ai/claude-code) for development. AI configuration files are organized under dotfiles to keep the project root clean.

```
.claude/
  CLAUDE.md              Project instructions (loaded automatically each session)
  commands/              Slash commands (e.g. /screenshots)
.agents/
  context/
    PRODUCT.md           Product context, users, brand, design principles
    DESIGN.md            Design system tokens, typography, color, components
```

### Slash commands

| Command | Description |
|---------|-------------|
| `/screenshots` | Run cross-browser Playwright screenshot matrix (local build) |
| `/screenshots live` | Same matrix against production |

### Plugins used

| Plugin | Purpose |
|--------|---------|
| [compound-engineering](https://github.com/nicholasgriffintn/compound-engineering) | `/ce:plan`, `/ce:debug`, `/ce:compound` for planning, debugging, and documenting solutions |
| [impeccable](https://github.com/claudeai/impeccable) | `/impeccable polish`, `/impeccable critique` for design review and UI polish |

### Documented knowledge

Past solutions are captured in `docs/solutions/` with YAML frontmatter for searchability. Grep here before reinventing a pattern that was already solved:

```bash
grep -r "tags:.*safari" docs/solutions/
grep -r "module:.*apps.geoglows" docs/solutions/
```

Engineering plans live in `docs/plans/`. Sub-app design proposals are in `docs/designs/`.

## License

See [geoglows.org](https://www.geoglows.org) for terms.
