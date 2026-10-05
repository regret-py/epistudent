insert into public.profiles (id, email, display_name)
select id, lower(email), coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users where public.is_allowed_email(email)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

select count(*) as tables_publiques from information_schema.tables where table_schema = 'public';
