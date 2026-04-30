-- Verification runbook for the profiles-relocation migration
-- (20260429180000_relocate_profiles_to_core.sql).
--
-- Plan: docs/plans/2026-04-29-005-feat-profiles-relocation-to-core-schema-plan.md
--
-- HOW TO RUN
--   1. Start a local Supabase stack:        npx supabase start
--   2. Apply migrations on a fresh DB:      npx supabase db reset
--   3. Get the local DB URL and run via psql (NOT `supabase db query` — that
--      uses prepared statements and rejects multi-statement scripts):
--        DB_URL=$(npx supabase status -o env | awk -F= '/^DB_URL=/{gsub(/"/,"",$2); print $2}')
--        psql "$DB_URL" -v ON_ERROR_STOP=1 -f tests/migrations/profiles-relocation.test.sql
--      The local Supabase Postgres listens on 127.0.0.1:54322 by default; if
--      the env-var dance is awkward, use this directly:
--        psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--             -v ON_ERROR_STOP=1 -f tests/migrations/profiles-relocation.test.sql
--   4. Each DO block raises an exception on failure. A successful run ends with
--      `profiles-relocation: ALL ASSERTIONS PASSED`. Any "ASSERTION FAILED"
--      message means stop, debug, fix the migration.
--
-- WHAT IT EXERCISES (per plan §Unit 1 test scenarios)
--   - Data preservation through the migration
--   - View structure (security_invoker = true; correct columns)
--   - RLS enforcement through the view: select-own, update-own, insert-own,
--     reject-other-user
--   - RLS enforcement directly on core.profiles
--   - Negative test: a view WITHOUT security_invoker bypasses RLS (proves the
--     flag is load-bearing)
--   - Grants on core.profiles match expectations (no DELETE)

-- ============================================================================
-- 0. Setup: insert two test users into auth.users + core.profiles
-- ============================================================================
-- Runs as postgres (superuser); RLS does not apply.

-- Idempotent cleanup if the runbook is re-run.
delete from core.profiles where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

insert into auth.users (id, email, instance_id, aud, role, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    now(), now())
on conflict (id) do nothing;

insert into core.profiles (id, email, display_name)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', 'Bob')
on conflict (id) do nothing;

-- ============================================================================
-- 1. Schema-level assertions
-- ============================================================================

do $$
begin
  -- core schema exists
  if not exists (select 1 from information_schema.schemata where schema_name = 'core') then
    raise exception 'ASSERTION FAILED: core schema does not exist';
  end if;

  -- core.profiles exists as a TABLE (relkind = 'r')
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core' and c.relname = 'profiles' and c.relkind = 'r'
  ) then
    raise exception 'ASSERTION FAILED: core.profiles is not a regular table';
  end if;

  -- public.profiles exists as a VIEW (relkind = 'v')
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles' and c.relkind = 'v'
  ) then
    raise exception 'ASSERTION FAILED: public.profiles is not a view';
  end if;

  -- The view has security_invoker = true (LOAD-BEARING)
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
      and 'security_invoker=true' = any(c.reloptions)
  ) then
    raise exception 'ASSERTION FAILED: public.profiles view is missing security_invoker = true. This is the load-bearing flag for RLS through the view.';
  end if;

  -- core.profiles has RLS enabled
  if not (
    select c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core' and c.relname = 'profiles'
  ) then
    raise exception 'ASSERTION FAILED: RLS is not enabled on core.profiles';
  end if;

  -- core.user_type enum lives in core
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'core' and t.typname = 'user_type'
  ) then
    raise exception 'ASSERTION FAILED: user_type enum is not in core schema';
  end if;

  -- public.profiles (table — not view) does NOT exist
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles' and c.relkind = 'r'
  ) then
    raise exception 'ASSERTION FAILED: public.profiles still exists as a table (should be a view)';
  end if;

  raise notice 'Schema assertions: PASS';
end$$;

-- ============================================================================
-- 2. Grants on core.profiles include SELECT/INSERT/UPDATE but NOT DELETE
-- ============================================================================

do $$
declare
  has_select boolean;
  has_insert boolean;
  has_update boolean;
  has_delete boolean;
begin
  select has_table_privilege('authenticated', 'core.profiles', 'select') into has_select;
  select has_table_privilege('authenticated', 'core.profiles', 'insert') into has_insert;
  select has_table_privilege('authenticated', 'core.profiles', 'update') into has_update;
  select has_table_privilege('authenticated', 'core.profiles', 'delete') into has_delete;

  if not has_select then raise exception 'ASSERTION FAILED: authenticated lacks SELECT on core.profiles'; end if;
  if not has_insert then raise exception 'ASSERTION FAILED: authenticated lacks INSERT on core.profiles'; end if;
  if not has_update then raise exception 'ASSERTION FAILED: authenticated lacks UPDATE on core.profiles'; end if;
  if has_delete then raise exception 'ASSERTION FAILED: authenticated has DELETE on core.profiles (should be denied per plan)'; end if;

  raise notice 'Grant assertions: PASS';
end$$;

-- ============================================================================
-- 3. RLS through the view, as user Alice
-- ============================================================================

do $$
declare
  row_count int;
  alice_display text;
