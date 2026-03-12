-- Cache table for comercial SKU group analysis (revenue by product group per month)
CREATE TABLE public.sap_cache_comercial_grupo_sku (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mes text NOT NULL,
  grupo_sku text NOT NULL,
  num_notas integer DEFAULT 0,
  volume numeric(18,6) DEFAULT 0,
  receita numeric(18,2) DEFAULT 0,
  refreshed_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX idx_cache_comercial_grupo_sku ON public.sap_cache_comercial_grupo_sku (mes, grupo_sku);

ALTER TABLE public.sap_cache_comercial_grupo_sku ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read comercial_grupo_sku"
  ON public.sap_cache_comercial_grupo_sku FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can write comercial_grupo_sku"
  ON public.sap_cache_comercial_grupo_sku FOR ALL
  TO service_role USING (true) WITH CHECK (true);
