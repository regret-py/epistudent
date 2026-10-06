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
