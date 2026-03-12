-- Database functions for role checking
create or replace function public.get_user_roles(_user_id uuid)
returns setof public.app_role
language sql
security definer
stable
as $$
  select role from public.user_roles where user_id = _user_id;
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;
