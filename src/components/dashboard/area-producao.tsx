import { useMemo } from 'react'
import { Factory, Percent } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import { KpiCard } from '@/components/shared/kpi-card'
import { KpiSkeleton } from '@/components/shared/loading-skeleton'
import { DashboardSection } from '@/components/shared/dashboard-section'
import { ChartCard } from '@/components/shared/chart-card'
import { ErrorCard } from '@/components/shared/error-card'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { formatNumber, formatPercent, formatCurrency } from '@/lib/utils'
import type { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import type { Database } from '@/types/database'

type ProdOrdem = Database['public']['Tables']['sap_cache_producao_ordens']['Row']
type ProdConsumo = Database['public']['Tables']['sap_cache_producao_consumo_mp']['Row']
type ProdPlanReal = Database['public']['Tables']['sap_cache_producao_planejado_vs_real']['Row']

interface Props {
  filters: ReturnType<typeof useDashboardFilters>
}

export function AreaProducao({ filters }: Props) {
  const { filterData, filterComparisonData, compareValues, comparison } = filters

  const { data: prodOrdens, isLoading: poLoading, isError: poErr, refetch: poRefetch } = useCacheQuery<ProdOrdem[]>('sap_cache_producao_ordens')
  const { data: prodConsumo, isLoading: pcLoading, isError: pcErr, refetch: pcRefetch } = useCacheQuery<ProdConsumo[]>('sap_cache_producao_consumo_mp', { order: 'valor', ascending: false, limit: 20 })
  const { data: prodPlanReal, isLoading: prLoading, isError: prErr, refetch: prRefetch } = useCacheQuery<ProdPlanReal[]>('sap_cache_producao_planejado_vs_real', { order: 'mes', ascending: true })

  const hasError = poErr || pcErr || prErr
  const isLoading = poLoading || pcLoading || prLoading

  const filteredPlanReal = useMemo(() => filterData(prodPlanReal ?? [], 'mes'), [prodPlanReal, filterData])
  const compPlanReal = useMemo(() => filterComparisonData(prodPlanReal ?? [], 'mes'), [prodPlanReal, filterComparisonData])

  const opsAbertas = useMemo(() => {
    if (!prodOrdens?.length) return 0
    return prodOrdens.filter((o) => o.status !== 'Encerrada').reduce((s, o) => s + Number(o.qtd), 0)
  }, [prodOrdens])

  const eficienciaMedia = useMemo(() => {
    if (!filteredPlanReal.length) return 0
    return filteredPlanReal.reduce((s, p) => s + Number(p.eficiencia_pct), 0) / filteredPlanReal.length
  }, [filteredPlanReal])

  const prevEficiencia = useMemo(() => {
    if (!compPlanReal.length) return 0
    return compPlanReal.reduce((s, p) => s + Number(p.eficiencia_pct), 0) / compPlanReal.length
  }, [compPlanReal])

  const producaoTotal = useMemo(() => {
    return filteredPlanReal.reduce((s, p) => s + Number(p.realizado), 0)
  }, [filteredPlanReal])

  const efTrend = comparison !== 'none' && compPlanReal.length > 0 ? compareValues(eficienciaMedia, prevEficiencia) : null
  const compLabel = comparison === 'prev_year' ? 'vs ano anterior' : comparison === 'prev_period' ? 'vs período anterior' : ''
  const efSparkline = useMemo(() => filteredPlanReal.map((p) => Number(p.eficiencia_pct)), [filteredPlanReal])

  if (hasError) {
    return (
      <DashboardSection title="Produção" icon={<Factory size={20} />}>
        <ErrorCard message="Erro ao carregar dados de produção" onRetry={() => { poRefetch(); pcRefetch(); prRefetch() }} />
      </DashboardSection>
    )
  }

  return (
    <DashboardSection title="Produção" icon={<Factory size={20} />}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard title="OPs Abertas" value={formatNumber(opsAbertas)} icon={<Factory size={20} />} description="Planejadas + Liberadas" />
            <KpiCard
              title="Eficiência Média"
              value={formatPercent(eficienciaMedia)}
              icon={<Percent size={20} />}
              sparklineData={efSparkline}
              trend={efTrend ? { value: efTrend.pct, label: compLabel } : undefined}
            />
            <KpiCard title="Produção Total" value={formatNumber(producaoTotal)} icon={<Factory size={20} />} description="Qtd realizada no período" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Planejado vs Realizado" loading={prLoading} isEmpty={filteredPlanReal.length === 0}>
          <BarChart data={filteredPlanReal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
            <Tooltip formatter={(v) => formatNumber(Number(v))} />
            <Legend />
            <Bar dataKey="planejado" fill="#1e40af" name="Planejado" radius={[4, 4, 0, 0]} />
            <Bar dataKey="realizado" fill="#10b981" name="Realizado" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top Consumo de Matéria-Prima" loading={pcLoading} isEmpty={!prodConsumo?.length}>
          <BarChart data={(prodConsumo ?? []).slice(0, 10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="item_name" width={140} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Bar dataKey="valor" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </DashboardSection>
  )
}
