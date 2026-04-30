-- Fail loudly if any regular table in `core` or `public` is missing RLS.
--
-- Plan: docs/plans/2026-04-29-005-feat-profiles-relocation-to-core-schema-plan.md
-- Origin: docs/plans/2026-04-29-004-feat-multi-app-schema-architecture-requirements.md
--
-- Scope:
--   - Targets schemas: `core`, `public`
--   - Targets relkind 'r' (regular tables) — views, materialized views, foreign
--     tables, sequences, etc. are NOT relevant for RLS and are excluded.
--   - Authoritative source: pg_class.relrowsecurity. ALTER TABLE ... ENABLE ROW
--     LEVEL SECURITY sets this to true. Per the plan, RLS-enabled (this script)
--     is necessary but not sufficient — policy-shape correctness is intentionally
--     deferred per origin §3.3.
--
-- Run with:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/check-rls-enabled.sql
--
-- Exit code is determined by ON_ERROR_STOP. The DO block raises on failure,
-- so non-zero exit and a clear "ASSERTION FAILED" message are how the check
-- reports a problem to CI.

do $$
declare
  bad_tables text;
begin
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

  if bad_tables is not null then
    raise exception
      'ASSERTION FAILED: tables without RLS enabled in core/public: %. Each application table in these schemas must have `alter table <name> enable row level security` and at least one policy. See docs/plans/2026-04-29-005-feat-profiles-relocation-to-core-schema-plan.md §3.3.',
      bad_tables;
  end if;

  raise notice 'check-rls-enabled: PASS';
end$$;

select 'check-rls-enabled: PASS' as result;
