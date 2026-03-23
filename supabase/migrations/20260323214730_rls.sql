-- Enable RLS
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;

-- Helpful indexes
create index if not exists idx_org_memberships_user_id
  on public.org_memberships(user_id);

create index if not exists idx_org_memberships_org_id
  on public.org_memberships(org_id);

-- Drop policies if re-running
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "organizations_select_member" on public.organizations;
drop policy if exists "organizations_update_admin" on public.organizations;
drop policy if exists "organizations_delete_admin" on public.organizations;

drop policy if exists "org_memberships_select_member" on public.org_memberships;
drop policy if exists "org_memberships_insert_admin" on public.org_memberships;
drop policy if exists "org_memberships_update_admin" on public.org_memberships;
drop policy if exists "org_memberships_delete_admin" on public.org_memberships;

-- Helper functions to avoid recursive policy checks
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships
    where org_id = p_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships
    where org_id = p_org_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- profiles
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()));

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) is not null and id = (select auth.uid()));

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()))
with check ((select auth.uid()) is not null and id = (select auth.uid()));

-- organizations
create policy "organizations_select_member"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy "organizations_update_admin"
on public.organizations
for update
to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

create policy "organizations_delete_admin"
on public.organizations
for delete
to authenticated
using (public.is_org_admin(id));

-- org_memberships
create policy "org_memberships_select_member"
on public.org_memberships
for select
to authenticated
using (public.is_org_member(org_id));

create policy "org_memberships_insert_admin"
on public.org_memberships
for insert
to authenticated
with check (public.is_org_admin(org_id));

create policy "org_memberships_update_admin"
on public.org_memberships
for update
to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy "org_memberships_delete_admin"
on public.org_memberships
for delete
to authenticated
using (public.is_org_admin(org_id));

-- Bootstrap function: create org + make current user first admin
create or replace function public.create_organization_with_admin(org_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org public.organizations;
  v_base_slug text;
  v_slug text;
  v_n integer := 1;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if trim(coalesce(org_name, '')) = '' then
    raise exception 'Organization name is required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
  ) then
    raise exception 'Profile does not exist for current user';
  end if;

  v_base_slug := lower(trim(org_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '(^-|-$)', '', 'g');

  if v_base_slug = '' then
    raise exception 'Organization name does not produce a valid slug';
  end if;

  v_slug := v_base_slug;

  while exists (
    select 1
    from public.organizations
    where slug = v_slug
  ) loop
    v_n := v_n + 1;
    v_slug := v_base_slug || '-' || v_n::text;
  end loop;

  insert into public.organizations (name, slug, created_by)
  values (trim(org_name), v_slug, v_user_id)
  returning * into v_org;

  insert into public.org_memberships (org_id, user_id, role, accepted_at)
  values (v_org.id, v_user_id, 'admin', now());

  return v_org;
end;
$$;

revoke all on function public.create_organization_with_admin(text) from public;
grant execute on function public.create_organization_with_admin(text) to authenticated;