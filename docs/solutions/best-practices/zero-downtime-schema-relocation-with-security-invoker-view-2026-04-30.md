---
title: "Zero-downtime relocation of a Supabase table to a new schema via a security_invoker bridge view"
date: 2026-04-30
category: best-practices
module: supabase/migrations
problem_type: best_practice
component: database
severity: high
applies_when:
  - "Relocating a Supabase/PostgREST table to a different schema while older browser bundles still query the original name"
  - "A shared client library has hardcoded `.from('<table>')` call sites that cannot be atomically updated across all consumers"
  - "Multiple Vite/SPA consumers share one Supabase project and must continue to work during a coordinated lib version cutover"
  - "Introducing a `core` (or other shared) schema for cross-app concerns without breaking RLS or grant chains"
tags:
  - supabase
  - postgrest
  - schema-relocation
  - security-invoker
  - rls
  - zero-downtime-migration
  - core-schema
  - profiles
---

# Zero-downtime relocation of a Supabase table to a new schema via a security_invoker bridge view

## Context

Relocating a table from one Postgres schema to another is a one-line `ALTER TABLE … SET SCHEMA …` in isolation. Inside a Supabase project with browser-side consumers using `supabase-js`, it is anything but. The hardcoded `.from('<table>')` call sites baked into deployed bundles will 404 the instant the table moves, because PostgREST resolves them against `public` by default. Old tabs in users' browsers, older library versions in not-yet-redeployed apps, and any consumer outside your immediate control all break simultaneously.

We hit this concretely while introducing a shared `core` schema to the GEOGloWS portal: relocating `public.profiles` to `core.profiles` would have broken every running tab of `apps.geoglows` and the `aquiferx` fork, because four call sites in `@aquaveo/geoglows-auth` 0.3.x do `supabase.from('profiles')` with no schema qualifier. We needed a relocation that consumers could absorb at their own cadence — including consumers we don't control.

The pattern: do the relocation in a single transactional migration that **also installs a `security_invoker = true` view at the original name**, so the old name keeps working until every consumer is on a new lib version that targets the new location explicitly. The bridge is dropped in a follow-up migration once the soak window passes. Nothing about this is Supabase-specific — it's pure Postgres + PostgREST plumbing — but the load-bearing details (the `security_invoker` flag, PostgREST's exposed-schemas allowlist, the underlying-table grant requirement for views) are easy to miss.

## Guidance

The relocation runs as a single transaction. Order matters; several steps are load-bearing.

### 1. Pre-migration inventory (against production)

Run these queries against the production database (Supabase Dashboard SQL Editor is fine) and capture the output as a comment block at the top of your migration file. They confirm the relocation has no surprise dependents.

```sql
-- Anything beyond your known RLS policies, PK, CHECK constraints, defaults,
-- toast/composite type internals, and the user_type column reference is a
-- dependent the migration must explicitly handle.
select pg_describe_object(classid, objid, objsubid) as dependent_object
  from pg_depend
 where refobjid = 'public.<table>'::regclass
 order by 1;

-- Should return zero rows for a clean profile table. If non-empty (e.g.,
-- a Dashboard-installed handle_new_user trigger), the migration must
-- retarget the trigger to the new table.
select tgname, tgrelid::regclass, tgenabled
  from pg_trigger
 where tgrelid = 'auth.users'::regclass
   and not tgisinternal;

-- Snapshot grants to compare against post-migration. Supabase defaults
-- grant ALL to anon/authenticated/postgres/service_role; verify which of
-- those you intend to preserve on the new table (see step 4).
select grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = '<table>'
 group by grantee
 order by grantee;
```

### 2. Add the target schema to PostgREST's exposed-schemas list

This is **mandatory and frequently missed**. `supabase.schema('core').from('<table>')` from supabase-js sends `Accept-Profile: core` to PostgREST. If `core` is not in the project's exposed-schemas allowlist, PostgREST returns:

```
HTTP/1.1 406 Not Acceptable
{ "code": "PGRST106",
  "message": "The schema must be one of the following: public, graphql_public" }
```

Grants alone are not sufficient. Two updates are required:

**Local stack** (`supabase/config.toml`):
```toml
[api]
schemas = ["public", "graphql_public", "core"]
```

