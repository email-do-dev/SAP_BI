import { useMemo } from 'react'
import { ShoppingCart, DollarSign, Truck, RotateCcw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell
} from 'recharts'
import { KpiCard } from '@/components/shared/kpi-card'
import { KpiSkeleton } from '@/components/shared/loading-skeleton'
import { DashboardSection } from '@/components/shared/dashboard-section'
import { ChartCard } from '@/components/shared/chart-card'
import { ErrorCard } from '@/components/shared/error-card'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import type { Database } from '@/types/database'

type Entrega = Database['public']['Tables']['sap_cache_entregas']['Row']
type Canal = Database['public']['Tables']['sap_cache_financeiro_canal']['Row']
type TopCliente = Database['public']['Tables']['sap_cache_financeiro_top_clientes']['Row']
type KpiMensal = Database['public']['Tables']['sap_cache_dashboard_kpis_mensal']['Row']
type AppSetting = Database['public']['Tables']['app_settings']['Row']

const PIE_COLORS = ['#10b981', '#f59e0b']

interface Props {
  filters: ReturnType<typeof useDashboardFilters>
}

export function AreaGeral({ filters }: Props) {
  const { filterData, filterComparisonData, compareValues, comparison } = filters

  // Data fetches
  const { data: kpiMensal, isLoading: kpiMLoad, isError: kpiErr, refetch: kpiRefetch } = useCacheQuery<KpiMensal[]>('sap_cache_dashboard_kpis_mensal')
  const { data: faturamento, isLoading: fatLoading, isError: fatErr, refetch: fatRefetch } = useCacheQuery<Array<{ mes: string; valor: number }>>('sap_cache_faturamento_mensal', { order: 'mes', ascending: true })
  const { data: entregas, isLoading: entLoading, isError: entErr, refetch: entRefetch } = useCacheQuery<Entrega[]>('sap_cache_entregas')
  const { data: canalData, isLoading: canalLoading, isError: canalErr, refetch: canalRefetch } = useCacheQuery<Canal[]>('sap_cache_financeiro_canal')
  const { data: topClientes, isLoading: tcLoading, isError: tcErr, refetch: tcRefetch } = useCacheQuery<TopCliente[]>('sap_cache_financeiro_top_clientes')
  const { data: settings } = useCacheQuery<AppSetting[]>('app_settings')

  const hasError = kpiErr || fatErr || entErr || canalErr || tcErr
  const isLoading = kpiMLoad || fatLoading || entLoading || canalLoading || tcLoading

  const goals = useMemo(() => {
    if (!settings) return {} as Record<string, number>
    const map: Record<string, number> = {}
    for (const s of settings) map[s.key] = Number(s.value)
    return map
  }, [settings])

  // Filter faturamento by period
  const filteredFat = useMemo(() => filterData(faturamento ?? [], 'mes'), [faturamento, filterData])
  // Aggregate KPIs from monthly data
  const kpis = useMemo(() => {
    const filtered = filterData(kpiMensal ?? [], 'mes')
    const pedidos = filtered.filter((r) => r.metric === 'pedidos').reduce((s, r) => s + Number(r.valor), 0)
    const fat = filtered.filter((r) => r.metric === 'faturamento').reduce((s, r) => s + Number(r.valor), 0)
    const devol = filtered.filter((r) => r.metric === 'devolucoes').reduce((s, r) => s + Number(r.valor), 0)
    const entregasCount = filtered.filter((r) => r.metric === 'entregas').reduce((s, r) => s + Number(r.valor), 0)
    return { pedidos, fat, devol, entregas: entregasCount }
  }, [kpiMensal, filterData])

  const prevKpis = useMemo(() => {
    if (comparison === 'none') return null
    const filtered = filterComparisonData(kpiMensal ?? [], 'mes')
    const pedidos = filtered.filter((r) => r.metric === 'pedidos').reduce((s, r) => s + Number(r.valor), 0)
    const fat = filtered.filter((r) => r.metric === 'faturamento').reduce((s, r) => s + Number(r.valor), 0)
    const devol = filtered.filter((r) => r.metric === 'devolucoes').reduce((s, r) => s + Number(r.valor), 0)
    return { pedidos, fat, devol }
  }, [kpiMensal, filterComparisonData, comparison])

  // Sparkline data from faturamento
  const fatSparkline = useMemo(() => filteredFat.map((r) => Number(r.valor)), [filteredFat])

  // Filter entregas by period
  const filteredEntregas = useMemo(() => filterData(entregas ?? [], 'doc_date'), [entregas, filterData])
  const deliveryStatusData = useMemo(() => {
    const entregue = filteredEntregas.filter((e) => e.doc_status === 'C').length
    const pendente = filteredEntregas.filter((e) => e.doc_status === 'O').length
    return [{ name: 'Entregue', value: entregue }, { name: 'Pendente', value: pendente }]
  }, [filteredEntregas])

  // Canal aggregated by period
  const filteredCanal = useMemo(() => {
    const filtered = filterData(canalData ?? [], 'mes')
    const grouped: Record<string, number> = {}
    for (const r of filtered) {
      const key = r.canal
      grouped[key] = (grouped[key] ?? 0) + Number(r.valor_total)
    }
    return Object.entries(grouped)
      .map(([canal, valor_total]) => ({ canal, valor_total }))
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 10)
  }, [canalData, filterData])

  // Top clientes aggregated by period
  const filteredTopClientes = useMemo(() => {
    const filtered = filterData(topClientes ?? [], 'mes')
    const grouped: Record<string, { card_name: string; valor_total: number }> = {}
    for (const r of filtered) {
      if (!grouped[r.card_code]) grouped[r.card_code] = { card_name: r.card_name, valor_total: 0 }
      grouped[r.card_code].valor_total += Number(r.valor_total)
    }
    return Object.values(grouped)
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 10)
  }, [topClientes, filterData])

  // Pending entregas count (not period-filtered — it's current state)
  const pendentes = useMemo(() => (entregas ?? []).filter((e) => e.doc_status === 'O').length, [entregas])

  const fatTrend = prevKpis ? compareValues(kpis.fat, prevKpis.fat) : null
  const pedTrend = prevKpis ? compareValues(kpis.pedidos, prevKpis.pedidos) : null
  const devTrend = prevKpis ? compareValues(kpis.devol, prevKpis.devol) : null
  const compLabel = comparison === 'prev_year' ? 'vs ano anterior' : comparison === 'prev_period' ? 'vs período anterior' : ''

  if (hasError) {
    return (
      <DashboardSection title="Visão Geral" icon={<ShoppingCart size={20} />}>
        <ErrorCard
          message="Erro ao carregar dados da visão geral"
          onRetry={() => { kpiRefetch(); fatRefetch(); entRefetch(); canalRefetch(); tcRefetch() }}
        />
      </DashboardSection>
    )
  }

  return (
    <>
      <DashboardSection title="Visão Geral" icon={<ShoppingCart size={20} />}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />) : (
            <>
              <KpiCard
                title="Faturamento"
                value={formatCurrency(kpis.fat)}
                icon={<DollarSign size={20} />}
                sparklineData={fatSparkline}
                trend={fatTrend ? { value: fatTrend.pct, label: compLabel } : undefined}
                goal={goals.meta_faturamento_mensal ? { current: kpis.fat, target: goals.meta_faturamento_mensal } : undefined}
              />
              <KpiCard
                title="Pedidos"
                value={formatNumber(kpis.pedidos)}
                icon={<ShoppingCart size={20} />}
                trend={pedTrend ? { value: pedTrend.pct, label: compLabel } : undefined}
              />
              <KpiCard
                title="Entregas Pendentes"
                value={formatNumber(pendentes)}
                icon={<Truck size={20} />}
                description="Situação atual"
              />
              <KpiCard
                title="Devoluções"
                value={formatNumber(kpis.devol)}
                icon={<RotateCcw size={20} />}
                trend={devTrend ? { value: devTrend.pct, label: compLabel } : undefined}
              />
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Faturamento Mensal" loading={fatLoading} isEmpty={filteredFat.length === 0}>
            <BarChart data={filteredFat}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="valor" fill="#1e40af" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Top 10 Clientes" loading={tcLoading} isEmpty={filteredTopClientes.length === 0}>
            <BarChart data={filteredTopClientes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="card_name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="valor_total" fill="#1e40af" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Vendas por Canal" loading={canalLoading} isEmpty={filteredCanal.length === 0}>
            <BarChart data={filteredCanal} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="canal" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="valor_total" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Status de Entregas" loading={entLoading} isEmpty={filteredEntregas.length === 0}>
            <PieChart>
              <Pie data={deliveryStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {deliveryStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ChartCard>
        </div>
      </DashboardSection>
    </>
  )
}
