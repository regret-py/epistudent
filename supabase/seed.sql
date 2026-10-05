-- Local development seed. Runs after migrations on `supabase db reset`.
insert into public.projects (module_code, name, deadline, type, intra_key) values
  ('B-CPE-110', 'Organized', now() + interval '3 days', 'project', 'seed-organized'),
  ('B-PSU-100', 'my_ls', now() + interval '9 days', 'project', 'seed-my-ls'),
  ('B-MAT-100', '102architect', now() + interval '1 day', 'project', 'seed-102architect'),
  ('B-CPE-110', 'Organized — soutenance', now() + interval '12 days', 'defense', 'seed-organized-defense')
on conflict (intra_key) do nothing;
