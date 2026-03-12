-- Add header detail fields to sap_cache_pedidos so detail dialog can read from cache
ALTER TABLE public.sap_cache_pedidos
  ADD COLUMN IF NOT EXISTS cond_pagamento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS doc_cur text DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS doc_due_date date,
  ADD COLUMN IF NOT EXISTS address2 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS comments text DEFAULT '';
