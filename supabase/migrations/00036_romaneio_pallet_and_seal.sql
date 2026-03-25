-- Add pallet tracking and seal fields to shipments
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS seal_number text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS seal_photo_path text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pallets_data jsonb DEFAULT '[]'::jsonb;
