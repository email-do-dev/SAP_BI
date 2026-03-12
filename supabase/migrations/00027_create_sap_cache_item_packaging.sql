-- Cache table for SAP OITM item packaging/palletization data
CREATE TABLE public.sap_cache_item_packaging (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code text NOT NULL,
  item_name text NOT NULL,
  boxes_per_pallet integer NOT NULL DEFAULT 0,
  box_weight_kg numeric(10,3) DEFAULT 0,
  box_volume_m3 numeric(10,6) DEFAULT 0,
  pallet_weight_kg numeric(10,2) DEFAULT 0,
  refreshed_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX idx_sap_cache_item_packaging_item ON public.sap_cache_item_packaging (item_code);

-- RLS
ALTER TABLE public.sap_cache_item_packaging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON public.sap_cache_item_packaging FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write" ON public.sap_cache_item_packaging FOR ALL USING (auth.role() = 'service_role');
