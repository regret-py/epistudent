-- Features 2-7: everything the static front (GitHub Pages) needs, exposed through RLS and
-- security-definer RPCs so no server code is required.

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('group_joined', 'swap_matched', 'bocal_turn')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, update, delete on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(p_user uuid, p_kind text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, payload) values (p_user, p_kind, p_payload);
$$;

revoke execute on function public.notify(uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- projects catalogue (crowd-sourced until the intra sync exists) + personal deadlines
-- ---------------------------------------------------------------------------
alter table public.projects
  add column created_by uuid default auth.uid() references public.profiles (id) on delete set null;

create unique index projects_module_name_key on public.projects (lower(module_code), lower(name));

create policy "projects: students add to catalogue"
  on public.projects for insert to authenticated
  with check (created_by = auth.uid() and intra_key is null);

create policy "deadlines: add own"
  on public.deadlines for insert to authenticated
  with check (user_id = auth.uid());

create policy "deadlines: remove own"
  on public.deadlines for delete to authenticated
  using (user_id = auth.uid());

alter table public.deadlines alter column user_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- matchmaking
-- ---------------------------------------------------------------------------
alter table public.groups
  add column request_id uuid unique references public.group_requests (id) on delete set null;

-- Open requests on a project from students who consented, with the minimum profile needed
-- to compute a match. Never returns email.
create or replace function public.matchmaking_candidates(p_project uuid)
returns table (
  request_id uuid,
  user_id uuid,
  display_name text,
  promo public.promo,
  city text,
  languages jsonb,
  availability jsonb,
  size smallint,
  criteria jsonb,
  members integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.id, p.display_name, p.promo, p.city, p.languages, p.availability, r.size, r.criteria,
         coalesce(cardinality(g.members), 1)
  from public.group_requests r
  join public.profiles p on p.id = r.creator_id
  left join public.groups g on g.request_id = r.id
  where r.project_id = p_project
    and r.status = 'open'
    and p.matchmaking_opt_in
    and r.creator_id <> (select auth.uid())
    and not ((select auth.uid()) = any (coalesce(g.members, '{}')));
$$;

-- Join someone's request: creates the group on first join, closes the request when full.
create or replace function public.join_group_request(p_request uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.group_requests;
  v_group public.groups;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_req from public.group_requests where id = p_request for update;
  if not found or v_req.status <> 'open' then raise exception 'request is not open'; end if;
  if v_req.creator_id = v_uid then raise exception 'cannot join your own request'; end if;
  if not public.has_matchmaking_opt_in(v_req.creator_id) then raise exception 'request is not open'; end if;

  select * into v_group from public.groups where request_id = p_request for update;
  if not found then
    insert into public.groups (project_id, members, request_id)
    values (v_req.project_id, array[v_req.creator_id, v_uid], p_request)
    returning * into v_group;
  elsif v_uid = any (v_group.members) then
    return v_group.id;
  else
    update public.groups set members = array_append(members, v_uid)
    where id = v_group.id returning * into v_group;
  end if;

  if cardinality(v_group.members) >= v_req.size then
    update public.group_requests set status = 'matched' where id = p_request;
  end if;

  perform public.notify(v_req.creator_id, 'group_joined',
    jsonb_build_object('group_id', v_group.id, 'project_id', v_req.project_id));
  return v_group.id;
end;
$$;

-- The creator gets a group (alone) as soon as they want to chat or invite.
create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.groups set members = array_remove(members, v_uid)
  where id = p_group and v_uid = any (members);
  delete from public.groups where id = p_group and cardinality(members) = 0;
  -- reopen the request if it had been filled
  update public.group_requests r set status = 'open'
  from public.groups g
  where g.id = p_group and r.id = g.request_id and r.status = 'matched' and cardinality(g.members) < r.size;
end;
$$;

-- Display names of the people in one of my groups.
create or replace function public.group_members(p_group uuid)
returns table (user_id uuid, display_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.email
  from public.groups g
  join public.profiles p on p.id = any (g.members)
  where g.id = p_group and (select auth.uid()) = any (g.members);
$$;

-- ---------------------------------------------------------------------------
-- free rooms: karma + anti-spam + automatic purge
-- ---------------------------------------------------------------------------
create or replace function public.room_report_karma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.room_reports
    where reported_by = new.reported_by
      and lower(room) = lower(new.room)
      and campus = new.campus
      and created_at > now() - interval '5 minutes'
      and id <> new.id
  ) then
    raise exception 'already reported this room recently' using errcode = 'check_violation';
  end if;
  update public.profiles set karma = karma + 1 where id = new.reported_by;
  return new;
end;
$$;

create trigger room_reports_karma
  after insert on public.room_reports
  for each row execute function public.room_report_karma();

-- Confirming someone else's report rewards them (reliability incentive).
create table public.room_confirmations (
  report_id uuid not null references public.room_reports (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

alter table public.room_confirmations enable row level security;

create policy "room_confirmations: read for authenticated"
  on public.room_confirmations for select to authenticated using (true);

create policy "room_confirmations: confirm others' reports"
  on public.room_confirmations for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.room_reports r
      where r.id = report_id and r.reported_by <> auth.uid() and r.expires_at > now()
    )
  );

create or replace function public.room_confirmation_karma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p set karma = karma + 2
  from public.room_reports r
  where r.id = new.report_id and p.id = r.reported_by;
  return new;
end;
$$;

create trigger room_confirmations_karma
  after insert on public.room_confirmations
  for each row execute function public.room_confirmation_karma();

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('purge-room-reports', '*/10 * * * *', 'select public.purge_expired_room_reports()');
exception when others then
  raise notice 'pg_cron unavailable, rely on the worker to purge room reports: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moulinette: anonymous submissions + aggregates
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_secrets (
  key text primary key,
  value text not null
);

insert into private.app_secrets (key, value)
values ('moulinette_pepper', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

alter table public.moulinette_reports add column project_label text;

create or replace function public.normalize_project(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(p)), '\s+', ' ', 'g');
$$;

-- One submission per (user, project); re-submitting updates it. The user id only ever
-- enters an HMAC with a server-side pepper, so rows cannot be traced back.
create or replace function public.submit_moulinette_report(
  p_project text,
  p_score numeric,
  p_pitfalls text[] default '{}',
  p_comment text default null,
  p_hours integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_project text := public.normalize_project(p_project);
  v_pepper text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if char_length(v_project) not between 2 and 80 then raise exception 'invalid project'; end if;
  select value into v_pepper from private.app_secrets where key = 'moulinette_pepper';

  insert into public.moulinette_reports (project_hash, project_label, submission_hash, score, pitfalls, comment, hours_spent)
  values (
    encode(extensions.digest(v_project, 'sha256'), 'hex'),
    v_project,
    encode(extensions.hmac(v_uid::text || ':' || v_project, v_pepper, 'sha256'), 'hex'),
    p_score,
    coalesce((select array_agg(distinct public.normalize_project(x)) from unnest(p_pitfalls) x where trim(x) <> ''), '{}'),
    nullif(trim(p_comment), ''),
    p_hours
  )
  on conflict (submission_hash) do update set
    score = excluded.score,
    pitfalls = excluded.pitfalls,
    comment = excluded.comment,
    hours_spent = excluded.hours_spent,
    created_at = date_trunc('day', now());
end;
$$;

create or replace function public.moulinette_overview()
returns table (project text, reports bigint, avg_score numeric, pass_rate numeric, avg_hours numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select project_label,
         count(*),
         round(avg(score), 1),
         round(100.0 * count(*) filter (where score >= 50) / count(*), 0),
         round(avg(hours_spent), 1)
  from public.moulinette_reports
  where project_label is not null
  group by project_label
  order by count(*) desc, project_label;
$$;

create or replace function public.moulinette_pitfalls(p_project text)
returns table (pitfall text, occurrences bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select x, count(*)
  from public.moulinette_reports, unnest(pitfalls) x
  where project_label = public.normalize_project(p_project)
  group by x
  order by count(*) desc, x
  limit 10;
$$;

-- ---------------------------------------------------------------------------
-- Defense swaps: bilateral matching + notification
-- ---------------------------------------------------------------------------
create or replace function public.match_defense_swap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other public.defense_swaps;
begin
  select * into v_other
  from public.defense_swaps s
  where s.status = 'open'
    and s.user_id <> new.user_id
    and s.offered_slot = new.wanted_slot
    and s.wanted_slot = new.offered_slot
    and s.project_id is not distinct from new.project_id
  order by s.created_at
  limit 1
  for update skip locked;

  if found then
    update public.defense_swaps set status = 'matched', matched_with = new.id where id = v_other.id;
    update public.defense_swaps set status = 'matched', matched_with = v_other.id where id = new.id;
    perform public.notify(new.user_id, 'swap_matched', jsonb_build_object('swap_id', new.id));
    perform public.notify(v_other.user_id, 'swap_matched', jsonb_build_object('swap_id', v_other.id));
  end if;
  return null;
end;
$$;

create trigger defense_swaps_match
  after insert on public.defense_swaps
  for each row execute function public.match_defense_swap();

-- Posting a swap means agreeing to share your Epitech email with your match only.
create or replace function public.swap_partner(p_swap uuid)
returns table (display_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.email
  from public.defense_swaps mine
  join public.defense_swaps other on other.id = mine.matched_with
  join public.profiles p on p.id = other.user_id
  where mine.id = p_swap and mine.user_id = (select auth.uid()) and mine.status = 'matched';
$$;

-- Users may only cancel; matching is done by the trigger.
revoke update on public.defense_swaps from authenticated, anon;
grant update (status) on public.defense_swaps to authenticated;
drop policy "defense_swaps: update own" on public.defense_swaps;
create policy "defense_swaps: cancel own open swap"
  on public.defense_swaps for update to authenticated
  using (user_id = auth.uid() and status = 'open')
  with check (user_id = auth.uid() and status = 'cancelled');

-- ---------------------------------------------------------------------------
-- Bocal queue
-- ---------------------------------------------------------------------------
alter table public.assistants_status add column display_name text check (char_length(display_name) <= 80);

create or replace function public.join_bocal_queue(p_status uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_queue uuid[];
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  update public.assistants_status
  set queue = case when v_uid = any (queue) then queue else array_append(queue, v_uid) end
  where id = p_status and available
  returning queue into v_queue;
  if v_queue is null then raise exception 'assistant unavailable'; end if;
  return array_position(v_queue, v_uid);
end;
$$;

create or replace function public.leave_bocal_queue(p_status uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.assistants_status set queue = array_remove(queue, (select auth.uid())) where id = p_status;
$$;

-- Assistant calls the next student in their own queue.
create or replace function public.bocal_next(p_status uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next uuid;
begin
  select queue[1] into v_next from public.assistants_status
  where id = p_status and assistant_id = auth.uid() and public.is_assistant()
  for update;
  if v_next is null then return null; end if;
  update public.assistants_status set queue = queue[2:] where id = p_status;
  perform public.notify(v_next, 'bocal_turn', jsonb_build_object('status_id', p_status));
  return v_next;
end;
$$;

-- Realtime
alter publication supabase_realtime add table public.notifications, public.defense_swaps, public.groups;
