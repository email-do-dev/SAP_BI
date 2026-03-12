-- Dashboard KPIs cache
create table public.sap_cache_dashboard_kpis (
  id uuid default gen_random_uuid() primary key,
  total_pedidos integer default 0 not null,
  valor_faturamento numeric(18,2) default 0 not null,
  entregas_pendentes integer default 0 not null,
  total_devolucoes integer default 0 not null,
  refreshed_at timestamptz default now() not null
);

-- Monthly revenue cache
create table public.sap_cache_faturamento_mensal (
  id uuid default gen_random_uuid() primary key,
  mes text not null,
  valor numeric(18,2) default 0 not null,
  refreshed_at timestamptz default now() not null
);

-- Orders cache
create table public.sap_cache_pedidos (
  id uuid default gen_random_uuid() primary key,
  doc_entry integer not null,
  doc_num integer not null,
  card_code text not null,
  card_name text not null,
  doc_date date not null,
  doc_total numeric(18,2) default 0 not null,
  doc_status text not null,
  refreshed_at timestamptz default now() not null
);

-- Deliveries cache
create table public.sap_cache_entregas (
  id uuid default gen_random_uuid() primary key,
  doc_entry integer not null,
  doc_num integer not null,
  card_code text not null,
  card_name text not null,
  doc_date date not null,
  doc_total numeric(18,2) default 0 not null,
  doc_status text not null,
  address text,
  refreshed_at timestamptz default now() not null
);

-- Returns cache
create table public.sap_cache_devolucoes (
  id uuid default gen_random_uuid() primary key,
  doc_entry integer not null,
  doc_num integer not null,
  card_code text not null,
  card_name text not null,
  doc_date date not null,
  doc_total numeric(18,2) default 0 not null,
  doc_type text not null check (doc_type in ('return', 'credit_memo')),
  refreshed_at timestamptz default now() not null
);

-- Logistics cost summary cache
create table public.sap_cache_custo_logistico (
  id uuid default gen_random_uuid() primary key,
  mes text not null,
  custo_total numeric(18,2) default 0 not null,
  frete_proprio numeric(18,2) default 0 not null,
  frete_terceiro numeric(18,2) default 0 not null,
  descarga numeric(18,2) default 0 not null,
  refreshed_at timestamptz default now() not null
);

-- RLS: authenticated users can read, only service_role can write
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'sap_cache_dashboard_kpis',
    'sap_cache_faturamento_mensal',
    'sap_cache_pedidos',
    'sap_cache_entregas',
    'sap_cache_devolucoes',
    'sap_cache_custo_logistico'
  ]) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Authenticated users can read %1$s" on public.%1$I for select using (auth.role() = ''authenticated'')', t);
    execute format('create policy "Service role can write %1$s" on public.%1$I for all using (auth.jwt() ->> ''role'' = ''service_role'')', t);
  end loop;
end $$;

-- Create unique indexes for upserts during sync
create unique index idx_cache_pedidos_doc_entry on public.sap_cache_pedidos (doc_entry);
create unique index idx_cache_entregas_doc_entry on public.sap_cache_entregas (doc_entry);
create unique index idx_cache_devolucoes_doc_entry_type on public.sap_cache_devolucoes (doc_entry, doc_type);
create unique index idx_cache_faturamento_mes on public.sap_cache_faturamento_mensal (mes);
create unique index idx_cache_custo_mes on public.sap_cache_custo_logistico (mes);
