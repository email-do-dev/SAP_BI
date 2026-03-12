import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { formatNumber } from '@/lib/utils'
import { KpiSkeleton, ChartSkeleton } from '@/components/shared/loading-skeleton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OrdemRow {
  id: string
  doc_entry: number
  doc_num: number
  item_code: string
  item_name: string
  planned_qty: number
  completed_qty: number
  rejected_qty: number
  status: string
  warehouse: string
  create_date: string | null
  start_date: string | null
  due_date: string
  close_date: string | null
  eficiencia_pct: number | null
  num_components: number
  refreshed_at: string
}

interface PlanejadoVsReal {
  mes: string
  planejado: number
  realizado: number
}

interface ConsumoMP {
  item_code: string
  item_name: string
  planned_qty: number
  issued_qty: number
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const COLORS = ['#1e40af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TabDashboard() {
  const { data: ordens, isLoading: loadingOrdens } = useCacheQuery<OrdemRow[]>('sap_cache_producao_ordens_lista')
  const { data: planejado, isLoading: loadingPlanejado } = useCacheQuery<PlanejadoVsReal[]>(
    'sap_cache_producao_planejado_vs_real',
    { order: 'mes', ascending: true }
  )
  const { data: consumo, isLoading: loadingConsumo } = useCacheQuery<ConsumoMP[]>(
    'sap_cache_producao_consumo_mp',
    { order: 'issued_qty', ascending: false, limit: 10 }
  )

  // --- KPI calculations ---
  const kpis = useMemo(() => {
    if (!ordens) return null

    const abertas = ordens.filter((o) => o.status !== 'Encerrada').length
    const encerradas = ordens.filter((o) => o.status === 'Encerrada')
    const eficienciaMedia =
      encerradas.length > 0
        ? encerradas.reduce((sum, o) => sum + (o.eficiencia_pct ?? 0), 0) / encerradas.length
        : 0

    const now = new Date()
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const producaoMes = ordens
      .filter((o) => o.due_date?.startsWith(mesAtual))
      .reduce((sum, o) => sum + (o.completed_qty ?? 0), 0)

    return {
      abertas,
      eficienciaMedia: Math.round(eficienciaMedia * 10) / 10,
      producaoMes,
      oee: Math.round(eficienciaMedia * 10) / 10,
    }
  }, [ordens])

  // --- OEE Trend (monthly from ordens_lista) ---
  const oeeTrend = useMemo(() => {
    if (!ordens) return []

    const byMonth = new Map<string, { sum: number; count: number }>()
    for (const o of ordens) {
      if (o.status !== 'Encerrada' || o.eficiencia_pct == null) continue
      const mes = o.due_date?.substring(0, 7)
      if (!mes) continue
      const entry = byMonth.get(mes) ?? { sum: 0, count: 0 }
      entry.sum += o.eficiencia_pct
      entry.count += 1
      byMonth.set(mes, entry)
    }

    return Array.from(byMonth.entries())
      .map(([mes, { sum, count }]) => ({
        mes,
        oee: Math.round((sum / count) * 10) / 10,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
  }, [ordens])

  // --- Status distribution (PieChart) ---
  const statusDist = useMemo(() => {
    if (!ordens) return []

    const counts = new Map<string, number>()
    for (const o of ordens) {
      counts.set(o.status, (counts.get(o.status) ?? 0) + 1)
    }

    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
  }, [ordens])

  const isLoading = loadingOrdens || loadingPlanejado || loadingConsumo

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !kpis ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">OPs Abertas</p>
              <p className="mt-2 text-3xl font-bold">{formatNumber(kpis.abertas)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Planejadas + Liberadas</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Eficiencia Media</p>
              <p className="mt-2 text-3xl font-bold">{kpis.eficienciaMedia}%</p>
              <p className="mt-1 text-xs text-muted-foreground">OPs encerradas</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Producao Total Mes</p>
              <p className="mt-2 text-3xl font-bold">{formatNumber(kpis.producaoMes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Quantidade produzida</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">OEE Aproximado</p>
              <p className="mt-2 text-3xl font-bold">{kpis.oee}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Eficiencia global</p>
            </div>
          </>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Planejado vs Realizado */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">Planejado vs Realizado</h3>
          {loadingPlanejado ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={planejado ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(Number(v))} />
                <Tooltip formatter={(v) => formatNumber(Number(v))} />
                <Legend />
                <Bar dataKey="planejado" name="Planejado" fill="#1e40af" radius={[4, 4, 0, 0]} />
                <Bar dataKey="realizado" name="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Consumo MP */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">Top Consumo de Materia-Prima</h3>
          {loadingConsumo ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={consumo ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(Number(v))} />
                <YAxis
                  dataKey="item_name"
                  type="category"
                  width={120}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => (v.length > 18 ? `${v.substring(0, 18)}...` : v)}
                />
                <Tooltip formatter={(v) => formatNumber(Number(v))} />
                <Bar dataKey="issued_qty" name="Consumo" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* OEE Trend */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">Tendencia OEE Mensal</h3>
          {loadingOrdens ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={oeeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${Number(v)}%`} />
                <Line
                  type="monotone"
                  dataKey="oee"
                  name="OEE %"
                  stroke="#1e40af"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribuicao OPs por Status */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">Distribuicao de OPs por Status</h3>
          {loadingOrdens ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={({ name, percent }: any) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {statusDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatNumber(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
