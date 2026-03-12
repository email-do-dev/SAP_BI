-- Cache table for document line items (PV/NF/EN) to avoid live SAP queries on detail view
CREATE TABLE public.sap_cache_pedido_linhas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_entry integer NOT NULL,
  origem text NOT NULL CHECK (origem IN ('PV', 'NF', 'EN')),
  line_num integer NOT NULL,
  item_code text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  quantidade numeric(18,6) DEFAULT 0,
  preco numeric(18,6) DEFAULT 0,
  total_linha numeric(18,2) DEFAULT 0,
  refreshed_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX idx_cache_pedido_linhas_key ON public.sap_cache_pedido_linhas (doc_entry, origem, line_num);
CREATE INDEX idx_cache_pedido_linhas_doc ON public.sap_cache_pedido_linhas (doc_entry, origem);

ALTER TABLE public.sap_cache_pedido_linhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_pedido_linhas" ON public.sap_cache_pedido_linhas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write_pedido_linhas" ON public.sap_cache_pedido_linhas FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
