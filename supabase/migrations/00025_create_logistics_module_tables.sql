-- ============================================================
-- Migration 00025: Logistics Module Core Tables
-- Vehicles, drivers, operators, item packaging, shipments,
-- shipment items, return requests, tracking events
-- ============================================================

-- Enums
CREATE TYPE public.shipment_status AS ENUM (
  'programada',
  'em_expedicao',
  'expedida',
  'em_transito',
  'entregue_parcial',
  'entregue',
  'finalizada'
);

CREATE TYPE public.return_request_status AS ENUM (
  'solicitada',
  'em_aprovacao',
  'aprovada',
  'nf_emitida',
  'retornada',
  'descartada',
  'fechada'
);

-- ============================================================
-- Logistics Operators (must be created before vehicles)
-- ============================================================
CREATE TABLE public.logistics_operators (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  cnpj text UNIQUE,
  contact_name text,
  contact_phone text,
  regions text[] DEFAULT '{}',
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================
-- Vehicles
-- ============================================================
CREATE TABLE public.vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plate text NOT NULL UNIQUE,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('carreta', 'bitruck', 'toco', 'truck', '3/4')),
  ownership text NOT NULL DEFAULT 'own' CHECK (ownership IN ('own', 'spot')),
  operator_id uuid REFERENCES public.logistics_operators ON DELETE SET NULL,
  max_weight_kg numeric(10,2),
  max_volume_m3 numeric(10,2),
  max_pallets integer,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================
-- Drivers
-- ============================================================
CREATE TABLE public.drivers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  cpf text UNIQUE,
  phone text,
  license_type text CHECK (license_type IN ('B', 'C', 'D', 'E')),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================
-- Item Packaging (palletization)
-- Phase 1: Supabase. Phase 2: migrate to SAP UDF U_CxPallet
-- ============================================================
CREATE TABLE public.item_packaging (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code text NOT NULL UNIQUE,
  item_name text NOT NULL,
  boxes_per_pallet integer NOT NULL DEFAULT 1,
  box_weight_kg numeric(10,3),
  box_volume_m3 numeric(10,6),
  pallet_weight_kg numeric(10,2),
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================
-- Shipments (cargas / romaneios)
-- ============================================================
CREATE TABLE public.shipments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  status public.shipment_status NOT NULL DEFAULT 'programada',
  delivery_date date NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles NOT NULL,
  driver_id uuid REFERENCES public.drivers,
  operator_id uuid REFERENCES public.logistics_operators,
  total_weight_kg numeric(10,2) DEFAULT 0,
  total_volume_m3 numeric(10,2) DEFAULT 0,
  total_pallets integer DEFAULT 0,
  total_value numeric(18,2) DEFAULT 0,
  total_boxes integer DEFAULT 0,
  notes text,
  -- Expedition (Tab 2)
  expedition_verified_by uuid REFERENCES auth.users,
  expedition_verified_at timestamptz,
  loading_photo_path text,
  vehicle_photo_path text,
  -- Timeline
  departed_at timestamptz,
  completed_at timestamptz,
  -- Audit
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_shipments_status ON public.shipments (status);
CREATE INDEX idx_shipments_delivery_date ON public.shipments (delivery_date);
CREATE INDEX idx_shipments_vehicle ON public.shipments (vehicle_id);

-- Auto-generate reference: CARGA-YYYY-NNN
CREATE OR REPLACE FUNCTION public.generate_shipment_reference()
RETURNS trigger AS $$
DECLARE
  seq_num integer;
  year_str text;
BEGIN
  year_str := to_char(NEW.delivery_date, 'YYYY');
  SELECT COALESCE(MAX(
    CAST(split_part(reference, '-', 3) AS integer)
  ), 0) + 1
  INTO seq_num
  FROM public.shipments
  WHERE reference LIKE 'CARGA-' || year_str || '-%';

  NEW.reference := 'CARGA-' || year_str || '-' || lpad(seq_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_shipment_reference
  BEFORE INSERT ON public.shipments
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION public.generate_shipment_reference();

-- ============================================================
-- Shipment Items (NFs within a shipment)
-- ============================================================
CREATE TABLE public.shipment_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id uuid REFERENCES public.shipments ON DELETE CASCADE NOT NULL,
  -- SAP document reference
  doc_entry integer NOT NULL,
  doc_num integer,
  origem text NOT NULL DEFAULT 'NF' CHECK (origem IN ('PV', 'NF')),
  card_code text NOT NULL,
  card_name text NOT NULL,
  doc_total numeric(18,2) NOT NULL DEFAULT 0,
  -- Weight/volume/pallets
  weight_kg numeric(10,2),
  volume_m3 numeric(10,2),
  pallet_count numeric(6,2) DEFAULT 0,
  box_count integer DEFAULT 0,
  -- Delivery type
  delivery_type text NOT NULL DEFAULT 'direct' CHECK (delivery_type IN ('direct', 'operator')),
  operator_id uuid REFERENCES public.logistics_operators,
  -- Expedition verification (Tab 2)
  verified boolean DEFAULT false,
  lot_numbers text,
  verified_qty jsonb,
  -- Delivery confirmation (Tab 4)
  delivery_status text NOT NULL DEFAULT 'pendente' CHECK (delivery_status IN ('pendente', 'entregue', 'devolvido_parcial', 'devolvido_total')),
  delivered_at timestamptz,
  canhoto_storage_path text,
  cte_doc_entry integer,
  cte_value numeric(18,2),
  unloading_cost numeric(18,2) DEFAULT 0,
  delivery_notes text,
  -- Operator leg (2-leg delivery)
  operator_delivered boolean DEFAULT false,
  operator_delivered_at timestamptz,
  operator_expected_days integer,
  -- Audit
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX idx_shipment_items_unique ON public.shipment_items (shipment_id, doc_entry);
CREATE INDEX idx_shipment_items_shipment ON public.shipment_items (shipment_id);
CREATE INDEX idx_shipment_items_delivery_status ON public.shipment_items (delivery_status);
CREATE INDEX idx_shipment_items_doc_entry ON public.shipment_items (doc_entry);

-- ============================================================
-- Return Requests
-- ============================================================
CREATE TABLE public.return_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  status public.return_request_status NOT NULL DEFAULT 'solicitada',
  -- Source
  shipment_item_id uuid REFERENCES public.shipment_items ON DELETE SET NULL,
  original_doc_entry integer,
  original_doc_num integer,
  card_code text NOT NULL,
  card_name text NOT NULL,
  -- Reason
  reason text NOT NULL,
  requested_by_type text NOT NULL CHECK (requested_by_type IN ('driver', 'client')),
  requested_by_name text,
  -- Approval
  approved_by uuid REFERENCES auth.users,
  approved_at timestamptz,
  rejection_reason text,
  -- SAP linkage
  sap_return_doc_entry integer,
  sap_credit_doc_entry integer,
  -- Physical return
  physical_status text DEFAULT 'pendente' CHECK (physical_status IN ('pendente', 'em_transito', 'recebido_fabrica', 'descartado')),
  physical_notes text,
  -- Items
  items jsonb NOT NULL DEFAULT '[]',
  total_value numeric(18,2) DEFAULT 0,
  -- Audit
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_return_requests_status ON public.return_requests (status);

-- Auto-generate reference: DEV-YYYY-NNN
CREATE OR REPLACE FUNCTION public.generate_return_reference()
RETURNS trigger AS $$
DECLARE
  seq_num integer;
  year_str text;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(split_part(reference, '-', 3) AS integer)
  ), 0) + 1
  INTO seq_num
  FROM public.return_requests
  WHERE reference LIKE 'DEV-' || year_str || '-%';

  NEW.reference := 'DEV-' || year_str || '-' || lpad(seq_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_return_reference
  BEFORE INSERT ON public.return_requests
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION public.generate_return_reference();

-- ============================================================
-- Shipment Tracking Events
-- ============================================================
CREATE TABLE public.shipment_tracking_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id uuid REFERENCES public.shipments ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('departure', 'arrival_operator', 'delivery', 'delay', 'incident', 'note')),
  shipment_item_id uuid REFERENCES public.shipment_items ON DELETE SET NULL,
  location text,
  description text NOT NULL,
  reported_by text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_tracking_events_shipment ON public.shipment_tracking_events (shipment_id);

