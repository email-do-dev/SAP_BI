-- Add estorno_total and faturamento_liquido columns to sap_cache_pedidos
ALTER TABLE sap_cache_pedidos ADD COLUMN IF NOT EXISTS estorno_total numeric DEFAULT 0;
ALTER TABLE sap_cache_pedidos ADD COLUMN IF NOT EXISTS faturamento_liquido numeric;

-- Remove old estorno columns that are no longer needed
ALTER TABLE sap_cache_pedidos DROP COLUMN IF EXISTS estorno_num;
ALTER TABLE sap_cache_pedidos DROP COLUMN IF EXISTS estorno_entry;
ALTER TABLE sap_cache_pedidos DROP COLUMN IF EXISTS estorno_date;
