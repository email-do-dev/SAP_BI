-- Add canal (client group) to pedidos cache
ALTER TABLE public.sap_cache_pedidos ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT '';
