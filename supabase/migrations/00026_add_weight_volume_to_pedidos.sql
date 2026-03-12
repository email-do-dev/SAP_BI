-- ============================================================
-- Migration 00026: Add weight/volume to sap_cache_pedidos
-- Used by logistics Tab 1 for shipment capacity planning
-- ============================================================

ALTER TABLE public.sap_cache_pedidos
  ADD COLUMN IF NOT EXISTS total_weight_kg numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_volume_m3 numeric(10,6) DEFAULT 0;
