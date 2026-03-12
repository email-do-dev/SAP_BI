import { useMemo } from 'react'
import { Truck, CheckCircle, AlertTriangle, DollarSign } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { KpiCard } from '@/components/shared/kpi-card'
import { KpiSkeleton } from '@/components/shared/loading-skeleton'
import { DashboardSection } from '@/components/shared/dashboard-section'
import { ChartCard } from '@/components/shared/chart-card'
import { ErrorCard } from '@/components/shared/error-card'
import { EmptyState } from '@/components/shared/empty-state'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import type { Database } from '@/types/database'

type Entrega = Database['public']['Tables']['sap_cache_entregas']['Row']
type CustoLog = Database['public']['Tables']['sap_cache_custo_logistico']['Row']

const PIE_COLORS = ['#10b981', '#f59e0b']

interface Props {
  filters: ReturnType<typeof useDashboardFilters>
}

export function AreaLogistica({ filters }: Props) {
  const { filterData, filterComparisonData, compareValues, comparison } = filters

  const { data: entregas, isLoading: entLoading, isError: entErr, refetch: entRefetch } = useCacheQuery<Entrega[]>('sap_cache_entregas')
  const { data: custoLog, isLoading: clLoading, isError: clErr, refetch: clRefetch } = useCacheQuery<CustoLog[]>('sap_cache_custo_logistico', { order: 'mes', ascending: true })

  const hasError = entErr || clErr
  const isLoading = entLoading || clLoading

  const filteredEntregas = useMemo(() => filterData(entregas ?? [], 'doc_date'), [entregas, filterData])
  const compEntregas = useMemo(() => filterComparisonData(entregas ?? [], 'doc_date'), [entregas, filterComparisonData])
  const filteredCusto = useMemo(() => filterData(custoLog ?? [], 'mes'), [custoLog, filterData])

  const concluidas = useMemo(() => filteredEntregas.filter((e) => e.doc_status === 'C').length, [filteredEntregas])
  const pendentes = useMemo(() => filteredEntregas.filter((e) => e.doc_status === 'O').length, [filteredEntregas])
  const total = concluidas + pendentes
  const taxaEntrega = total > 0 ? (concluidas / total) * 100 : 0

  const prevConcluidas = useMemo(() => compEntregas.filter((e) => e.doc_status === 'C').length, [compEntregas])
  const prevTotal = useMemo(() => compEntregas.length, [compEntregas])
  const prevTaxa = prevTotal > 0 ? (prevConcluidas / prevTotal) * 100 : 0

  const custoTotal = useMemo(() => filteredCusto.reduce((s, c) => s + Number(c.custo_total), 0), [filteredCusto])

  const taxaTrend = comparison !== 'none' && prevTotal > 0 ? compareValues(taxaEntrega, prevTaxa) : null
  const compLabel = comparison === 'prev_year' ? 'vs ano anterior' : comparison === 'prev_period' ? 'vs período anterior' : ''

  const statusData = useMemo(() => [
    { name: 'Entregue', value: concluidas },
    { name: 'Pendente', value: pendentes },
  ], [concluidas, pendentes])

  // Entregas per month
  const entregasMensal = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const e of filteredEntregas) {
      const mes = String(e.doc_date).substring(0, 7)
      grouped[mes] = (grouped[mes] ?? 0) + 1
    }
    return Object.entries(grouped)
      .map(([mes, qtd]) => ({ mes, qtd }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
  }, [filteredEntregas])

  if (hasError) {
    return (
      <DashboardSection title="Logística" icon={<Truck size={20} />}>
        <ErrorCard message="Erro ao carregar dados de logística" onRetry={() => { entRefetch(); clRefetch() }} />
      </DashboardSection>
    )
  }

  return (
    <DashboardSection title="Logística" icon={<Truck size={20} />}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard title="Entregas Pendentes" value={formatNumber(pendentes)} icon={<AlertTriangle size={20} />} />
            <KpiCard title="Entregas Concluídas" value={formatNumber(concluidas)} icon={<CheckCircle size={20} />} />
            <KpiCard
              title="Taxa de Entrega"
              value={formatPercent(taxaEntrega)}
              icon={<Truck size={20} />}
              trend={taxaTrend ? { value: taxaTrend.pct, label: compLabel } : undefined}
            />
            <KpiCard title="Custo Logístico" value={formatCurrency(custoTotal)} icon={<DollarSign size={20} />} description={custoTotal === 0 ? 'Sem lançamentos no período' : 'No período'} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Status de Entregas" loading={entLoading} isEmpty={filteredEntregas.length === 0}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>

        <ChartCard title="Entregas por Mês" loading={entLoading} isEmpty={entregasMensal.length === 0}>
          <BarChart data={entregasMensal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="qtd" fill="#1e40af" name="Entregas" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        {!clLoading && filteredCusto.length > 0 ? (
          <ChartCard title="Custo Logístico Mensal" loading={false}>
            <BarChart data={filteredCusto}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="frete_proprio" stackId="a" fill="#1e40af" name="Frete Próprio" />
              <Bar dataKey="frete_terceiro" stackId="a" fill="#f59e0b" name="Frete Terceiro" />
              <Bar dataKey="descarga" stackId="a" fill="#10b981" name="Descarga" />
            </BarChart>
          </ChartCard>
        ) : !clLoading ? (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">Custo Logístico Mensal</h3>
            <EmptyState message="Sem lançamentos de custo logístico. Cadastre custos na página Custo Logístico." />
          </div>
        ) : null}
      </div>
    </DashboardSection>
  )
}
