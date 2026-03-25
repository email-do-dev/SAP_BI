-- Fix pallet columns to numeric(10,1) to support fractional pallets
ALTER TABLE public.sap_cache_pedidos ADD COLUMN IF NOT EXISTS total_pallets integer DEFAULT 0;
ALTER TABLE public.sap_cache_pedidos ALTER COLUMN total_pallets TYPE numeric(10,1);
ALTER TABLE public.shipments ALTER COLUMN total_pallets TYPE numeric(10,1);
ALTER TABLE public.shipment_items ALTER COLUMN pallet_count TYPE numeric(10,1);
