-- Estoque por deposito
CREATE TABLE IF NOT EXISTS public.sap_cache_estoque_deposito (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deposito text NOT NULL,
  num_itens integer DEFAULT 0,
  qtd numeric DEFAULT 0,
  valor numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_est_deposito ON public.sap_cache_estoque_deposito(deposito);
ALTER TABLE public.sap_cache_estoque_deposito ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_estoque_deposito FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_estoque_deposito FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Estoque valorizacao por grupo
CREATE TABLE IF NOT EXISTS public.sap_cache_estoque_valorizacao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo text NOT NULL,
  num_itens integer DEFAULT 0,
  qtd numeric DEFAULT 0,
  valor numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_est_valorizacao ON public.sap_cache_estoque_valorizacao(grupo);
ALTER TABLE public.sap_cache_estoque_valorizacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_estoque_valorizacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_estoque_valorizacao FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Estoque abaixo do minimo
CREATE TABLE IF NOT EXISTS public.sap_cache_estoque_abaixo_minimo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code text NOT NULL,
  item_name text,
  grupo text,
  estoque numeric DEFAULT 0,
  minimo numeric DEFAULT 0,
  diferenca numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_est_abaixo_min ON public.sap_cache_estoque_abaixo_minimo(item_code);
ALTER TABLE public.sap_cache_estoque_abaixo_minimo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_estoque_abaixo_minimo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_estoque_abaixo_minimo FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Estoque giro
CREATE TABLE IF NOT EXISTS public.sap_cache_estoque_giro (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code text NOT NULL,
  item_name text,
  em_estoque numeric DEFAULT 0,
  vendido_6m numeric DEFAULT 0,
  giro numeric DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_est_giro ON public.sap_cache_estoque_giro(item_code);
ALTER TABLE public.sap_cache_estoque_giro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_cache_estoque_giro FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.sap_cache_estoque_giro FOR ALL TO service_role USING (true) WITH CHECK (true);
