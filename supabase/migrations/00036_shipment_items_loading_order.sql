-- Add loading_order column to shipment_items for LIFO loading sequence
ALTER TABLE public.shipment_items ADD COLUMN IF NOT EXISTS loading_order integer;
