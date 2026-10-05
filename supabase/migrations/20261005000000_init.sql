-- StudyBuddy Epitech — initial schema
-- Every table has RLS enabled. Tables written only by the worker (service_role)
-- have no write policy at all: service_role bypasses RLS, everyone else is denied.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.promo as enum ('tek1', 'tek2', 'tek3', 'tek4', 'tek5');
create type public.user_role as enum ('student', 'assistant', 'admin');
create type public.request_status as enum ('open', 'matched', 'closed');
create type public.deadline_status as enum ('todo', 'in_progress', 'done', 'missed');
create type public.swap_status as enum ('open', 'matched', 'cancelled');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_allowed_email(email text)
returns boolean
language sql
immutable
as $$
  select coalesce(lower(email) like '%@epitech.eu', false);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (public.is_allowed_email(email)),
  display_name text check (char_length(display_name) <= 80),
  role public.user_role not null default 'student',
  promo public.promo,
  city text check (char_length(city) <= 64),
  -- { "c": 4, "python": 2, ... } self-rated 1..5
  languages jsonb not null default '{}'::jsonb check (jsonb_typeof(languages) = 'object'),
  -- ["weekday", "weekend", "evening"]
  availability jsonb not null default '[]'::jsonb check (jsonb_typeof(availability) = 'array'),
  karma integer not null default 0,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  -- explicit consent before anything about this user is shown to other students
  matchmaking_opt_in boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users may only edit their self-declared fields: karma, role and email are server-managed.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, promo, city, languages, availability, locale, matchmaking_opt_in, onboarded_at)
  on public.profiles to authenticated;

-- Reject sign-ups outside the Epitech tenant at the database level, whatever
-- the OAuth provider configuration says.
create or replace function public.enforce_epitech_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_allowed_email(new.email) then
    raise exception 'Only @epitech.eu accounts are allowed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger enforce_epitech_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_epitech_email();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- projects / deadlines (filled by the worker)
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  module_code text not null,
  name text not null,
  deadline timestamptz,
  type text not null default 'project' check (type in ('project', 'defense', 'exam', 'other')),
  -- stable key from the intra, used for idempotent upserts by the worker
  intra_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_deadline_idx on public.projects (deadline);
create index projects_module_idx on public.projects (module_code);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "projects: read for authenticated"
  on public.projects for select to authenticated
  using (true);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.deadline_status not null default 'todo',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index deadlines_user_idx on public.deadlines (user_id);

alter table public.deadlines enable row level security;

create policy "deadlines: read own"
  on public.deadlines for select to authenticated
  using (user_id = auth.uid());

create policy "deadlines: update own status"
  on public.deadlines for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke update on public.deadlines from authenticated, anon;
grant update (status) on public.deadlines to authenticated;

-- ---------------------------------------------------------------------------
-- group matchmaking
-- ---------------------------------------------------------------------------
create table public.group_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  creator_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  size smallint not null check (size between 2 and 10),
  -- { level, availability[], location: remote|onsite|any, ambition: validation|bonus }
  criteria jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object'),
  status public.request_status not null default 'open',
  created_at timestamptz not null default now()
);

create index group_requests_project_idx on public.group_requests (project_id) where status = 'open';

alter table public.group_requests enable row level security;

-- profiles RLS only exposes the caller's own row, so consent is checked through a definer function
create or replace function public.has_matchmaking_opt_in(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select matchmaking_opt_in from public.profiles where id = uid), false);
$$;

-- Open requests are visible to authenticated users only when the creator opted in.
create policy "group_requests: read open or own"
  on public.group_requests for select to authenticated
  using (
    creator_id = auth.uid()
    or (
      status = 'open'
      and public.has_matchmaking_opt_in(creator_id)
    )
  );

create policy "group_requests: insert own"
  on public.group_requests for insert to authenticated
  with check (creator_id = auth.uid());

create policy "group_requests: update own"
  on public.group_requests for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "group_requests: delete own"
  on public.group_requests for delete to authenticated
  using (creator_id = auth.uid());

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  members uuid[] not null check (cardinality(members) between 1 and 10),
  chat_id uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create index groups_members_idx on public.groups using gin (members);

alter table public.groups enable row level security;

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid and (select auth.uid()) = any (g.members)
  );
