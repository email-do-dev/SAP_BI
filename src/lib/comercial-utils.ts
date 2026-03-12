import { filterByDateRange } from '@/lib/utils'
import type { Database } from '@/types/database'

type Pedido = Database['public']['Tables']['sap_cache_pedidos']['Row']

export const EXCLUDED_STATUSES = ['Cancelado', 'Estorno']

export function computeIndependentKpis(data: Pedido[], from: string, to: string) {
  const active = data.filter((p) => !EXCLUDED_STATUSES.includes(p.status_pedido))

  // Pedidos: PV origin, filtered by doc_date
  const pedidoRows = filterByDateRange(
    active.filter((p) => p.origem === 'PV') as Record<string, unknown>[],
    'doc_date', from, to
  ) as Pedido[]
  const pedidos = { count: pedidoRows.length, total: pedidoRows.reduce((s, p) => s + Number(p.doc_total), 0) }

  // Faturamento: any origin with nf_date, filtered by nf_date
  const fatRows = filterByDateRange(
    active.filter((p) => p.nf_date) as Record<string, unknown>[],
    'nf_date', from, to
  ) as Pedido[]
  const faturamento = { count: fatRows.length, total: fatRows.reduce((s, p) => s + Number(p.faturamento_liquido ?? p.nf_total ?? p.doc_total), 0) }

  // Entregas: any origin with entrega_data, filtered by entrega_data
  const entRows = filterByDateRange(
    active.filter((p) => p.entrega_data) as Record<string, unknown>[],
    'entrega_data', from, to
  ) as Pedido[]
  const entregas = { count: entRows.length, total: entRows.reduce((s, p) => s + Number(p.nf_total ?? p.doc_total), 0) }

  return { pedidos, faturamento, entregas }
}
