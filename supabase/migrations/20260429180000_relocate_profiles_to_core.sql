-- Relocate `public.profiles` to `core.profiles` with a `security_invoker`
-- view bridging the old name through the consumer cutover.
--
-- Plan: docs/plans/2026-04-29-005-feat-profiles-relocation-to-core-schema-plan.md
-- Origin: docs/plans/2026-04-29-004-feat-multi-app-schema-architecture-requirements.md
--
-- ============================================================================
-- Pre-migration inventory (static analysis of repo migrations + aquiferx grep)
-- ============================================================================
-- Dependents of `public.profiles` known from repo state:
--   - 3 RLS policies on public.profiles: profiles_select_own,
--     profiles_insert_own, profiles_update_own (recreated below on core.profiles)
--   - public.user_type enum (relocated to core.user_type below; column refs
--     follow via OID)
--   - profiles_user_link_format CHECK constraint on user_link (recreated below)
--   - No foreign keys from other tables (organizations / org_memberships were
--     dropped in 20260429021219)
--   - No materialized views or triggers in repo migrations
-- aquiferx codebase grep (Aquaveo-controlled fork): no direct `.from('profiles')`
--   call sites outside `@aquaveo/geoglows-auth`. Only match was unrelated
--   `profile.profiles[idx]` cross-section data in components/CrossSectionChart.tsx.
-- BEFORE PRODUCTION APPLY: run `pg_depend` and `pg_trigger` queries against the
-- production project to catch any Dashboard-installed dependents (notably any
-- `handle_new_user` trigger on `auth.users`):
--   select pg_describe_object(classid, objid, objsubid)
--     from pg_depend where refobjid = 'public.profiles'::regclass;
--   select tgname, tgrelid::regclass
--     from pg_trigger where tgrelid = 'auth.users'::regclass;
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Lock the source table for the duration of the migration
-- ---------------------------------------------------------------------------
-- Closes the race where a concurrent INSERT/UPDATE on public.profiles could
-- land between the data copy and the table drop.
lock table public.profiles in access exclusive mode;

-- ---------------------------------------------------------------------------
-- 1. Create the `core` schema
-- ---------------------------------------------------------------------------
create schema if not exists core;
grant usage on schema core to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Move the user_type enum into `core`
-- ---------------------------------------------------------------------------
-- Postgres tracks enum types by OID, so existing column references on
-- public.profiles continue to resolve until the table is dropped below.
alter type public.user_type set schema core;

-- ---------------------------------------------------------------------------
-- 3. Create core.profiles with the full final column list
-- ---------------------------------------------------------------------------
create table core.profiles (
  id uuid primary key,
  email text not null,
  display_name text,
  created_at timestamptz default now(),
  first_name text,
  middle_name text,
  last_name text,
  phone_number text,
  user_type core.user_type,
  address text,
  user_link text,
  avatar_url text,
  constraint profiles_user_link_format
    check (user_link is null or user_link ~* '^https?://')
);

-- ---------------------------------------------------------------------------
-- 4. Copy data from public.profiles
-- ---------------------------------------------------------------------------
insert into core.profiles
  (id, email, display_name, created_at, first_name, middle_name, last_name,
   phone_number, user_type, address, user_link, avatar_url)
select
  id, email, display_name, created_at, first_name, middle_name, last_name,
  phone_number, user_type, address, user_link, avatar_url
from public.profiles;

-- ---------------------------------------------------------------------------
-- 5. Grants on core.profiles (no DELETE — see plan §Decisions)
-- ---------------------------------------------------------------------------
-- DELETE intentionally omitted: matches existing public.profiles behavior
-- (no DELETE policy ever existed). Account deletion goes through
-- supabase.auth.admin.deleteUser(), not the profiles table.
grant select, insert, update on core.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS on core.profiles
-- ---------------------------------------------------------------------------
alter table core.profiles enable row level security;

create policy "profiles_select_own"
  on core.profiles
  for select
  to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()));

create policy "profiles_insert_own"
  on core.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and id = (select auth.uid()));

create policy "profiles_update_own"
  on core.profiles
  for update
  to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()))
  with check ((select auth.uid()) is not null and id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Drop the old policies on public.profiles
-- ---------------------------------------------------------------------------
-- Cosmetic — Postgres would auto-drop these when the table is dropped below.
-- Done explicitly for migration readability.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- ---------------------------------------------------------------------------
-- 8. Drop the old table (no CASCADE — fail loudly if any unexpected
--    object still depends on it)
-- ---------------------------------------------------------------------------
drop table public.profiles;

-- ---------------------------------------------------------------------------
-- 9. Replace public.profiles with a backwards-compatible view over core.profiles
-- ---------------------------------------------------------------------------
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- WARNING: `WITH (security_invoker = true)` is LOAD-BEARING.
-- Without it, Postgres views run with the view owner's identity for RLS
-- evaluation, which would silently bypass core.profiles's `auth.uid()` row
-- predicates and expose all user PII to any authenticated user. Do NOT
-- remove this flag in any future CREATE OR REPLACE VIEW of public.profiles.
-- See plan §3.5 and the regression test in tests/migrations/.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
create view public.profiles
  with (security_invoker = true)
  as select
       id, email, display_name, created_at, first_name, middle_name, last_name,
       phone_number, user_type, address, user_link, avatar_url
     from core.profiles;

grant select, insert, update on public.profiles to authenticated;

commit;