-- ============================================================
-- RLS Policies
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  -- Tables readable by authenticated, writable by logistica + diretoria
  FOR t IN SELECT unnest(ARRAY[
    'vehicles',
    'drivers',
    'logistics_operators',
    'item_packaging',
    'shipments',
    'shipment_items',
    'return_requests',
    'shipment_tracking_events'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Read: any authenticated user
    EXECUTE format(
      'CREATE POLICY "Authenticated can read %1$s" ON public.%1$I FOR SELECT USING (auth.role() = ''authenticated'')',
      t
    );

    -- Insert: logistica or diretoria
    EXECUTE format(
      'CREATE POLICY "Logistica/diretoria can insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (
        public.has_role(auth.uid(), ''logistica'') OR public.has_role(auth.uid(), ''diretoria'')
      )',
      t
    );

    -- Update: logistica or diretoria
    EXECUTE format(
      'CREATE POLICY "Logistica/diretoria can update %1$s" ON public.%1$I FOR UPDATE USING (
        public.has_role(auth.uid(), ''logistica'') OR public.has_role(auth.uid(), ''diretoria'')
      )',
      t
    );

    -- Delete: diretoria only
    EXECUTE format(
      'CREATE POLICY "Diretoria can delete %1$s" ON public.%1$I FOR DELETE USING (
        public.has_role(auth.uid(), ''diretoria'')
      )',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- Storage Buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('delivery-proofs', 'delivery-proofs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('shipment-photos', 'shipment-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload/read
CREATE POLICY "Authenticated users can upload delivery proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('delivery-proofs', 'shipment-photos') AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read delivery proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('delivery-proofs', 'shipment-photos') AND auth.role() = 'authenticated');

-- Note: Vehicles, drivers, and operators should be registered
-- via the admin UI after migration. No seed data needed.
