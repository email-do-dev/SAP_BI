-- Add nf_date (NF issue date) to sap_cache_pedidos
-- This aligns Dashboard Comercial faturamento filtering with Dashboard Geral (both use NF issue date)
ALTER TABLE sap_cache_pedidos ADD COLUMN IF NOT EXISTS nf_date date;
