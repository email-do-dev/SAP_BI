-- Financeiro aging (CR e CP)
CREATE TABLE IF NOT EXISTS public.sap_cache_financeiro_aging (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL,
  a_vencer numeric DEFAULT 0,
  vencido_1_30 numeric DEFAULT 0,
  vencido_31_60 numeric DEFAULT 0,
  vencido_61_90 numeric DEFAULT 0,
  vencido_90_mais numeric DEFAULT 0,
  total_aberto numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_aging_tipo ON public.sap_cache_financeiro_aging(tipo);
ALTER TABLE public.sap_cache_financeiro_aging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_financeiro_aging FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_financeiro_aging FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Margem mensal
CREATE TABLE IF NOT EXISTS public.sap_cache_financeiro_margem (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mes text NOT NULL,
  receita numeric DEFAULT 0,
  custo numeric DEFAULT 0,
  lucro_bruto numeric DEFAULT 0,
  margem_pct numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_margem_mes ON public.sap_cache_financeiro_margem(mes);
ALTER TABLE public.sap_cache_financeiro_margem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_financeiro_margem FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_financeiro_margem FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cashflow projection
CREATE TABLE IF NOT EXISTS public.sap_cache_financeiro_cashflow (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  due_date text NOT NULL,
  receber numeric DEFAULT 0,
  pagar numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_cashflow_date ON public.sap_cache_financeiro_cashflow(due_date);
ALTER TABLE public.sap_cache_financeiro_cashflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_financeiro_cashflow FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_financeiro_cashflow FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Vendas por canal
CREATE TABLE IF NOT EXISTS public.sap_cache_financeiro_canal (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  canal text NOT NULL,
  num_notas integer DEFAULT 0,
  valor_total numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_canal ON public.sap_cache_financeiro_canal(canal);
ALTER TABLE public.sap_cache_financeiro_canal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_financeiro_canal FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_financeiro_canal FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Top clientes
CREATE TABLE IF NOT EXISTS public.sap_cache_financeiro_top_clientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_code text NOT NULL,
  card_name text NOT NULL,
  num_notas integer DEFAULT 0,
  valor_total numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_top_clientes ON public.sap_cache_financeiro_top_clientes(card_code);
ALTER TABLE public.sap_cache_financeiro_top_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_financeiro_top_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_financeiro_top_clientes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Ciclo de caixa
CREATE TABLE IF NOT EXISTS public.sap_cache_financeiro_ciclo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pmr numeric DEFAULT 0,
  pme numeric DEFAULT 0,
  pmp numeric DEFAULT 0,
  ciclo numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
ALTER TABLE public.sap_cache_financeiro_ciclo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_financeiro_ciclo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_financeiro_ciclo FOR ALL TO service_role USING (true) WITH CHECK (true);
