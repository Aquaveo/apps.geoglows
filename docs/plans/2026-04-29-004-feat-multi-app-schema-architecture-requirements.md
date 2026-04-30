# Multi-App Supabase Schema Architecture — Requirements

- **Date:** 2026-04-29
- **Status:** Brainstorm complete; not yet planned. Revised after two review passes.
- **Owner:** Gerardo Romero (apps.geoglows + geoglows-auth + auth integration)
- **Scope of doc:** WHAT to build. Implementation specifics deferred to a follow-up plan doc.

---

## 1. Background

The portal architecture today ships multiple Vite apps under one origin via Vercel rewrites, with one shared Supabase project and shared Supabase Auth session across apps. New apps are coming online — `rfs-v2-hydroviewer` and `grace-groundwater-dashboard` exist as repos but do not yet write to Supabase. `aquiferx` does not yet write app-specific Supabase tables either.

The Supabase database currently has a single application table: `public.profiles`. Within the next few weeks/months one or more of these apps is expected to begin storing per-user data in Supabase.

This doc establishes the *direction* — one Supabase project, namespace per app — and resolves the **single piece of work that has a current consumer**: relocating `public.profiles` into a shared `core` schema. Per-app schemas, governance scaffolding, and cross-repo infrastructure are deferred until an app actually has a table to land. This is deliberate YAGNI: set the topology, do the one thing that needs doing now, stop.

## 2. Drivers

The brainstorm identified three drivers (organization/clarity, isolation, ownership). v1 only meaningfully serves the first; the others materialize as work when an app needs them.

- **Organization / clarity (primary, served by v1)** — keep the namespace navigable as more apps land; avoid a sprawling `public`.
- **Permissions / data isolation (secondary, soft, not v1 work)** — schema membership is not a confidentiality boundary in this design; only RLS row-predicates are. Hardening for any specific app is a future per-app decision.
- **Ownership / migration boundaries (intended future, not v1 work)** — each repo owning its own migrations is the eventual shape, but no app currently has migrations to own. The pattern materializes when the first per-app schema lands.

## 3. Decisions

### 3.1 Topology direction: one Supabase project, multi-schema

Future shape:

```
auth                  Supabase-managed (untouched)
core                  Shared across all apps; owned by apps.geoglows
aquiferx              App-specific; created when aquiferx writes its first table
rfs_v2                App-specific; created when rfs-v2-hydroviewer writes its first table
grace_groundwater     App-specific; created when grace-groundwater-dashboard writes its first table
<future_app>          One schema per future app
```

**In v1, only `core` is created.** Per-app schemas are not pre-provisioned. Schema names are stable identifiers and may differ from repo names (e.g., `rfs_v2` schema, `rfs-v2-hydroviewer` repo).

### 3.2 Migration ownership

`apps.geoglows` owns `core` migrations and continues to use the existing `supabase/migrations/` flow against the shared Supabase project. Authentication uses the project DB password (the standard `supabase db push` path) — per-repo Postgres migration roles are **not** attempted in v1; that is deferred until app #2 actually starts writing migrations.

`apps.geoglows` is the canonical owner of project-global Supabase settings (`[api].schemas`, redirect URLs, auth config). Other repos do not modify these.

When a future app starts writing its own schema, that's when we revisit per-repo migration roles, secrets distribution, cross-repo migration concurrency, and CI workflows. None of those are v1.

### 3.3 Isolation model: RLS + one CI guardrail

Browser-side traffic uses Supabase's standard `authenticated` Postgres role with a JWT. Per-table RLS is the security boundary. A JWT issued by any app's session is valid project-wide — schema membership is not a confidentiality boundary, only RLS row-predicates are.

**One CI guardrail in `apps.geoglows`:** any table in `core` or `public` lacking `relrowsecurity = true` fails CI. Single-tier check; `core.profiles` is the only real table it covers today, but the rule is in place so a future `core` table can't land without RLS.

A policy-shape lint (rejecting `USING (true)` and similar trivially-permissive patterns) is **deferred** until there are enough tables across enough policies to make the implementation cost worth paying.

Hard isolation (server-mediated data access via per-app service role) remains available as a per-app upgrade path; the trigger criteria (PII / paid / regulated / partner data) will be documented in the onboarding playbook only when app #2 makes that playbook non-hypothetical.

### 3.4 v1 contents of `core`

One table only:

- `core.profiles` — relocated from `public.profiles`. The canonical user profile shared by all apps.

All other tables from the original sketch (`organizations`, `memberships`, `roles`, `app_registry`, `app_access`, `app_usage`, `audit_log`) are **deferred** under YAGNI. Each is added when an actual feature requires it.

### 3.5 Profiles relocation: two-step with `security_invoker` view

Single-rename is unsafe. `geoglows-auth` has hardcoded `.from('profiles')` call sites that every running browser tab depends on; renaming `public.profiles` instantly breaks them.

The relocation:

1. **Create `core.profiles` populated from `public.profiles`.** All RLS policies, helper functions, foreign keys, and triggers are migrated to `core.profiles`. Apply explicit grants: `GRANT USAGE ON SCHEMA core TO authenticated`, plus matching SELECT / INSERT / UPDATE / DELETE grants on `core.profiles`. Replace `public.profiles` with a view:

   ```sql
   CREATE VIEW public.profiles
     WITH (security_invoker = true)
     AS SELECT ... FROM core.profiles;
   ```

   The `security_invoker = true` flag (Postgres 15+) is **load-bearing**: without it, RLS on `core.profiles` would be evaluated against the view owner's identity, not the calling user, silently bypassing per-row predicates. Both names work concurrently; older bundles keep functioning.

