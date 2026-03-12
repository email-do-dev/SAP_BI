import { useMemo } from 'react'
import { ShoppingBag, DollarSign, AlertTriangle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'
import { KpiCard } from '@/components/shared/kpi-card'
import { KpiSkeleton } from '@/components/shared/loading-skeleton'
import { DashboardSection } from '@/components/shared/dashboard-section'
import { ChartCard } from '@/components/shared/chart-card'
import { ErrorCard } from '@/components/shared/error-card'
import { EmptyState } from '@/components/shared/empty-state'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import type { Database } from '@/types/database'

type ComprasAbertas = Database['public']['Tables']['sap_cache_compras_abertas']['Row']
type ComprasMes = Database['public']['Tables']['sap_cache_compras_mes']['Row']
type LeadTime = Database['public']['Tables']['sap_cache_compras_lead_time']['Row']

interface Props {
  filters: ReturnType<typeof useDashboardFilters>
}

export function AreaCompras({ filters }: Props) {
  const { filterData } = filters

  const { data: comprasAb, isLoading: caLoading, isError: caErr, refetch: caRefetch } = useCacheQuery<ComprasAbertas[]>('sap_cache_compras_abertas', { limit: 1 })
  const { data: comprasMes, isLoading: cmLoading, isError: cmErr, refetch: cmRefetch } = useCacheQuery<ComprasMes[]>('sap_cache_compras_mes', { order: 'mes', ascending: true })
  const { data: leadTimeData, isLoading: ltLoading, isError: ltErr, refetch: ltRefetch } = useCacheQuery<LeadTime[]>('sap_cache_compras_lead_time', { order: 'lead_time_medio', ascending: false })

  const hasError = caErr || cmErr || ltErr

  const comprasAbRow = comprasAb?.[0]
  const filteredComprasMes = useMemo(() => filterData(comprasMes ?? [], 'mes'), [comprasMes, filterData])

  if (hasError) {
    return (
      <DashboardSection title="Compras" icon={<ShoppingBag size={20} />}>
        <ErrorCard message="Erro ao carregar dados de compras" onRetry={() => { caRefetch(); cmRefetch(); ltRefetch() }} />
      </DashboardSection>
    )
  }

  return (
    <DashboardSection title="Compras" icon={<ShoppingBag size={20} />}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {caLoading ? Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard title="POs Abertas" value={formatNumber(comprasAbRow?.total ?? 0)} icon={<ShoppingBag size={20} />} />
            <KpiCard title="Valor POs" value={formatCurrency(Number(comprasAbRow?.valor ?? 0))} icon={<DollarSign size={20} />} />
            <KpiCard title="Atrasados" value={formatNumber(comprasAbRow?.atrasados ?? 0)} icon={<AlertTriangle size={20} />} description={`${formatCurrency(Number(comprasAbRow?.valor_atrasados ?? 0))} em atraso`} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Compras Mensal" loading={cmLoading} isEmpty={filteredComprasMes.length === 0} emptyMessage="Sem dados de compras no período">
          <BarChart data={filteredComprasMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Bar dataKey="valor" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Lead Time Fornecedores</h3>
          {ltLoading ? (
            <div className="h-[280px] animate-pulse rounded bg-muted" />
          ) : !leadTimeData?.length ? (
            <EmptyState message="Sem dados de lead time — necessário recebimentos vinculados a pedidos de compra" className="py-4" />
          ) : (
            <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Fornecedor</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Médio</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Mín</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Máx</th>
                  </tr>
                </thead>
                <tbody>
                  {leadTimeData.map((lt) => (
                    <tr key={lt.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 truncate max-w-[200px]" title={lt.fornecedor}>{lt.fornecedor}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatNumber(Number(lt.lead_time_medio))}d</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{formatNumber(Number(lt.lead_time_min))}d</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{formatNumber(Number(lt.lead_time_max))}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardSection>
  )
}
