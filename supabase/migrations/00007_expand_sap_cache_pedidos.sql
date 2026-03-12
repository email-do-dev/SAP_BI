-- Expand sap_cache_pedidos for unified comercial view (PV + NF + EN)

-- Drop old unique index (doc_entry alone is no longer unique with PV/NF/EN origins)
DROP INDEX IF EXISTS idx_cache_pedidos_doc_entry;

-- Add new columns
ALTER TABLE public.sap_cache_pedidos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'PV',
  ADD COLUMN IF NOT EXISTS vendedor text DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'Venda',
  ADD COLUMN IF NOT EXISTS nf_num integer,
  ADD COLUMN IF NOT EXISTS nf_entry integer,
  ADD COLUMN IF NOT EXISTS entrega_data date,
  ADD COLUMN IF NOT EXISTS status_pedido text DEFAULT 'Pedido';

-- Composite unique index (doc_entry + origem to allow same doc_entry from different sources)
CREATE UNIQUE INDEX idx_cache_pedidos_doc_entry_origem ON public.sap_cache_pedidos (doc_entry, origem);

-- Filter indexes
CREATE INDEX idx_cache_pedidos_status ON public.sap_cache_pedidos (status_pedido);
CREATE INDEX idx_cache_pedidos_vendedor ON public.sap_cache_pedidos (vendedor);
CREATE INDEX idx_cache_pedidos_uf ON public.sap_cache_pedidos (uf);
CREATE INDEX idx_cache_pedidos_tipo ON public.sap_cache_pedidos (tipo);