**Production project**: Dashboard → Project Settings → Data API → Settings → "Exposed schemas" → add `core`. Note: the dropdown only lists schemas that **already exist in the database**. If you try to expose `core` before the migration creates it, the dropdown won't offer it. Do the migration first locally to confirm shape, then on production: expose `core` in the Dashboard immediately after `supabase db push`. Order in production:

1. `supabase db push` (creates `core` and the table)
2. Dashboard → expose `core`
3. Smoke-test old-lib bundles still work via the bridge view
4. Then publish/deploy new-lib consumers

If you control the project programmatically, the management API works too:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"db_schema": "public, graphql_public, core"}' \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/postgrest"
```

### 3. The migration — single transaction, ordered

Write a single migration file (Supabase CLI wraps each file in a transaction; an explicit `BEGIN;` / `COMMIT;` is belt-and-braces, not redundant for safety):

```sql
begin;

-- 0. Lock the source table to close the data-copy race.
-- Concurrent INSERT/UPDATE/DELETE on the old table will block until the
-- transaction commits (milliseconds). Without this, a row inserted
-- between the data copy (step 5) and the table drop (step 8) is silently
-- lost when the table is dropped.
lock table public.<table> in access exclusive mode;

-- 1. Create the target schema.
create schema if not exists core;

-- 2. Grant schema usage to runtime + admin roles. Do NOT grant to anon
-- if RLS already excludes anon; default-deny is more honest than
-- redundant grants.
grant usage on schema core to authenticated, service_role;

-- 3. Move enum/composite types into the target schema BEFORE creating
-- the new table. Postgres tracks types by OID, so existing column
-- references on the old table continue to resolve until the table is
-- dropped in step 8.
alter type public.<enum> set schema core;

-- 4. Create the target table with the full final shape (column list,
-- constraints, defaults). If you used `LIKE ... INCLUDING ALL`, defaults
-- copy correctly; explicit DDL is more readable for review.
create table core.<table> (
  -- copy column list verbatim from public.<table>
);

-- 5. Copy data. With the LOCK in step 0, the source is frozen.
insert into core.<table> select * from public.<table>;

-- 6. Grants on the new table. Decide explicitly what each role gets.
-- Supabase's default of ALL to four roles is convenient but not
-- always correct; the migration is a chance to tighten.
grant select, insert, update on core.<table> to authenticated;  -- no DELETE; matches existing RLS
grant all on core.<table> to service_role;

-- 7. RLS on the new table. Drop the old policies first to free the
-- policy names; recreate with identical predicates against the new
-- table. The pre-drop is cosmetic — Postgres would auto-drop with the
-- table — but explicit is easier to review.
alter table core.<table> enable row level security;

drop policy if exists "<policy_name>" on public.<table>;
create policy "<policy_name>" on core.<table>
  for select to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()));
-- ... insert / update policies similarly ...

-- 8. Drop the old table — WITHOUT CASCADE. Failing loudly on any
-- unexpected dependent is what we want. The pre-migration inventory
-- (step 1 of guidance) should have surfaced anything before we got here.
drop table public.<table>;

-- 9. Replace the old name with a security_invoker view over the new
-- table.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- WARNING: `WITH (security_invoker = true)` IS LOAD-BEARING.
-- Without this flag, the view runs as the view owner (typically
-- postgres / supabase_admin), which BYPASSES RLS on the underlying
-- table. Any authenticated user could read every row. Do NOT remove
-- this flag in any future CREATE OR REPLACE VIEW of this view.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
create view public.<table>
  with (security_invoker = true)
  as select <explicit column list> from core.<table>;

-- 10. View-level grants are ALSO required. The view is a separate
-- PostgREST endpoint and grant subject. Underlying-table grants from
-- step 6 are what the calling user actually needs (security_invoker
-- evaluates RLS in the caller's context against the underlying
-- table), but the view-level grants make PostgREST expose the view as
-- an endpoint at all.
grant select, insert, update on public.<table> to authenticated;
grant all on public.<table> to service_role;

