-- Create app_role enum and user_roles table
create type public.app_role as enum ('diretoria', 'comercial', 'logistica', 'financeiro');

create table public.user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz default now() not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "Users can view own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

-- Service role can manage all roles
create policy "Service role can manage roles"
  on public.user_roles for all
  using (auth.jwt() ->> 'role' = 'service_role');
