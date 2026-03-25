-- ============================================================================
-- Production Module — Phase 1 (MVP)
-- Cache table for production orders list + app-owned registration/PCP tables
-- ============================================================================

-- 1. Role 'producao' was added in 00032b_add_producao_role.sql

-- 2. Cache table — Production orders list (per-order, not aggregated)
CREATE TABLE IF NOT EXISTS sap_cache_producao_ordens_lista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_entry integer NOT NULL,
  doc_num integer,
  status text,
  item_code text,
  item_name text,
  warehouse text,
  planned_qty numeric DEFAULT 0,
  completed_qty numeric DEFAULT 0,
  rejected_qty numeric DEFAULT 0,
  create_date date,
  start_date date,
  due_date date,
  close_date date,
  eficiencia_pct numeric DEFAULT 0,
  num_components integer DEFAULT 0,
  refreshed_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_producao_ordens_lista_doc_entry
  ON sap_cache_producao_ordens_lista (doc_entry);

ALTER TABLE sap_cache_producao_ordens_lista ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sap_cache_producao_ordens_lista_select"
  ON sap_cache_producao_ordens_lista FOR SELECT TO authenticated USING (true);

CREATE POLICY "sap_cache_producao_ordens_lista_service"
  ON sap_cache_producao_ordens_lista FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Production Lines
CREATE TABLE IF NOT EXISTS production_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  line_type text NOT NULL CHECK (line_type IN ('conserva', 'congelado', 'salgado', 'farinha')),
  capacity_per_hour numeric DEFAULT 0,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_lines_select"
  ON production_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_lines_insert"
  ON production_lines FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_lines_update"
  ON production_lines FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_lines_delete"
  ON production_lines FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'diretoria'));

-- 4. Production Steps
CREATE TABLE IF NOT EXISTS production_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
  name text NOT NULL,
  sequence integer NOT NULL,
  is_checkpoint boolean DEFAULT false,
  estimated_duration_min integer DEFAULT 0,
  description text,
  is_active boolean DEFAULT true,
  UNIQUE(line_id, sequence)
);

ALTER TABLE production_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_steps_select"
  ON production_steps FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_steps_insert"
  ON production_steps FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_steps_update"
  ON production_steps FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_steps_delete"
  ON production_steps FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'diretoria'));

-- 5. Production Shifts
CREATE TABLE IF NOT EXISTS production_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE production_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_shifts_select"
  ON production_shifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_shifts_insert"
  ON production_shifts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_shifts_update"
  ON production_shifts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_shifts_delete"
  ON production_shifts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'diretoria'));

-- 6. Production Line ↔ Shift assignments
CREATE TABLE IF NOT EXISTS production_line_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES production_shifts(id) ON DELETE CASCADE,
  UNIQUE(line_id, shift_id)
);

ALTER TABLE production_line_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_line_shifts_select"
  ON production_line_shifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_line_shifts_insert"
  ON production_line_shifts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_line_shifts_update"
  ON production_line_shifts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_line_shifts_delete"
  ON production_line_shifts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'diretoria'));

-- 7. Stop Reasons
CREATE TABLE IF NOT EXISTS production_stop_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('mecanica', 'eletrica', 'falta_mp', 'setup', 'limpeza', 'qualidade', 'outros')),
  is_active boolean DEFAULT true
);

ALTER TABLE production_stop_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_stop_reasons_select"
  ON production_stop_reasons FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_stop_reasons_insert"
  ON production_stop_reasons FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_stop_reasons_update"
  ON production_stop_reasons FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_stop_reasons_delete"
  ON production_stop_reasons FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'diretoria'));

-- 8. Production Teams
CREATE TABLE IF NOT EXISTS production_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('lider', 'operador', 'auxiliar')),
  is_active boolean DEFAULT true
);

ALTER TABLE production_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_teams_select"
  ON production_teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_teams_insert"
  ON production_teams FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_teams_update"
  ON production_teams FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_teams_delete"
  ON production_teams FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'diretoria'));

-- 9. Team → Line/Shift assignments
CREATE TABLE IF NOT EXISTS production_team_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES production_teams(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES production_shifts(id) ON DELETE CASCADE,
  valid_from date DEFAULT CURRENT_DATE,
  valid_until date
);

ALTER TABLE production_team_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_team_assignments_select"
  ON production_team_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_team_assignments_insert"
  ON production_team_assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_team_assignments_update"
  ON production_team_assignments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "production_team_assignments_delete"
  ON production_team_assignments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'diretoria'));

-- 10. PCP Daily Plans
CREATE TABLE IF NOT EXISTS pcp_daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_date date NOT NULL,
  line_id uuid NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES production_shifts(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  item_name text NOT NULL,
  planned_qty numeric NOT NULL DEFAULT 0,
  sequence_order integer NOT NULL DEFAULT 1,
  sap_wo_doc_entry integer,
  notes text,
  status text NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado', 'em_andamento', 'concluido', 'cancelado')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_date, line_id, shift_id, sequence_order)
);

ALTER TABLE pcp_daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcp_daily_plans_select"
  ON pcp_daily_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "pcp_daily_plans_insert"
  ON pcp_daily_plans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "pcp_daily_plans_update"
  ON pcp_daily_plans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));

CREATE POLICY "pcp_daily_plans_delete"
  ON pcp_daily_plans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'producao') OR public.has_role(auth.uid(), 'diretoria'));
