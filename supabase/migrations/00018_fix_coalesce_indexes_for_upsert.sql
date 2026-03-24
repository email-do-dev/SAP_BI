-- Fix sap_cache_financeiro_canal: add mes column + replace COALESCE index with direct column
ALTER TABLE public.sap_cache_financeiro_canal ADD COLUMN IF NOT EXISTS mes text DEFAULT '';
UPDATE public.sap_cache_financeiro_canal SET mes = '' WHERE mes IS NULL;
ALTER TABLE public.sap_cache_financeiro_canal
  ALTER COLUMN mes SET DEFAULT '',
  ALTER COLUMN mes SET NOT NULL;
DROP INDEX IF EXISTS idx_fin_canal;
CREATE UNIQUE INDEX idx_fin_canal ON public.sap_cache_financeiro_canal (canal, mes);

-- Fix sap_cache_financeiro_top_clientes: add mes column + same adjustment
ALTER TABLE public.sap_cache_financeiro_top_clientes ADD COLUMN IF NOT EXISTS mes text DEFAULT '';
UPDATE public.sap_cache_financeiro_top_clientes SET mes = '' WHERE mes IS NULL;
ALTER TABLE public.sap_cache_financeiro_top_clientes
  ALTER COLUMN mes SET DEFAULT '',
  ALTER COLUMN mes SET NOT NULL;
DROP INDEX IF EXISTS idx_fin_top_clientes;
CREATE UNIQUE INDEX idx_fin_top_clientes ON public.sap_cache_financeiro_top_clientes (card_code, mes);
