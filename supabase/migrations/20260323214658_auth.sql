-- Shared tables for Cognito + Supabase
-- profiles.id = Cognito sub

create table if not exists public.profiles (
    id uuid primary key,
    email text not null,
    display_name text,
    created_at timestamptz default now()
);

create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    created_by uuid references public.profiles(id),
    created_at timestamptz default now()
);

create table if not exists public.org_memberships (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    role text not null check (role in ('admin', 'viewer')),
    invited_at timestamptz default now(),
    accepted_at timestamptz,
    unique (org_id, user_id)
);