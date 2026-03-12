import { useMemo } from 'react'
import { DollarSign, Clock, Percent, Landmark } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts'
import { KpiCard } from '@/components/shared/kpi-card'
import { KpiSkeleton } from '@/components/shared/loading-skeleton'
import { DashboardSection } from '@/components/shared/dashboard-section'
import { ChartCard } from '@/components/shared/chart-card'
import { ErrorCard } from '@/components/shared/error-card'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import type { Database } from '@/types/database'

type Aging = Database['public']['Tables']['sap_cache_financeiro_aging']['Row']
type Margem = Database['public']['Tables']['sap_cache_financeiro_margem']['Row']
type Cashflow = Database['public']['Tables']['sap_cache_financeiro_cashflow']['Row']
type Ciclo = Database['public']['Tables']['sap_cache_financeiro_ciclo']['Row']
type AppSetting = Database['public']['Tables']['app_settings']['Row']

const AGING_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#dc2626']

interface Props {
  filters: ReturnType<typeof useDashboardFilters>
}

export function AreaFinanceiro({ filters }: Props) {
  const { filterData, filterComparisonData, compareValues, comparison } = filters

  const { data: agingData, isLoading: agingLoading, isError: agingErr, refetch: agingRefetch } = useCacheQuery<Aging[]>('sap_cache_financeiro_aging')
  const { data: margemData, isLoading: margemLoading, isError: margemErr, refetch: margemRefetch } = useCacheQuery<Margem[]>('sap_cache_financeiro_margem', { order: 'mes', ascending: true })
  const { data: cashflowData, isLoading: cfLoading, isError: cfErr, refetch: cfRefetch } = useCacheQuery<Cashflow[]>('sap_cache_financeiro_cashflow', { order: 'due_date', ascending: true })
  const { data: cicloData, isLoading: cicloLoading, isError: cicloErr, refetch: cicloRefetch } = useCacheQuery<Ciclo[]>('sap_cache_financeiro_ciclo', { limit: 1 })
  const { data: settings } = useCacheQuery<AppSetting[]>('app_settings')

  const hasError = agingErr || margemErr || cfErr || cicloErr

  const goals = useMemo(() => {
    if (!settings) return {} as Record<string, number>
    const map: Record<string, number> = {}
    for (const s of settings) map[s.key] = Number(s.value)
    return map
  }, [settings])

  const cr = agingData?.find((a) => a.tipo === 'CR')
  const cp = agingData?.find((a) => a.tipo === 'CP')
  const ciclo = cicloData?.[0]

  const filteredMargem = useMemo(() => filterData(margemData ?? [], 'mes'), [margemData, filterData])
  const compMargem = useMemo(() => filterComparisonData(margemData ?? [], 'mes'), [margemData, filterComparisonData])

  const margemAvg = useMemo(() => {
    if (!filteredMargem.length) return 0
    return filteredMargem.reduce((s, m) => s + Number(m.margem_pct), 0) / filteredMargem.length
  }, [filteredMargem])

  const prevMargemAvg = useMemo(() => {
    if (!compMargem.length) return 0
    return compMargem.reduce((s, m) => s + Number(m.margem_pct), 0) / compMargem.length
  }, [compMargem])

  const margemTrend = comparison !== 'none' && compMargem.length > 0 ? compareValues(margemAvg, prevMargemAvg) : null
  const compLabel = comparison === 'prev_year' ? 'vs ano anterior' : comparison === 'prev_period' ? 'vs período anterior' : ''
  const margemSparkline = useMemo(() => filteredMargem.map((m) => Number(m.margem_pct)), [filteredMargem])

  const agingCrChart = useMemo(() => {
    if (!cr) return []
    return [{ name: 'CR', a_vencer: Number(cr.a_vencer), '1-30': Number(cr.vencido_1_30), '31-60': Number(cr.vencido_31_60), '61-90': Number(cr.vencido_61_90), '90+': Number(cr.vencido_90_mais) }]
  }, [cr])

  const agingCpChart = useMemo(() => {
    if (!cp) return []
    return [{ name: 'CP', a_vencer: Number(cp.a_vencer), '1-30': Number(cp.vencido_1_30), '31-60': Number(cp.vencido_31_60), '61-90': Number(cp.vencido_61_90), '90+': Number(cp.vencido_90_mais) }]
  }, [cp])

  if (hasError) {
    return (
      <DashboardSection title="Financeiro" icon={<Landmark size={20} />}>
        <ErrorCard message="Erro ao carregar dados financeiros" onRetry={() => { agingRefetch(); margemRefetch(); cfRefetch(); cicloRefetch() }} />
      </DashboardSection>
    )
  }

  return (
    <DashboardSection title="Financeiro" icon={<Landmark size={20} />}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {agingLoading || cicloLoading ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard title="CR Total" value={formatCurrency(Number(cr?.total_aberto ?? 0))} icon={<DollarSign size={20} />} description="Contas a Receber em aberto" />
            <KpiCard title="CP Total" value={formatCurrency(Number(cp?.total_aberto ?? 0))} icon={<DollarSign size={20} />} description="Contas a Pagar em aberto" />
            <KpiCard
              title="Ciclo de Caixa"
              value={`${formatNumber(Number(ciclo?.ciclo ?? 0))} dias`}
              icon={<Clock size={20} />}
              description={`PMR ${formatNumber(Number(ciclo?.pmr ?? 0))}d + PME ${formatNumber(Number(ciclo?.pme ?? 0))}d - PMP ${formatNumber(Number(ciclo?.pmp ?? 0))}d`}
              goal={goals.meta_ciclo_caixa ? { current: goals.meta_ciclo_caixa, target: Number(ciclo?.ciclo ?? 0) || goals.meta_ciclo_caixa, label: `Meta: ${goals.meta_ciclo_caixa} dias` } : undefined}
            />
            <KpiCard
              title="Margem Média"
              value={formatPercent(margemAvg)}
              icon={<Percent size={20} />}
              sparklineData={margemSparkline}
              trend={margemTrend ? { value: margemTrend.pct, label: compLabel } : undefined}
              goal={goals.meta_margem_pct ? { current: margemAvg, target: goals.meta_margem_pct } : undefined}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Aging CR (Contas a Receber)" loading={agingLoading} isEmpty={agingCrChart.length === 0} emptyMessage="Sem dados de contas a receber">
          <BarChart data={agingCrChart} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
            <Bar dataKey="a_vencer" stackId="a" fill={AGING_COLORS[0]} name="A Vencer" />
            <Bar dataKey="1-30" stackId="a" fill={AGING_COLORS[1]} name="1-30d" />
            <Bar dataKey="31-60" stackId="a" fill={AGING_COLORS[2]} name="31-60d" />
            <Bar dataKey="61-90" stackId="a" fill={AGING_COLORS[3]} name="61-90d" />
            <Bar dataKey="90+" stackId="a" fill={AGING_COLORS[4]} name="90+d" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Aging CP (Contas a Pagar)" loading={agingLoading} isEmpty={agingCpChart.length === 0} emptyMessage="Sem dados de contas a pagar">
          <BarChart data={agingCpChart} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
            <Bar dataKey="a_vencer" stackId="a" fill={AGING_COLORS[0]} name="A Vencer" />
            <Bar dataKey="1-30" stackId="a" fill={AGING_COLORS[1]} name="1-30d" />
            <Bar dataKey="31-60" stackId="a" fill={AGING_COLORS[2]} name="31-60d" />
            <Bar dataKey="61-90" stackId="a" fill={AGING_COLORS[3]} name="61-90d" />
            <Bar dataKey="90+" stackId="a" fill={AGING_COLORS[4]} name="90+d" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Margem Mensal" loading={margemLoading} isEmpty={filteredMargem.length === 0}>
          <LineChart data={filteredMargem}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
            <Line type="monotone" dataKey="margem_pct" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Fluxo de Caixa (90 dias)" loading={cfLoading} isEmpty={!cashflowData?.length}>
          <AreaChart data={cashflowData ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="due_date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
            <Area type="monotone" dataKey="receber" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Receber" />
            <Area type="monotone" dataKey="pagar" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="Pagar" />
          </AreaChart>
        </ChartCard>
      </div>
    </DashboardSection>
  )
}
