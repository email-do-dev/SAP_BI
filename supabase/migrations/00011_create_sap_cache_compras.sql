-- Compras abertas (1 row summary)
CREATE TABLE IF NOT EXISTS public.sap_cache_compras_abertas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  total integer DEFAULT 0,
  valor numeric DEFAULT 0,
  atrasados integer DEFAULT 0,
  valor_atrasados numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
ALTER TABLE public.sap_cache_compras_abertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_compras_abertas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_compras_abertas FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Compras mensais
CREATE TABLE IF NOT EXISTS public.sap_cache_compras_mes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mes text NOT NULL,
  num_pedidos integer DEFAULT 0,
  valor numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_mes ON public.sap_cache_compras_mes(mes);
ALTER TABLE public.sap_cache_compras_mes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_compras_mes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_compras_mes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Lead time fornecedores
CREATE TABLE IF NOT EXISTS public.sap_cache_compras_lead_time (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor text NOT NULL,
  lead_time_medio numeric DEFAULT 0,
  lead_time_min numeric DEFAULT 0,
  lead_time_max numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_lead ON public.sap_cache_compras_lead_time(fornecedor);
ALTER TABLE public.sap_cache_compras_lead_time ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_compras_lead_time FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_compras_lead_time FOR ALL TO service_role USING (true) WITH CHECK (true);
