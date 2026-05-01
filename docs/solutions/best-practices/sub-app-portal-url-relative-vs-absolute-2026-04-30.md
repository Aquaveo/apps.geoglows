---
title: Sub-app navigation back to the portal — relative URLs work for proxied sub-apps, absolute URLs needed for direct-Vercel-URL sub-apps
date: 2026-04-30
problem_type: best-practice
module: portals
tags:
  - portal
  - vercel
  - cross-origin
  - navigation
  - auth
  - sso
---

# Sub-app navigation back to the portal

## Context

GEOGloWS portal sub-apps need two kinds of cross-app navigation:

1. **Profile link** in the avatar dropdown — should land on the portal's profile page (`apps.geoglows#profile`), not stay on the sub-app.
2. **Back-to-portal** affordance — explicit "go home to the portal" link in the sub-app navbar.

These look like the same problem (linking from sub-app A to portal), but the right URL shape depends on **how the sub-app is reached**, not which kind of navigation it is.

## Guidance

There are two access patterns in the GEOGloWS portal ecosystem, and each requires a different URL shape:

### Proxied sub-apps (grace, rfs)

Reached via `apps.geoglows`'s `vercel.json` rewrites — e.g. `portal-dev.geoglows.org/grace-groundwater/` proxies to `grace-groundwater-dashboard.vercel.app`. The browser sees `window.location.origin === "portal-dev.geoglows.org"` — same origin as the portal.

**Use root-relative URLs:**
- Profile link: `profileHref: "/#profile"` (root-relative path with hash — navigates to `portal-dev.geoglows.org/`, then the portal's hash router handles `#profile`)
- Back-to-portal: `<a href="/">` (root-relative path)

**Why not bare `#profile`?** A bare hash href like `<a href="#profile">` is a *same-document hash change* — the browser appends the hash to the current URL but does NOT navigate. From inside grace at `/grace-groundwater/`, clicking `<a href="#profile">` produces `portal-dev.geoglows.org/grace-groundwater/#profile`, which has no `#profile` handler in grace. The navigation silently fails. Adding the leading `/` makes it a path navigation followed by a hash, which DOES navigate to the portal root.

### Direct-Vercel-URL sub-apps (aquiferx)

Reached via `aquiferx-bay.vercel.app` directly (intentionally — aquiferx is a React app where path routing isn't set up under the proxy). Different origin from the portal.

**Use absolute URLs via env var:**
```ts
const PORTAL_URL =
  (import.meta.env.VITE_PORTAL_URL as string | undefined) ??
  'https://portal-dev.geoglows.org';
```
- Profile link: `profileHref={`${PORTAL_URL}/#profile`}`
- Back-to-portal: `<a href={PORTAL_URL}>`

The env var (with sane fallback default) lets Vercel preview branches retarget the portal without code changes. Set `VITE_PORTAL_URL` per Vercel environment (Production + Preview + Development) — same value for now since there's only one portal env, but the surface is in place for a production portal cutover.

## Why this matters

- **Cross-app SSO depends on shared origin OR shared Supabase project.** Proxied sub-apps share both. Direct-Vercel-URL sub-apps share only the Supabase project — auth tokens persist via Supabase's per-URL `localStorage`, but they aren't readable across origins. The direct-Vercel-URL access path is intentionally degraded for SSO; users may need to sign in again on the portal after navigating from aquiferx. Don't promise seamless cross-origin SSO.
- **The lib's `profileHref` default is `#profile`** because that's what apps.geoglows needs (apps.geoglows handles its own hash routing). Sub-apps must explicitly override — there is no "smart default" the lib can use.
- **Hardcoding portal URL in sub-app source breaks env-flexibility.** When a production portal lands at `portal.geoglows.org`, every hardcoded `portal-dev.geoglows.org` becomes a code change + redeploy. Env var with a default avoids this.

## When to apply

- Adding a new sub-app to the portal — pick proxied (vercel.json rewrites + relative URLs) or direct-Vercel-URL (env var + absolute URLs) up front.
- Adding any cross-app navigation to an existing sub-app (settings link, notifications link, etc.) — same rule: relative for proxied, env-var-absolute for direct.
- Reviewing a sub-app PR that hardcodes `https://portal-dev.geoglows.org` — flag for env-var promotion.

## Examples

### grace (proxied, root-relative)

```js
// grace-groundwater-dashboard/src/auth-bootstrap.js
el.innerHTML = renderAuthAction(authState, { profileHref: "/#profile" });
```

```html
<!-- grace-groundwater-dashboard/index.html -->
<a class="back-to-portal" href="/" aria-label="GEOGloWS Portal">
  <svg ...><path d="M12 22a7 7 0 0 0 7-7..."/></svg>
  <span>GEOGLOWS Portal</span>
</a>
```

### aquiferx (direct Vercel URL, env var)

```tsx
// aquiferx/App.tsx
const PORTAL_URL =
  (import.meta.env.VITE_PORTAL_URL as string | undefined) ??
  'https://portal-dev.geoglows.org';

<UserMenu profileHref={`${PORTAL_URL}/#profile`} />

<a href={PORTAL_URL}>
  <Droplet size={14} />
  <span>GEOGLOWS Portal</span>
</a>
```

```env
# aquiferx/.env.example
# VITE_PORTAL_URL=https://portal-dev.geoglows.org
```

## Related

- Lib 1.4.0 introduced configurable `profileHref` for `renderAuthAction` and `<UserMenu>` — see `geoglows-auth/CHANGELOG.md`.
- Plan: `apps.geoglows/docs/plans/2026-04-30-004-feat-profile-routing-back-to-portal-plan.md`.
- Related learning: standalone Vercel URLs for sub-apps with `VITE_BASE_PATH` are intentionally broken (white-page) — direct access only works for sub-apps without a base-path constraint, like aquiferx.
