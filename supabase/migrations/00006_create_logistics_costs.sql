-- Cost type and source enums
create type public.cost_type as enum ('frete_proprio', 'frete_terceiro', 'descarga');
create type public.cost_source as enum ('manual', 'calculated', 'sap');

-- Logistics costs table
create table public.logistics_costs (
  id uuid default gen_random_uuid() primary key,
  delivery_doc_entry integer not null,
  cost_type public.cost_type not null,
  amount numeric(18,2) not null,
  description text,
  source public.cost_source not null,
  opch_doc_entry integer,
  created_by uuid references auth.users not null,
  created_at timestamptz default now() not null
);

alter table public.logistics_costs enable row level security;

create policy "Authenticated users can read logistics_costs"
  on public.logistics_costs for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert logistics_costs"
  on public.logistics_costs for insert
  with check (auth.role() = 'authenticated');

-- Delivery routes table
create table public.delivery_routes (
  id uuid default gen_random_uuid() primary key,
  delivery_doc_entry integer not null unique,
  total_km numeric(10,2) not null,
  route_points jsonb not null default '[]'::jsonb,
  calculated_at timestamptz default now() not null
);

alter table public.delivery_routes enable row level security;

create policy "Authenticated users can read delivery_routes"
  on public.delivery_routes for select
  using (auth.role() = 'authenticated');

create policy "Service role can write delivery_routes"
  on public.delivery_routes for all
  using (auth.jwt() ->> 'role' = 'service_role');

-- App settings table
create table public.app_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz default now() not null,
  updated_by uuid references auth.users
);

alter table public.app_settings enable row level security;

create policy "Authenticated users can read app_settings"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

create policy "Diretoria can update app_settings"
  on public.app_settings for update
  using (public.has_role(auth.uid(), 'diretoria'));

create policy "Diretoria can insert app_settings"
  on public.app_settings for insert
  with check (public.has_role(auth.uid(), 'diretoria'));

-- Seed default settings
insert into public.app_settings (key, value, description) values
  ('custo_km', '3.50', 'Custo por quilômetro para frete próprio (R$)'),
  ('warehouse_address', '', 'Endereço do armazém para cálculo de rota');

-- Indexes
create index idx_logistics_costs_delivery on public.logistics_costs (delivery_doc_entry);
create index idx_logistics_costs_type on public.logistics_costs (cost_type);