$$;

-- Groups are created by the matching service (service_role) only.
create policy "groups: read as member"
  on public.groups for select to authenticated
  using (auth.uid() = any (members));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_group_created_idx on public.messages (group_id, created_at desc);

alter table public.messages enable row level security;

create policy "messages: read as member"
  on public.messages for select to authenticated
  using (public.is_group_member(group_id));

create policy "messages: send as member"
  on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- crowd-sourced free rooms (45 min TTL)
-- ---------------------------------------------------------------------------
create table public.room_reports (
  id uuid primary key default gen_random_uuid(),
  campus text not null check (char_length(campus) <= 64),
  room text not null check (char_length(room) <= 64),
  seats_free smallint not null check (seats_free between 0 and 500),
  reported_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '45 minutes'
);

create index room_reports_live_idx on public.room_reports (campus, expires_at desc);

alter table public.room_reports enable row level security;

-- Expired reports disappear from reads immediately; purge_expired_room_reports() cleans up.
create policy "room_reports: read live"
  on public.room_reports for select to authenticated
  using (expires_at > now());

create policy "room_reports: insert own"
  on public.room_reports for insert to authenticated
  with check (
    reported_by = auth.uid()
    and expires_at <= now() + interval '45 minutes'
  );

create or replace function public.purge_expired_room_reports()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.room_reports where expires_at <= now() returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke execute on function public.purge_expired_room_reports() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- anonymised Moulinette history
-- ---------------------------------------------------------------------------
-- No user id is stored. project_hash groups results per project, submission_hash
-- (hash of user + project, computed server-side with a secret pepper) only
-- prevents duplicate submissions and cannot be reversed to a user.
create table public.moulinette_reports (
  id uuid primary key default gen_random_uuid(),
  project_hash text not null,
  submission_hash text not null unique,
  score numeric(5, 2) not null check (score between 0 and 100),
  pitfalls text[] not null default '{}' check (cardinality(pitfalls) <= 20),
  comment text check (char_length(comment) <= 2000),
  hours_spent smallint check (hours_spent between 0 and 1000),
  created_at timestamptz not null default (date_trunc('day', now()))
);

create index moulinette_reports_project_idx on public.moulinette_reports (project_hash);

alter table public.moulinette_reports enable row level security;

-- Reads go through aggregates; inserts go through a security-definer RPC (next migration
-- for feature 5), so there is no direct insert policy.
create policy "moulinette_reports: read for authenticated"
  on public.moulinette_reports for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- defense slot swaps
-- ---------------------------------------------------------------------------
create table public.defense_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  offered_slot timestamptz not null,
  wanted_slot timestamptz not null,
  status public.swap_status not null default 'open',
  matched_with uuid references public.defense_swaps (id) on delete set null,
  created_at timestamptz not null default now(),
  check (offered_slot <> wanted_slot)
);

create index defense_swaps_open_idx on public.defense_swaps (project_id, offered_slot, wanted_slot)
  where status = 'open';

alter table public.defense_swaps enable row level security;

create policy "defense_swaps: read open or own"
  on public.defense_swaps for select to authenticated
  using (status = 'open' or user_id = auth.uid());

create policy "defense_swaps: insert own"
  on public.defense_swaps for insert to authenticated
  with check (user_id = auth.uid());

create policy "defense_swaps: update own"
  on public.defense_swaps for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "defense_swaps: delete own"
  on public.defense_swaps for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Bocal / assistants
-- ---------------------------------------------------------------------------
create table public.assistants_status (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null unique references public.profiles (id) on delete cascade,
  campus text,
  available boolean not null default false,
  queue uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger assistants_status_updated_at
  before update on public.assistants_status
  for each row execute function public.set_updated_at();

alter table public.assistants_status enable row level security;

create or replace function public.is_assistant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('assistant', 'admin')
  );
$$;

create policy "assistants_status: read for authenticated"
  on public.assistants_status for select to authenticated
  using (true);

create policy "assistants_status: assistant manages own"
  on public.assistants_status for all to authenticated
  using (assistant_id = auth.uid() and public.is_assistant())
  with check (assistant_id = auth.uid() and public.is_assistant());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.room_reports, public.assistants_status;
