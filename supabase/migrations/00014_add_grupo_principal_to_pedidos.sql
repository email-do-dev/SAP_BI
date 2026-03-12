-- Add grupo_principal column to sap_cache_pedidos for product group filtering
ALTER TABLE sap_cache_pedidos ADD COLUMN IF NOT EXISTS grupo_principal text DEFAULT 'Outros';
