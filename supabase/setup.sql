-- epistudent — to paste ONCE in Supabase › SQL Editor › New query › Run.
-- 1) removes everything the previous versions of the site created (old tables, the @epitech.eu-only trigger…)
-- 2) creates the budgets table used by Microsoft accounts.

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists enforce_epitech_email on auth.users;
do $$ begin perform cron.unschedule('purge-room-reports'); exception when others then null; end $$;
drop table if exists public.room_confirmations, public.notifications, public.assistants_status,
  public.defense_swaps, public.moulinette_reports, public.room_reports, public.messages,
  public.groups, public.group_requests, public.deadlines, public.projects, public.profiles,
  public.budgets cascade;
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'is_allowed_email','set_updated_at','enforce_epitech_email','handle_new_user','is_group_member',
      'has_matchmaking_opt_in','purge_expired_room_reports','is_assistant','notify','matchmaking_candidates',
      'join_group_request','leave_group','group_members','room_report_karma','room_confirmation_karma',
      'normalize_project','submit_moulinette_report','moulinette_overview','moulinette_pitfalls',
      'match_defense_swap','swap_partner','join_bocal_queue','leave_bocal_queue','bocal_next',
      'touch_budget','delete_my_account')
  loop execute 'drop function if exists ' || f.sig || ' cascade'; end loop;
end $$;
drop type if exists public.promo, public.user_role, public.request_status, public.deadline_status, public.swap_status cascade;
drop schema if exists private cascade;

-- One budget per account, synced from the browser. Only the owner can read or write it.

create table public.budgets (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 20000),
  updated_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

create policy "budgets: read own" on public.budgets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "budgets: insert own" on public.budgets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "budgets: update own" on public.budgets
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "budgets: delete own" on public.budgets
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.budgets from anon;

create or replace function public.touch_budget()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger budgets_touch
  before update on public.budgets
  for each row execute function public.touch_budget();

-- "Supprimer mon compte": removes the auth user, the budget follows (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';

select 'ok : table budgets prête' as resultat;
