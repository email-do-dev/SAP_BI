-- Producao ordens
CREATE TABLE IF NOT EXISTS public.sap_cache_producao_ordens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL,
  qtd integer DEFAULT 0,
  planejada numeric DEFAULT 0,
  completada numeric DEFAULT 0,
  pct numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_ordens ON public.sap_cache_producao_ordens(status);
ALTER TABLE public.sap_cache_producao_ordens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_producao_ordens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_producao_ordens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Producao consumo MP
CREATE TABLE IF NOT EXISTS public.sap_cache_producao_consumo_mp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code text NOT NULL,
  item_name text,
  qtd_consumida numeric DEFAULT 0,
  valor numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_consumo ON public.sap_cache_producao_consumo_mp(item_code);
ALTER TABLE public.sap_cache_producao_consumo_mp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_producao_consumo_mp FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_producao_consumo_mp FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Producao planejado vs real
CREATE TABLE IF NOT EXISTS public.sap_cache_producao_planejado_vs_real (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mes text NOT NULL,
  planejado numeric DEFAULT 0,
  realizado numeric DEFAULT 0,
  eficiencia_pct numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_plan_real ON public.sap_cache_producao_planejado_vs_real(mes);
ALTER TABLE public.sap_cache_producao_planejado_vs_real ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_producao_planejado_vs_real FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_producao_planejado_vs_real FOR ALL TO service_role USING (true) WITH CHECK (true);
