-- Research Assistant Marketplace and Grant Management
-- PostgreSQL/Supabase migration contract.
--
-- Preconditions:
--   1. public.users(id) exists and uses UUID primary keys.
--   2. authenticated requests expose the user UUID as request.jwt.claim.sub.
--
-- Scholar currently uses MongoDB/Mongoose. Keep this migration unapplied until
-- the application has a PostgreSQL connection and per-user JWT authentication.

begin;

create extension if not exists pgcrypto;

do $$
declare
  users_id_type text;
begin
  if to_regclass('public.users') is null then
    raise exception
      'Marketplace migration requires public.users(id); Scholar currently uses MongoDB/Mongoose.';
  end if;

  select format_type(attribute.atttypid, attribute.atttypmod)
    into users_id_type
  from pg_attribute as attribute
  where attribute.attrelid = 'public.users'::regclass
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  if users_id_type is null then
    raise exception 'Marketplace migration requires public.users.id.';
  end if;

  if users_id_type <> 'uuid' then
    raise exception
      'Marketplace migration expects public.users.id to be uuid, found %.',
      users_id_type;
  end if;
end
$$;

create or replace function public.marketplace_current_user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table if not exists public.ra_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  bio text not null default '',
  academic_level text not null,
  disciplines text[] not null default array[]::text[],
  toolset text[] not null default array[]::text[],
  citation_styles text[] not null default array[]::text[],
  hourly_rate numeric(12, 2) not null check (hourly_rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  grant_code text,
  target_journal text,
  budget numeric(14, 2) not null default 0 check (budget >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'on_hold', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  research_project_id uuid not null
    references public.research_projects(id) on delete cascade,
  title text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'approved')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ra_profiles_disciplines_gin_idx
  on public.ra_profiles using gin (disciplines);
create index if not exists ra_profiles_toolset_gin_idx
  on public.ra_profiles using gin (toolset);
create index if not exists ra_profiles_citation_styles_gin_idx
  on public.ra_profiles using gin (citation_styles);
create index if not exists research_projects_user_id_idx
  on public.research_projects (user_id);
create unique index if not exists research_projects_grant_code_unique_idx
  on public.research_projects (grant_code)
  where grant_code is not null;
create index if not exists project_milestones_project_due_date_idx
  on public.project_milestones (research_project_id, due_date);

alter table public.ra_profiles enable row level security;
alter table public.research_projects enable row level security;
alter table public.project_milestones enable row level security;

-- RA profiles are directory records: authenticated database roles may browse
-- them, while only the linked account may create or change its own profile.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ra_profiles'
      and policyname = 'ra_profiles_directory_read'
  ) then
    create policy ra_profiles_directory_read
      on public.ra_profiles for select
      using (public.marketplace_current_user_id() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ra_profiles'
      and policyname = 'ra_profiles_owner_insert'
  ) then
    create policy ra_profiles_owner_insert
      on public.ra_profiles for insert
      with check (user_id = public.marketplace_current_user_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ra_profiles'
      and policyname = 'ra_profiles_owner_update'
  ) then
    create policy ra_profiles_owner_update
      on public.ra_profiles for update
      using (user_id = public.marketplace_current_user_id())
      with check (user_id = public.marketplace_current_user_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ra_profiles'
      and policyname = 'ra_profiles_owner_delete'
  ) then
    create policy ra_profiles_owner_delete
      on public.ra_profiles for delete
      using (user_id = public.marketplace_current_user_id());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'research_projects'
      and policyname = 'research_projects_owner_all'
  ) then
    create policy research_projects_owner_all
      on public.research_projects for all
      using (user_id = public.marketplace_current_user_id())
      with check (user_id = public.marketplace_current_user_id());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_milestones'
      and policyname = 'project_milestones_project_owner_all'
  ) then
    create policy project_milestones_project_owner_all
      on public.project_milestones for all
      using (
        exists (
          select 1
          from public.research_projects as project
          where project.id = project_milestones.research_project_id
            and project.user_id = public.marketplace_current_user_id()
        )
      )
      with check (
        exists (
          select 1
          from public.research_projects as project
          where project.id = project_milestones.research_project_id
            and project.user_id = public.marketplace_current_user_id()
        )
      );
  end if;
end
$$;

commit;
