-- SAP Sync Health Monitoring: log table for sync results
CREATE TABLE public.sap_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',  -- 'ok' | 'partial' | 'error' | 'running'
  synced_count int DEFAULT 0,
  error_count int DEFAULT 0,
  errors jsonb DEFAULT '[]',
  triggered_by text DEFAULT 'pg_cron'      -- 'pg_cron' | 'manual'
);

-- RLS: frontend can read, service_role can write
ALTER TABLE public.sap_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.sap_sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service write" ON public.sap_sync_log FOR ALL TO service_role USING (true);

CREATE INDEX idx_sync_log_started ON public.sap_sync_log (started_at DESC);
