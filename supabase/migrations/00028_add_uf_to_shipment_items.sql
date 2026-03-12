-- Add UF column to shipment_items for destination tracking
ALTER TABLE public.shipment_items ADD COLUMN IF NOT EXISTS uf text DEFAULT '';

-- Backfill from sap_cache_pedidos
UPDATE public.shipment_items si
SET uf = COALESCE(p.uf, '')
FROM public.sap_cache_pedidos p
WHERE si.doc_entry = p.doc_entry AND (si.uf IS NULL OR si.uf = '');