commit;
```

### 4. Major-bump any consumer library whose runtime DB contract changes

If a published library hardcodes the old table name and you're switching its call sites to `.schema('<new>').from('<table>')`, bump its major version. The TypeScript surface and call shape may not change, but the **runtime DB contract did**: requests now carry `Accept-Profile: <new>` and assume the new schema/table exist. SemVer-by-API-shape under-counts this; SemVer-by-runtime-contract counts it correctly.

The major bump matters specifically for consumers outside your control:

- Caret-range consumers (`^x.y.z`) stop auto-pulling at the major boundary, forcing a deliberate upgrade
- Non-controlled consumers can keep working on the older version against the bridge view indefinitely
- The version number is the place a downstream maintainer sees "review this before bumping"

If the only consumers are under your control, the major bump is more about hygiene than safety — but the cost of a major bump is one number; the cost of a silent runtime breakage is incident response.

### 5. Coordinate the rollout in production order

The rollout sequence is load-bearing because Vercel (and similar) preview environments often share the production database. Reverse any pair of these and consumers immediately 406 with PGRST106:

1. Expose the new schema in the Dashboard / management API (step 2)
2. Apply the migration to production (`supabase db push`)
3. Smoke-test against production from a temp checkout still on the **old** lib version — verifies the bridge view works end-to-end for older bundles
4. Publish the new lib version to npm / your registry
5. Deploy each consumer (lockfile pulls the new lib; `Accept-Profile: <new>` requests start flowing)
6. After all consumers are confirmed running the new lib in production, observe a soak window (7 days is a defensible default — long enough for stale browser tabs and cached CDN bundles to age out)
7. Drop the bridge view in a follow-up migration

### 6. Drop the bridge view in a follow-up migration

```sql
-- Rollback if needed: re-create with the same security_invoker flag.
--   create view public.<table> with (security_invoker = true)
--     as select <columns> from core.<table>;
--   grant select, insert, update on public.<table> to authenticated;
--   grant all on public.<table> to service_role;
drop view public.<table>;
```

## Why This Matters

Each load-bearing detail in the guidance fails differently if you skip it:

| Detail | Failure mode if skipped |
|---|---|
| `WITH (security_invoker = true)` on the view | View runs as owner. RLS on the underlying table evaluates against the owner's identity (typically `postgres` / `supabase_admin`), bypassing all `auth.uid()` row predicates. **Every authenticated user can read every row of profile / PII data.** Silent. The page renders normally; the breach is invisible until someone queries `from('profiles')` with no `where` clause. |
| Schema in PostgREST exposed-schemas | `Accept-Profile: <schema>` from `supabase.schema('<schema>')` is rejected with PGRST106. Every profile read/write fails immediately on deploy. Loud, obvious, recoverable in seconds — but only if you know to look in the Data API settings rather than fighting the migration. |
| `LOCK TABLE … IN ACCESS EXCLUSIVE MODE` at the start | Concurrent writes to the source table between data copy and table drop are silently lost. Users may see profile changes "save" successfully and then disappear. Race window is small but non-zero. |
| Underlying-table grants on the new table | View traversal fails with `permission denied for table <table>` even when the view itself has grants. `security_invoker` evaluates the calling user's privileges on the **underlying** table, not on the view. |
| Single transaction | Partial rollout state if any step fails. The transaction wrap means failure rolls back to "old table still exists, nothing else changed." |
| `DROP TABLE … WITHOUT CASCADE` | A surprise dependent (FK from another schema, materialized view, dashboard-installed trigger) silently disappears with the cascade. Without CASCADE, the migration fails loudly on the dependent and you investigate before destroying anything. |
| Major version bump for the lib | Caret-range consumers auto-pull; their next CI build or lockfile regen fails against unmigrated environments. The bump is the signal that the runtime contract changed. |

The pattern compounds: once `core` is in the exposed-schemas list and one bridge-view relocation has succeeded, future schema reorganization (per-app schemas, tenant schemas, etc.) reuses the same primitives — the team learns the routine once.

## When to Apply

- Moving an existing Supabase table to a different schema (especially `public` → `core` / shared / per-tenant)
- Renaming a table whose old name is hardcoded in consumer libraries
- Splitting a large `public` schema into namespaces as a project's app surface grows
- Any cross-schema migration where consumer cutover cannot be coordinated atomically (multiple deploys, third-party fork consumers, browser-cached bundles)

**Do not apply** when:

- The table is private to a single trusted server-side caller you can update atomically — just rename and update the caller in one deploy
- The table has zero browser-side or library-side consumers (no cached client bundles to bridge)
- You can take downtime — a single `ALTER TABLE … SET SCHEMA` plus a synchronous deploy of the renamed call sites is simpler

## Examples

### Production migration (concrete instance from this repo)

`apps.geoglows/supabase/migrations/20260429180000_relocate_profiles_to_core.sql` — the migration that ran live in the GEOGloWS production project on 2026-04-30. Includes the pre-migration inventory comment block, the `LOCK TABLE`, the `ALTER TYPE … SET SCHEMA core` for the `user_type` enum, the data copy, the load-bearing warning comment over the view DDL, and the dual underlying-table + view-level grants.

### Verification runbook

`apps.geoglows/tests/migrations/profiles-relocation.test.sql` — a SQL runbook executable via `psql -f`. Each `do $$ … end$$` block is a load-bearing assertion:

- Schema/grant introspection (RLS enabled, no DELETE grant, view has `security_invoker = true`)
- Authenticated-context test as user "Alice": can read own row, cannot read other users, can update own row, cannot update other users
- WITH CHECK enforcement on cross-user inserts
- **Negative test** that builds a counterfactual view *without* `security_invoker`, confirms it bypasses RLS — this is the smoking-gun proof that the flag is what makes the bridge correct

### Cross-layer manual smoke test

Before publishing the new lib version, clone `main` (still on the old lib) into a temp directory, point its `.env.local` at the migrated production database, run the dev server, sign in, edit a profile, hard-refresh, confirm persisted. This proves the bridge view actually works end-to-end against real production data with a real browser, before any consumer cuts over.

### Consumer call-site change

```ts
// before (lib 0.3.x)
const { data, error } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.sub)
  .maybeSingle();

