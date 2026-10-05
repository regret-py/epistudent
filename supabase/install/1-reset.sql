-- epistudent: one-shot install. Safe to re-run: it first removes anything a previous
-- (partial) run created, then rebuilds everything. Paste the WHOLE file in
-- Supabase › SQL Editor › Run.

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists enforce_epitech_email on auth.users;
do $$ begin perform cron.unschedule('purge-room-reports'); exception when others then null; end $$;
drop table if exists public.room_confirmations, public.notifications, public.assistants_status,
  public.defense_swaps, public.moulinette_reports, public.room_reports, public.messages,
  public.groups, public.group_requests, public.deadlines, public.projects, public.profiles cascade;
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
      'match_defense_swap','swap_partner','join_bocal_queue','leave_bocal_queue','bocal_next')
  loop execute 'drop function if exists ' || f.sig || ' cascade'; end loop;
end $$;
drop type if exists public.promo, public.user_role, public.request_status, public.deadline_status, public.swap_status cascade;
drop schema if exists private cascade;
