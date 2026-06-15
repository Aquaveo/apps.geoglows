---
title: "`supabase db query --file` rejects multi-statement SQL scripts; use psql directly"
date: 2026-04-29
category: developer-experience
module: apps.geoglows
problem_type: developer_experience
component: supabase_cli
severity: low
applies_when:
  - You wrote a multi-statement SQL file (DO blocks, multiple statements separated by semicolons, multiple INSERTs)
  - You tried to run it with `npx supabase db query --file <path>` against a local stack
  - You got `ERROR: cannot insert multiple commands into a prepared statement (SQLSTATE 42601)` from the CLI's debug output
tags:
  - supabase
  - supabase-cli
  - psql
  - migrations
  - testing
  - sql
---

## Problem

`npx supabase db query --file <path>` fails with `cannot insert multiple commands into a prepared statement` for any SQL file containing more than one statement separated by semicolons (including DO blocks, multiple INSERTs, multiple SELECTs, etc.).

The CLI sends the entire file content as a single Postgres `Parse` message (a prepared statement), and Postgres rejects multi-statement payloads in that path.

This affects: SQL test runbooks, ad-hoc migration verification scripts, any "run this file against my local DB" workflow.

## Solution

Use `psql` directly, not `supabase db query`. `psql -f` parses statements client-side and sends them one at a time, which works.

The local Supabase Postgres listens on `127.0.0.1:54322` by default with `postgres:postgres` credentials. Two equivalent invocations:

**Hard-coded (simplest):**
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -v ON_ERROR_STOP=1 \
     -f tests/migrations/profiles-relocation.test.sql
```

**Discovered via `supabase status` (more portable across machines):**
```bash
DB_URL=$(npx supabase status -o env | awk -F= '/^DB_URL=/{gsub(/"/,"",$2); print $2}')
psql "$DB_URL" -v ON_ERROR_STOP=1 -f tests/migrations/profiles-relocation.test.sql
```

`-v ON_ERROR_STOP=1` makes psql exit non-zero on the first failed statement — useful in CI and for "fail-loud" verification scripts.

## When `supabase db query` IS appropriate

For single-statement queries (one SELECT, one INSERT, one CREATE), `supabase db query --file` works fine. The limitation is specifically multi-statement files.

## Related

- `apps.geoglows/tests/migrations/profiles-relocation.test.sql` — the verification runbook this learning came from. Its HOW TO RUN comment now uses `psql -f` directly, not `supabase db query`.
- The Supabase CLI behavior may change; if it gains a `--no-prepare` flag or similar in the future, this learning can be updated.
