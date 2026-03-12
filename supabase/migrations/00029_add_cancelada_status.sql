-- Add 'cancelada' to shipment_status enum
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'cancelada';
