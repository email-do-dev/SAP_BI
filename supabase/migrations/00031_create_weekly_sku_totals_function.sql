-- RPC function to get weekly SKU totals from scheduled shipments
CREATE OR REPLACE FUNCTION public.get_weekly_sku_totals(
  p_week_start date,
  p_week_end date
)
RETURNS TABLE (
  item_code text,
  descricao text,
  qty_dom numeric,
  qty_seg numeric,
  qty_ter numeric,
  qty_qua numeric,
  qty_qui numeric,
  qty_sex numeric,
  qty_sab numeric,
  total_semana numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pl.item_code,
    pl.descricao,
    COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM s.delivery_date::date) = 0 THEN pl.quantidade END), 0) as qty_dom,
    COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM s.delivery_date::date) = 1 THEN pl.quantidade END), 0) as qty_seg,
    COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM s.delivery_date::date) = 2 THEN pl.quantidade END), 0) as qty_ter,
    COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM s.delivery_date::date) = 3 THEN pl.quantidade END), 0) as qty_qua,
    COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM s.delivery_date::date) = 4 THEN pl.quantidade END), 0) as qty_qui,
    COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM s.delivery_date::date) = 5 THEN pl.quantidade END), 0) as qty_sex,
    COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM s.delivery_date::date) = 6 THEN pl.quantidade END), 0) as qty_sab,
    COALESCE(SUM(pl.quantidade), 0) as total_semana
  FROM public.shipment_items si
  INNER JOIN public.shipments s ON s.id = si.shipment_id
  INNER JOIN public.sap_cache_pedido_linhas pl ON pl.doc_entry = si.doc_entry AND pl.origem = 'PV'
  WHERE s.delivery_date::date >= p_week_start
    AND s.delivery_date::date <= p_week_end
    AND s.status <> 'cancelada'
  GROUP BY pl.item_code, pl.descricao
  ORDER BY COALESCE(SUM(pl.quantidade), 0) DESC;
$$;
