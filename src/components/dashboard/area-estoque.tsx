import { useMemo } from 'react'
import { Package, AlertTriangle } from 'lucide-react'
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
import type { Database } from '@/types/database'

type Deposito = Database['public']['Tables']['sap_cache_estoque_deposito']['Row']
type Valorizacao = Database['public']['Tables']['sap_cache_estoque_valorizacao']['Row']
type AbaixoMin = Database['public']['Tables']['sap_cache_estoque_abaixo_minimo']['Row']

export function AreaEstoque() {
  const { data: depositoData, isLoading: depLoading, isError: depErr, refetch: depRefetch } = useCacheQuery<Deposito[]>('sap_cache_estoque_deposito', { order: 'valor', ascending: false })
  const { data: valorizacaoData, isLoading: valLoading, isError: valErr, refetch: valRefetch } = useCacheQuery<Valorizacao[]>('sap_cache_estoque_valorizacao', { order: 'valor', ascending: false })
  const { data: abaixoMinData, isLoading: minLoading, isError: minErr, refetch: minRefetch } = useCacheQuery<AbaixoMin[]>('sap_cache_estoque_abaixo_minimo', { order: 'diferenca', ascending: false })

  const hasError = depErr || valErr || minErr
  const isLoading = depLoading || valLoading || minLoading

  const estoqueTotal = useMemo(() => {
    if (!depositoData?.length) return 0
    return depositoData.reduce((s, d) => s + Number(d.valor), 0)
  }, [depositoData])

  if (hasError) {
    return (
      <DashboardSection title="Estoque" icon={<Package size={20} />}>
        <ErrorCard message="Erro ao carregar dados de estoque" onRetry={() => { depRefetch(); valRefetch(); minRefetch() }} />
      </DashboardSection>
    )
  }

  return (
    <DashboardSection title="Estoque" icon={<Package size={20} />}>
      <p className="text-xs text-muted-foreground -mt-2">Dados atuais (snapshot) — não filtrados por período</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard title="Valor Total em Estoque" value={formatCurrency(estoqueTotal)} icon={<Package size={20} />} />
            <KpiCard
              title="Itens Abaixo do Mínimo"
              value={formatNumber(abaixoMinData?.length ?? 0)}
              icon={<AlertTriangle size={20} />}
              description={abaixoMinData?.length === 0 ? 'Todos acima do mínimo ou sem nível configurado' : 'Precisam reposição'}
            />
            <KpiCard title="Depósitos Ativos" value={formatNumber(depositoData?.length ?? 0)} icon={<Package size={20} />} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Estoque por Depósito" loading={depLoading} isEmpty={!depositoData?.length}>
          <BarChart data={depositoData ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="deposito" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Bar dataKey="valor" fill="#1e40af" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Estoque por Grupo" loading={valLoading} isEmpty={!valorizacaoData?.length}>
          <BarChart data={(valorizacaoData ?? []).slice(0, 15)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="grupo" width={120} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Bar dataKey="valor" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      {!minLoading && abaixoMinData && abaixoMinData.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Itens Abaixo do Mínimo</h3>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Grupo</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Estoque</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Mínimo</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Falta</th>
                </tr>
              </thead>
              <tbody>
                {abaixoMinData.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 truncate max-w-[200px]" title={item.item_name}>{item.item_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.grupo}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(Number(item.estoque))}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(Number(item.minimo))}</td>
                    <td className="px-3 py-2 text-right text-destructive font-medium">{formatNumber(Number(item.diferenca))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !minLoading ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Itens Abaixo do Mínimo</h3>
          <EmptyState message="Nenhum item abaixo do mínimo — todos OK ou sem nível mínimo configurado no SAP" className="py-4" />
        </div>
      ) : null}
    </DashboardSection>
  )
}
