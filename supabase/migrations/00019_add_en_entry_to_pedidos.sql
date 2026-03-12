-- Add en_entry column to track which ODLN DocEntry each row references
-- This enables deduplication: extra deliveries per PV (beyond TOP 1) can be
-- excluded from entregas_sem_pedido by checking en_entry in pedidos_ordem.
ALTER TABLE sap_cache_pedidos ADD COLUMN en_entry integer;
