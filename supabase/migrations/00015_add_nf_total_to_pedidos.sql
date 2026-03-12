-- Add nf_total column to store OINV.DocTotal for invoiced orders
ALTER TABLE sap_cache_pedidos ADD COLUMN IF NOT EXISTS nf_total numeric;
