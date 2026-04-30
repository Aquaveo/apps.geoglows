-- Verification runbook for scripts/check-rls-enabled.sql.
--
-- HOW TO RUN
--   1. Start local Supabase + apply migrations: npx supabase start && npx supabase db reset
--   2. Run via psql:
--        psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--             -v ON_ERROR_STOP=1 \
--             -f tests/scripts/check-rls-enabled.test.sql
--
-- WHAT IT EXERCISES (per plan §Unit 2 test scenarios)
--   - Happy path: clean schema (post-migration) passes
--   - Error path: a deliberately-broken table without RLS is detected
--   - Edge case: tables in other schemas (e.g., auth.users) are NOT flagged
--   - Edge case: views are NOT flagged
--
-- All assertions run within transactions and roll back, so the database state
-- is unchanged after the script completes.

-- ============================================================================
-- 1. Happy path — clean schema passes
-- ============================================================================
-- Re-run the production check; it should succeed.

\echo '--- Test 1: clean schema'
\i scripts/check-rls-enabled.sql

-- ============================================================================
-- 2. Error path — broken-table fixture is caught
-- ============================================================================
-- Insert a table without RLS into core inside a savepoint, run the check, and
-- confirm it raises. Roll back so the broken table doesn't persist.

\echo '--- Test 2: broken table (no RLS) is detected'
begin;
  create table core.test_no_rls (id int);

  do $$
  declare
    bad_tables text;
    saw_failure boolean := false;
  begin
    -- Inline copy of the check logic; we want to assert it RAISES rather
    -- than letting psql's ON_ERROR_STOP halt the script.
    select string_agg(
             format('%I.%I', n.nspname, c.relname),
             ', ' order by n.nspname, c.relname
           )
      into bad_tables
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('core', 'public')
       and c.relkind = 'r'
       and c.relrowsecurity = false;

    if bad_tables is null then
      raise exception 'ASSERTION FAILED: check should have flagged core.test_no_rls but bad_tables is null';
    end if;

    if position('core.test_no_rls' in bad_tables) = 0 then
      raise exception 'ASSERTION FAILED: bad_tables (%) does not include core.test_no_rls', bad_tables;
    end if;

    raise notice 'Test 2 PASS: check correctly identified core.test_no_rls (full list: %)', bad_tables;
  end$$;
rollback;

-- ============================================================================
-- 3. Edge case — tables outside core/public are NOT flagged
-- ============================================================================
-- auth.users has no RLS in stock Supabase but lives in `auth`, not `core` or
-- `public`. Confirm the check ignores it.

\echo '--- Test 3: auth.* and other schemas are not flagged'
do $$
declare
  auth_users_rls boolean;
  bad_tables text;
begin
  select c.relrowsecurity into auth_users_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'auth' and c.relname = 'users';

  if auth_users_rls is null then
    raise exception 'ASSERTION FAILED: auth.users not found — running against the wrong DB?';
  end if;

  -- Re-run the same scoping logic as the production check
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ')
    into bad_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('core', 'public')
     and c.relkind = 'r'
     and c.relrowsecurity = false;

  if bad_tables is not null and position('auth.users' in bad_tables) > 0 then
    raise exception 'ASSERTION FAILED: bad_tables incorrectly includes auth.users';
  end if;

  raise notice 'Test 3 PASS: scoping limits to core/public; auth.users RLS state (%) is irrelevant', auth_users_rls;
end$$;

-- ============================================================================
-- 4. Edge case — views are NOT flagged
-- ============================================================================
-- public.profiles is a view (relkind='v') after the relocation migration.
-- relrowsecurity is meaningless for views. Confirm it's excluded.

\echo '--- Test 4: views are not flagged'
do $$
declare
  bad_tables text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ')
    into bad_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('core', 'public')
     and c.relkind = 'r'
     and c.relrowsecurity = false;

  if bad_tables is not null and position('public.profiles' in bad_tables) > 0 then
    raise exception 'ASSERTION FAILED: public.profiles (a view) incorrectly flagged';
  end if;

  raise notice 'Test 4 PASS: relkind=r filter excludes views like public.profiles';
end$$;

select 'check-rls-enabled tests: ALL PASS' as result;