// after (lib 1.0.0 — major bump because runtime DB contract changed)
const { data, error } = await supabase
  .schema("core")
  .from("profiles")
  .select("*")
  .eq("id", user.sub)
  .maybeSingle();
```

The `Profile` TypeScript type doesn't change. The function signature doesn't change. The PostgREST request shape does — the new request includes `Accept-Profile: core` and PostgREST routes it to `core.profiles`.

## Related

### Sibling docs in this repo and `geoglows-auth`

- `apps.geoglows/docs/solutions/developer-experience/supabase-db-query-cli-rejects-multi-statement-scripts-2026-04-29.md` — `supabase db query --file` rejects multi-statement SQL; use `psql -f` instead. The verification runbook above runs through psql for this reason.
- `geoglows-auth/docs/solutions/best-practices/user-metadata-is-auth-identity-not-profile-of-record-2026-04-29.md` — establishes the profile-of-record rule. Note: as of `@aquaveo/geoglows-auth@1.0.0` the canonical table is `core.profiles`; `public.profiles` is a `security_invoker = true` compatibility view.
- `geoglows-auth/docs/solutions/logic-errors/ensureprofile-upsert-overwrites-user-edits-2026-04-29.md` — the select-then-insert design rule for `ensureProfile`. Same note about table location.

### Plan and origin

- `apps.geoglows/docs/plans/2026-04-29-005-feat-profiles-relocation-to-core-schema-plan.md` — the technical plan (units, scenarios, rollout sequence, risk table, rollback procedure)
- `apps.geoglows/docs/plans/2026-04-29-004-feat-multi-app-schema-architecture-requirements.md` — the upstream brainstorm (origin: WHY this exists; YAGNI'd to profiles-only after two review passes)

### Pull requests where this pattern shipped

- `Aquaveo/apps.geoglows#7` — DB migration + RLS CI guardrail + dep bump
- `Aquaveo/geoglows-auth#4` — lib 1.0.0 with `.schema('core')` call sites
- `Aquaveo/aquiferx#2` — controlled-fork dep bump

### External references

- Postgres `WITH (security_invoker = true)` view option (added in PG 15): [Postgres docs — CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html)
- PostgREST `Accept-Profile` / `Content-Profile` headers and `db-schemas` configuration: [PostgREST docs — Schemas](https://postgrest.org/en/stable/references/api/schemas.html)
- PGRST106 error code reference: [PostgREST docs — Errors](https://postgrest.org/en/stable/references/errors.html#pgrst106)