2. **Coordinated consumer cutover.** Release a new `geoglows-auth` version that hardcodes `core.profiles` (no schema parameter). `apps.geoglows` and `aquiferx` adopt the new lib version and redeploy on their own cadence.

3. **Drop the `public.profiles` view** in a follow-up migration once both consumers have shipped against the new lib.

**View column drift rule.** Until the view is dropped, any migration that adds, renames, or drops columns on `core.profiles` MUST also `CREATE OR REPLACE VIEW public.profiles ...` to keep column lists aligned — otherwise older bundles break with "column does not exist" errors. Enforcement is review discipline (no CI check) until the view is gone.

**Pre-migration inventory.** Before writing the migration, sweep `pg_depend` for objects that reference `public.profiles` (triggers on `auth.users`, FKs from any schema, RLS policies, materialized views). Confirm each is handled.

### 3.6 PostgREST schema exposure

`db.schemas` stays as it is today (`["public", "graphql_public"]`). The view in `public` keeps `supabase.from('profiles')` working without a config change. After the view is dropped (post-cutover), call sites in the new `geoglows-auth` use `.schema('core').from('profiles')` directly. No project-global config change is required for v1.

### 3.7 Cross-repo dependency: aquiferx

`aquiferx` is maintained by `njones61`, not the portal owner. v1 affects aquiferx in exactly one way: the `geoglows-auth` upgrade (§3.5 step 2). aquiferx adopts on its own cadence; the view from §3.5 step 1 keeps the old name working until then.

If `njones61` declines or delays the upgrade indefinitely, the `public.profiles` view stays in place indefinitely — the view column drift rule (§3.5) governs how `core.profiles` evolves during that window. **No central management of an aquiferx schema is provisioned in v1.** aquiferx writes no per-app tables in v1, so there is no aquiferx schema to manage.

### 3.8 Sequencing

Cognito is fully out of use as of 2026-04-29, so no concurrent migration risk. v1 can land at any time and is not gated on any other in-flight work.

## 4. v1 In Scope

- Create `core` schema and `core.profiles` (relocated from `public.profiles` via §3.5).
- Add `apps.geoglows` CI guardrail: `relrowsecurity = true` for all tables in `public` and `core`.
- Release new `geoglows-auth` version that reads/writes `core.profiles` (hardcoded; no schema parameter).
- Update `apps.geoglows` to the new `geoglows-auth` version.
- After all consumers cut over: drop the `public.profiles` view in a follow-up migration.

That's the entire scope.

## 5. Non-Goals

The brainstorm's broader sketch is deferred under YAGNI. Each item is added when an app has a concrete need that justifies it:

- **Per-app schemas** (`aquiferx`, `rfs_v2`, `grace_groundwater`). Created when an app writes its first table.
- **Per-repo Postgres migration roles.** Validated against `supabase db push` behavior and provisioned when app #2 starts writing migrations.
- **Default-deny migration template.** Documented when app #2 onboards.
- **Policy-shape CI lint.** Added when there are more tables and policies to govern.
- **Cross-schema FK convention** (`auth.users(id) ON DELETE CASCADE`). Decided when the first per-app table needs a `user_id` column — and validated against the per-app migration role's actual `REFERENCES` privilege on `auth.users`.
- **Hard-isolation trigger checklist.** Documented at first per-app onboarding.
- **`core.app_registry`, `core.app_usage`, `core.organizations`, `core.memberships`, `core.audit_log`.** Added when a feature requires them.
- **Cross-repo migration concurrency mechanism.** Designed when two repos actually push migrations to the project.
- **`core` change-management protocol.** Defined when a non-additive `core` change is first needed.
- **Per-app onboarding playbook.** Written when app #2 actually onboards (memory will be fresh; the playbook will reflect what actually worked).
- **User-facing org / team / membership concept.**
- **Admin UI or DB-backed app catalog.**

## 6. Open Questions (for planning)

These are narrow HOW questions belonging in the follow-up plan:

1. **Pre-migration inventory results** — what currently references `public.profiles` (per `pg_depend`)? Drives the migration's exact DDL.
2. **`geoglows-auth` release version strategy** — major or minor bump? Affects how forcefully consumers must opt in.
3. **Cutover signal** — what concrete check determines "all consumers have shipped against the new lib" before the view is dropped (manual checklist + soak period, instrumentation, both)?
4. **`njones61` notification** — courtesy-notify the `geoglows-auth` upgrade plan, or ship and let it propagate naturally?

## 7. Success Criteria

- `core.profiles` is the canonical profile location; `apps.geoglows` (via the new `geoglows-auth`) reads and writes it directly.
- `public.profiles` works correctly through the `security_invoker` view: SELECT, INSERT, and UPDATE all enforce `core.profiles`'s RLS evaluated in the calling user's context, not the view owner's.
- `aquiferx` (still on the older `geoglows-auth`) continues to function via the view with no functional regression.
- A new table in `core` or `public` without RLS fails CI in `apps.geoglows`.
- A migration that alters `core.profiles` columns also updates the `public.profiles` view (review-enforced).
- Once all consumers have cut over, the view is dropped without breaking any in-production code path.

## 8. References

- `apps.geoglows/CLAUDE.md` — current portal architecture and cross-app auth model.
- `apps.geoglows/supabase/migrations/20260323214658_auth.sql` — current `public.profiles`.
- `apps.geoglows/supabase/migrations/20260323214730_rls.sql` — current RLS policies on `public.profiles`.
- `apps.geoglows/supabase/migrations/20260429021219_rich_user_profiles.sql` — most recent profile schema.
- `apps.geoglows/supabase/config.toml` — Supabase project config.
- `geoglows-auth/src/core/profile.ts`, `geoglows-auth/src/core/account.ts` — call sites that hardcode `.from('profiles')`; updated as part of the new lib release in §3.5 step 2.