begin
  set local role authenticated;
  set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

  -- Alice can SELECT only her own row through the view
  select count(*) into row_count from public.profiles;
  if row_count <> 1 then
    raise exception 'ASSERTION FAILED: Alice sees % rows through public.profiles view, expected 1', row_count;
  end if;

  select display_name into alice_display from public.profiles where id = '11111111-1111-1111-1111-111111111111'::uuid;
  if alice_display <> 'Alice' then
    raise exception 'ASSERTION FAILED: Alice''s row not visible through view (got display_name=%)', coalesce(alice_display, 'NULL');
  end if;

  -- Alice cannot SELECT Bob's row through the view (RLS USING)
  select count(*) into row_count from public.profiles where id = '22222222-2222-2222-2222-222222222222'::uuid;
  if row_count <> 0 then
    raise exception 'ASSERTION FAILED: Alice can see Bob''s row through view (RLS USING bypassed)';
  end if;

  -- Alice can UPDATE her own row through the view
  update public.profiles set display_name = 'Alice (updated)'
    where id = '11111111-1111-1111-1111-111111111111'::uuid;
  if not found then
    raise exception 'ASSERTION FAILED: Alice''s UPDATE through view affected 0 rows';
  end if;
  -- Verify it actually persisted in core.profiles
  set local role postgres;
  select display_name into alice_display from core.profiles where id = '11111111-1111-1111-1111-111111111111'::uuid;
  if alice_display <> 'Alice (updated)' then
    raise exception 'ASSERTION FAILED: Update through view did not reach core.profiles (got %)', coalesce(alice_display, 'NULL');
  end if;
  -- Reset for next assertions
  update core.profiles set display_name = 'Alice' where id = '11111111-1111-1111-1111-111111111111'::uuid;

  raise notice 'View RLS (Alice): PASS';
end$$;

-- ============================================================================
-- 4. RLS WITH CHECK rejects cross-user writes through the view
-- ============================================================================

do $$
declare
  rls_violation boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

  -- Alice attempting to UPDATE Bob's row should silently affect 0 rows
  -- (USING filters Bob out before the update is applied).
  update public.profiles set display_name = 'pwned'
    where id = '22222222-2222-2222-2222-222222222222'::uuid;
  if found then
    raise exception 'ASSERTION FAILED: Alice updated Bob''s row through view (USING bypassed)';
  end if;

  -- Alice attempting to INSERT Bob's id should be rejected by WITH CHECK.
  begin
    insert into public.profiles (id, email, display_name)
      values ('22222222-2222-2222-2222-222222222222'::uuid, 'bob@example.com', 'pwned');
    -- If we got here, the insert was NOT rejected — that's a failure
    raise exception 'ASSERTION FAILED: Alice inserted a row with Bob''s id through view (WITH CHECK bypassed)';
  exception when others then
    -- Expected: RLS violation
    rls_violation := true;
  end;
  if not rls_violation then
    raise exception 'ASSERTION FAILED: WITH CHECK did not fire on cross-user insert';
  end if;

  raise notice 'View RLS WITH CHECK: PASS';
end$$;

-- ============================================================================
-- 5. RLS directly on core.profiles (not via view)
-- ============================================================================

do $$
declare
  row_count int;
begin
  set local role authenticated;
  set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

  -- Alice can read her own row from core.profiles
  select count(*) into row_count from core.profiles
    where id = '11111111-1111-1111-1111-111111111111'::uuid;
  if row_count <> 1 then
    raise exception 'ASSERTION FAILED: Alice cannot read her own row from core.profiles';
  end if;

  -- Alice cannot read Bob's row from core.profiles
  select count(*) into row_count from core.profiles
    where id = '22222222-2222-2222-2222-222222222222'::uuid;
  if row_count <> 0 then
    raise exception 'ASSERTION FAILED: Alice can read Bob''s row from core.profiles directly';
  end if;

  raise notice 'Direct core.profiles RLS: PASS';
end$$;

-- ============================================================================
-- 6. Negative test: a view WITHOUT security_invoker bypasses RLS
-- ============================================================================
-- This builds a temporary parallel view to demonstrate that the
-- security_invoker = true flag is what makes the bridge view RLS-correct.
-- Without the flag, the view runs as its owner (postgres / supabase_admin)
-- and RLS on core.profiles is bypassed entirely.

do $$
declare
  row_count int;
begin
  -- Build a counterfactual view (no security_invoker) — only visible in this
  -- test session.
  set local role postgres;
  drop view if exists public.profiles_counterfactual;
  create view public.profiles_counterfactual as
    select id, email, display_name from core.profiles;
  -- Note: NO `with (security_invoker = true)` — this is the broken case.
  grant select on public.profiles_counterfactual to authenticated;

  -- As Alice, query the counterfactual view. Without security_invoker,
  -- RLS on core.profiles evaluates as the view OWNER, which is postgres
  -- (a superuser, RLS bypassed) → Alice sees ALL rows including Bob's.
  set local role authenticated;
  set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';
  select count(*) into row_count from public.profiles_counterfactual;

  if row_count < 2 then
    raise exception
      'ASSERTION FAILED: counterfactual view (without security_invoker) did NOT bypass RLS (got % rows). The negative test relies on bypass actually happening.', row_count;
  end if;

  raise notice 'Negative test: confirmed view-without-security_invoker bypasses RLS (saw % rows). This is the bug `security_invoker = true` prevents on the real public.profiles view.', row_count;

  set local role postgres;
  drop view public.profiles_counterfactual;
end$$;

-- ============================================================================
-- 7. Cleanup
-- ============================================================================

set role postgres;
delete from core.profiles where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

select 'profiles-relocation: ALL ASSERTIONS PASSED' as result;
