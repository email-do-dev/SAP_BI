-- Add estorno (credit memo / ORIN) columns to sap_cache_pedidos
ALTER TABLE sap_cache_pedidos ADD COLUMN IF NOT EXISTS estorno_num integer;
ALTER TABLE sap_cache_pedidos ADD COLUMN IF NOT EXISTS estorno_entry integer;
ALTER TABLE sap_cache_pedidos ADD COLUMN IF NOT EXISTS estorno_date date;
