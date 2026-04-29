-- Rich user profiles: extend `profiles` with structured names and contact
-- fields. Drop the abandoned `organizations` / `org_memberships` tables and
-- their helpers / policies — the org concept is removed from this iteration.
--
-- All new columns on `profiles` are nullable. Required-field enforcement
-- (first_name, last_name) lives in the application layer, not the DB:
-- existing rows from the Cognito era and OAuth users who skip the setup
-- flow must remain valid.

-- ---------------------------------------------------------------------------
-- 1. Drop org-related RLS policies
-- ---------------------------------------------------------------------------

drop policy if exists "organizations_select_member" on public.organizations;
drop policy if exists "organizations_update_admin" on public.organizations;
drop policy if exists "organizations_delete_admin" on public.organizations;

drop policy if exists "org_memberships_select_member" on public.org_memberships;
drop policy if exists "org_memberships_insert_admin" on public.org_memberships;
drop policy if exists "org_memberships_update_admin" on public.org_memberships;
drop policy if exists "org_memberships_delete_admin" on public.org_memberships;

-- ---------------------------------------------------------------------------
-- 2. Drop org helper functions
-- ---------------------------------------------------------------------------

drop function if exists public.create_organization_with_admin(text);
drop function if exists public.is_org_admin(uuid);
drop function if exists public.is_org_member(uuid);

-- ---------------------------------------------------------------------------
-- 3. Drop org tables
-- ---------------------------------------------------------------------------

drop table if exists public.org_memberships;
drop table if exists public.organizations;

-- ---------------------------------------------------------------------------
-- 4. Create user_type enum
-- ---------------------------------------------------------------------------
-- Adjustable later via ALTER TYPE ... ADD VALUE.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_type') then
    create type public.user_type as enum (
      'researcher',
      'student',
      'agency_staff',
      'industry_professional',
      'public',
      'other'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 5. Extend profiles with new columns
-- ---------------------------------------------------------------------------
-- All optional. The `display_name` column already exists from the original
-- schema and is preserved as the canonical name fallback for surfaces like
-- the navbar. Application code composes / refreshes display_name from the
-- structured fields.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text,
  add column if not exists phone_number text,
  add column if not exists user_type public.user_type,
  add column if not exists address text,
  add column if not exists user_link text,
  add column if not exists avatar_url text;

-- ---------------------------------------------------------------------------
-- 6. URL format check on user_link
-- ---------------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_user_link_format;

alter table public.profiles
  add constraint profiles_user_link_format
  check (user_link is null or user_link ~* '^https?://');
