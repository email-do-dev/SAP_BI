CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role all" ON public.app_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value, description) VALUES
  ('meta_faturamento_mensal', '8000000', 'Meta de faturamento mensal (R$)'),
  ('meta_margem_pct', '25', 'Meta de margem bruta (%)'),
  ('meta_producao_diaria', '95000', 'Meta de produção diária (latas)'),
  ('meta_ciclo_caixa', '45', 'Meta de ciclo de caixa (dias)')
ON CONFLICT (key) DO NOTHING;
