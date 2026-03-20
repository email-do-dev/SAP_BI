-- ============================================================
-- Logging System: 4 new tables + ALTER sap_sync_log
-- ============================================================

-- 1. Audit Logs — Who did what (login, CRUD, export, navigation)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,          -- 'login' | 'logout' | 'view' | 'create' | 'update' | 'delete' | 'export' | 'print' | 'navigate'
  resource text,                 -- 'pedidos' | 'entregas' | 'usuarios' | etc.
  resource_id text,              -- ID or doc_entry of the affected record
  metadata jsonb DEFAULT '{}',   -- extra context (filters used, export row count, etc.)
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diretoria read audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'diretoria'
    )
  );
CREATE POLICY "Service write audit_logs" ON public.audit_logs
  FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at DESC);

-- 2. Frontend Error Logs — JS/React errors in production
CREATE TABLE public.frontend_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_type text NOT NULL,      -- 'unhandled_error' | 'unhandled_rejection' | 'error_boundary' | 'lazy_retry_fail' | 'chunk_load_error'
  message text NOT NULL,
  stack text,
  component_stack text,          -- React component stack from ErrorBoundary
  url text,                      -- page URL where the error occurred
  metadata jsonb DEFAULT '{}',   -- browser info, route params, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.frontend_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diretoria read frontend_error_logs" ON public.frontend_error_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'diretoria'
    )
  );
CREATE POLICY "Service write frontend_error_logs" ON public.frontend_error_logs
  FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated insert frontend_error_logs" ON public.frontend_error_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_frontend_errors_type ON public.frontend_error_logs (error_type, created_at DESC);
CREATE INDEX idx_frontend_errors_created ON public.frontend_error_logs (created_at DESC);

-- 3. Edge Function Logs — Performance and errors from Edge Functions
CREATE TABLE public.edge_function_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,   -- 'sap-query' | 'sap-sync' | 'create-user' | 'manage-users' | 'route-calc' | 'import-ocr' | 'diag-chain' | 'log-cleanup'
  status text NOT NULL,          -- 'ok' | 'error' | 'timeout'
  duration_ms integer,
  request_method text,           -- 'GET' | 'POST' | 'OPTIONS'
  request_path text,
  request_body_summary jsonb,    -- sanitized summary (no secrets)
  response_status integer,       -- HTTP status code
  error_message text,
  error_stack text,
  user_id uuid,
  metadata jsonb DEFAULT '{}',   -- query name, table counts, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diretoria read edge_function_logs" ON public.edge_function_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'diretoria'
    )
  );
CREATE POLICY "Service write edge_function_logs" ON public.edge_function_logs
  FOR ALL TO service_role USING (true);

CREATE INDEX idx_edge_fn_logs_function ON public.edge_function_logs (function_name, created_at DESC);
CREATE INDEX idx_edge_fn_logs_status ON public.edge_function_logs (status, created_at DESC);
CREATE INDEX idx_edge_fn_logs_created ON public.edge_function_logs (created_at DESC);

-- 4. Security Logs — Login/logout, failures, access denied
CREATE TABLE public.security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  event_type text NOT NULL,      -- 'login_success' | 'login_failure' | 'logout' | 'access_denied' | 'session_expired' | 'password_reset'
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}',   -- failed reason, denied route, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diretoria read security_logs" ON public.security_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'diretoria'
    )
  );
CREATE POLICY "Service write security_logs" ON public.security_logs
  FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated insert security_logs" ON public.security_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_security_logs_user ON public.security_logs (user_id, created_at DESC);
CREATE INDEX idx_security_logs_event ON public.security_logs (event_type, created_at DESC);
CREATE INDEX idx_security_logs_created ON public.security_logs (created_at DESC);

-- 5. ALTER sap_sync_log — add duration_ms and table_details
ALTER TABLE public.sap_sync_log
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS table_details jsonb DEFAULT '[]';
-- table_details format: [{ "table": "sap_cache_pedidos", "upserted": 120, "deleted": 5, "duration_ms": 1200 }, ...]

-- 6. Cleanup function for pg_cron (called by log-cleanup Edge Function)
CREATE OR REPLACE FUNCTION public.count_old_logs(retention_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff timestamptz := now() - (retention_days || ' days')::interval;
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'audit_logs', (SELECT count(*) FROM public.audit_logs WHERE created_at < cutoff),
    'frontend_error_logs', (SELECT count(*) FROM public.frontend_error_logs WHERE created_at < cutoff),
    'edge_function_logs', (SELECT count(*) FROM public.edge_function_logs WHERE created_at < cutoff),
    'security_logs', (SELECT count(*) FROM public.security_logs WHERE created_at < cutoff),
    'sap_sync_log', (SELECT count(*) FROM public.sap_sync_log WHERE started_at < cutoff),
    'cutoff_date', cutoff
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_old_logs(retention_days integer DEFAULT 31)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff timestamptz := now() - (retention_days || ' days')::interval;
  d1 integer; d2 integer; d3 integer; d4 integer; d5 integer;
BEGIN
  DELETE FROM public.audit_logs WHERE created_at < cutoff;
  GET DIAGNOSTICS d1 = ROW_COUNT;

  DELETE FROM public.frontend_error_logs WHERE created_at < cutoff;
  GET DIAGNOSTICS d2 = ROW_COUNT;

  DELETE FROM public.edge_function_logs WHERE created_at < cutoff;
  GET DIAGNOSTICS d3 = ROW_COUNT;

  DELETE FROM public.security_logs WHERE created_at < cutoff;
  GET DIAGNOSTICS d4 = ROW_COUNT;

  DELETE FROM public.sap_sync_log WHERE started_at < cutoff;
  GET DIAGNOSTICS d5 = ROW_COUNT;

  RETURN jsonb_build_object(
    'audit_logs', d1,
    'frontend_error_logs', d2,
    'edge_function_logs', d3,
    'security_logs', d4,
    'sap_sync_log', d5,
    'cutoff_date', cutoff
  );
END;
$$;
