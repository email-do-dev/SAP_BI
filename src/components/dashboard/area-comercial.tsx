import { useMemo, useState } from 'react'
import { ShoppingCart, FileText, Truck, ClipboardList, PackageCheck, RotateCcw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { KpiCard } from '@/components/shared/kpi-card'
import { KpiSkeleton } from '@/components/shared/loading-skeleton'
import { DashboardSection } from '@/components/shared/dashboard-section'
import { ChartCard } from '@/components/shared/chart-card'
import { ErrorCard } from '@/components/shared/error-card'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { formatCurrency, formatNumber, formatPercent, filterByDateRange } from '@/lib/utils'
import { EXCLUDED_STATUSES, computeIndependentKpis } from '@/lib/comercial-utils'
import type { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import type { Database } from '@/types/database'

type Pedido = Database['public']['Tables']['sap_cache_pedidos']['Row']
type GrupoSku = Database['public']['Tables']['sap_cache_comercial_grupo_sku']['Row']

const STATUS_COLORS: Record<string, string> = { Pedido: '#1e40af', Faturado: '#10b981', Entregue: '#f59e0b', Cancelado: '#ef4444', Estorno: '#f97316' }

const selectClass = 'rounded-md border border-border bg-card px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring'

interface DashComercialFilters {
  vendedor: string
  uf: string
  canal: string
  grupo: string
}
// teste
const emptyFilters: DashComercialFilters = { vendedor: '', uf: '', canal: '', grupo: '' }

interface Props {
  filters: ReturnType<typeof useDashboardFilters>
}

export function AreaComercial({ filters }: Props) {
  const { filterData, compareValues, comparison, dateRange } = filters
  const [bizFilters, setBizFilters] = useState<DashComercialFilters>(emptyFilters)

  const { data: pedidos, isLoading: pedLoading, isError: pedErr, refetch: pedRefetch } = useCacheQuery<Pedido[]>('sap_cache_pedidos')
  const { data: grupoSkuData, isLoading: skuLoading, isError: skuErr, refetch: skuRefetch } = useCacheQuery<GrupoSku[]>('sap_cache_comercial_grupo_sku', { order: 'mes', ascending: true })

  const hasError = pedErr || skuErr
  const isLoading = pedLoading

  // Filter options derived from data
  const filterOptions = useMemo(() => {
    if (!pedidos) return { vendedores: [], ufs: [], canais: [] }
    const vendedores = [...new Set(pedidos.map((p) => p.vendedor).filter(Boolean))].sort()
    const ufs = [...new Set(pedidos.map((p) => p.uf).filter(Boolean))].sort()
    const canais = [...new Set(pedidos.map((p) => p.canal).filter(Boolean))].sort()
    return { vendedores, ufs, canais }
  }, [pedidos])

  // Apply business filters
  const businessFiltered = useMemo(() => {
    if (!pedidos) return []
    return pedidos.filter((p) => {
      if (bizFilters.vendedor && p.vendedor !== bizFilters.vendedor) return false
      if (bizFilters.uf && p.uf !== bizFilters.uf) return false
      if (bizFilters.canal && p.canal !== bizFilters.canal) return false
      if (bizFilters.grupo && p.grupo_principal !== bizFilters.grupo) return false
      return true
    })
  }, [pedidos, bizFilters])

  const filteredPedidos = useMemo(() => filterData(businessFiltered as Record<string, unknown>[], 'doc_date') as Pedido[], [businessFiltered, filterData])

  // KPIs — line 1 (date-dependent with trend)
  const kpis = useMemo(
    () => computeIndependentKpis(businessFiltered, dateRange.from, dateRange.to),
    [businessFiltered, dateRange]
  )
  const compKpis = useMemo(
    () => {
      if (comparison === 'none') return null
      const compRange = filters.comparisonRange
      return computeIndependentKpis(businessFiltered, compRange.from, compRange.to)
    },
    [businessFiltered, comparison, filters.comparisonRange]
  )

  const compLabel = comparison === 'prev_year' ? 'vs ano anterior' : comparison === 'prev_period' ? 'vs período anterior' : ''
  const pedidoTrend = compKpis ? compareValues(kpis.pedidos.total, compKpis.pedidos.total) : null
  const faturadoTrend = compKpis ? compareValues(kpis.faturamento.total, compKpis.faturamento.total) : null
  const entregueTrend = compKpis ? compareValues(kpis.entregas.total, compKpis.entregas.total) : null

  // KPIs — line 2 (date-independent + estornos)
  const carteiraTotal = useMemo(() => {
    return businessFiltered
      .filter(p => p.status_pedido === 'Pedido')
      .reduce((sum, p) => sum + Number(p.doc_total), 0)
  }, [businessFiltered])

  const pendenteEntregaTotal = useMemo(() => {
    return businessFiltered
      .filter(p => p.status_pedido === 'Faturado')
      .reduce((sum, p) => sum + Number(p.nf_total ?? p.doc_total), 0)
  }, [businessFiltered])

  const estornosTotal = useMemo(() => {
    const rows = filterByDateRange(
      businessFiltered as Record<string, unknown>[],
      'nf_date', dateRange.from, dateRange.to
    ) as Pedido[]
    return rows.reduce((sum, p) => sum + Number(p.estorno_total || 0), 0)
  }, [businessFiltered, dateRange])

  // Charts — Receita por vendedor (uses NF date)
  const invoicedInPeriod = useMemo(() => {
    const active = businessFiltered.filter(p => !EXCLUDED_STATUSES.includes(p.status_pedido))
    return (filterData(active as Record<string, unknown>[], 'nf_date') as Pedido[])
  }, [businessFiltered, filterData])

  const receitaPorVendedor = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const p of invoicedInPeriod) {
      const key = p.vendedor || 'Sem vendedor'
      grouped[key] = (grouped[key] ?? 0) + Number(p.nf_total ?? p.doc_total)
    }
    return Object.entries(grouped)
      .map(([vendedor, valor]) => ({ vendedor, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)
  }, [invoicedInPeriod])

  const receitaPorUF = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const p of invoicedInPeriod) {
      const key = p.uf || 'N/D'
      grouped[key] = (grouped[key] ?? 0) + Number(p.nf_total ?? p.doc_total)
    }
    return Object.entries(grouped)
      .map(([uf, valor]) => ({ uf, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)
  }, [invoicedInPeriod])

  // SKU group analysis
  const filteredSkuData = useMemo(() => {
    return filterData(grupoSkuData ?? [], 'mes') as GrupoSku[]
  }, [grupoSkuData, filterData])

  const skuMixData = useMemo(() => {
    const grouped: Record<string, { receita: number; volume: number; num_notas: number }> = {}
    for (const r of filteredSkuData) {
      if (!grouped[r.grupo_sku]) grouped[r.grupo_sku] = { receita: 0, volume: 0, num_notas: 0 }
      grouped[r.grupo_sku].receita += Number(r.receita)
      grouped[r.grupo_sku].volume += Number(r.volume)
      grouped[r.grupo_sku].num_notas += Number(r.num_notas)
    }
    const totalReceita = Object.values(grouped).reduce((s, v) => s + v.receita, 0)
    return Object.entries(grouped)
      .map(([grupo, v]) => ({
        grupo,
        receita: v.receita,
        volume: v.volume,
        num_notas: v.num_notas,
        valorMedioUnd: v.volume > 0 ? v.receita / v.volume : 0,
        pct: totalReceita > 0 ? (v.receita / totalReceita) * 100 : 0,
      }))
      .sort((a, b) => b.receita - a.receita)
  }, [filteredSkuData])

  // Chart: Fat/Ped/Ent mês a mês
  const monthlyBarData = useMemo(() => {
    const months: Record<string, { faturamento: number; pedidos: number; entregas: number }> = {}
    for (const p of filteredPedidos) {
      if (EXCLUDED_STATUSES.includes(p.status_pedido)) continue
      // Pedidos by doc_date
      if (p.origem === 'PV' && p.doc_date) {
        const mes = p.doc_date.substring(0, 7)
        if (!months[mes]) months[mes] = { faturamento: 0, pedidos: 0, entregas: 0 }
        months[mes].pedidos += Number(p.doc_total)
      }
      // Faturamento by nf_date
      if (p.nf_date) {
        const mes = p.nf_date.substring(0, 7)
        if (!months[mes]) months[mes] = { faturamento: 0, pedidos: 0, entregas: 0 }
        months[mes].faturamento += Number(p.faturamento_liquido ?? p.nf_total ?? p.doc_total)
      }
      // Entregas by entrega_data
      if (p.entrega_data) {
        const mes = p.entrega_data.substring(0, 7)
        if (!months[mes]) months[mes] = { faturamento: 0, pedidos: 0, entregas: 0 }
        months[mes].entregas += Number(p.nf_total ?? p.doc_total)
      }
    }
    return Object.entries(months)
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
  }, [filteredPedidos])

  // Chart: Status por mês (stacked)
  const statusMonthlyData = useMemo(() => {
    const months: Record<string, Record<string, number>> = {}
    for (const p of filteredPedidos) {
      const mes = p.doc_date?.substring(0, 7)
      if (!mes) continue
      if (!months[mes]) months[mes] = {}
      months[mes][p.status_pedido] = (months[mes][p.status_pedido] ?? 0) + 1
    }
    return Object.entries(months)
      .map(([mes, statuses]) => ({ mes, ...statuses }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
  }, [filteredPedidos])

  const allStatuses = useMemo(() => {
    const set = new Set<string>()
    for (const row of statusMonthlyData) {
      for (const key of Object.keys(row)) {
        if (key !== 'mes') set.add(key)
      }
    }
    return [...set]
  }, [statusMonthlyData])

  // Table: Receita por Canal
  const canalTableData = useMemo(() => {
    const inPeriod = filterByDateRange(
      businessFiltered as Record<string, unknown>[],
      'entrega_data', dateRange.from, dateRange.to
    ) as Pedido[]

    const grouped: Record<string, { faturado: number; estorno: number; entregas: number }> = {}
    for (const p of inPeriod) {
      if (EXCLUDED_STATUSES.includes(p.status_pedido)) continue
      const canal = p.canal || 'Sem canal'
      if (!grouped[canal]) grouped[canal] = { faturado: 0, estorno: 0, entregas: 0 }
      if (p.nf_date) grouped[canal].faturado += Number(p.nf_total ?? p.doc_total)
      grouped[canal].estorno += Number(p.estorno_total || 0)
      if (p.entrega_data) grouped[canal].entregas += 1
    }
    return Object.entries(grouped)
      .map(([canal, v]) => ({ canal, ...v, liquido: v.faturado - v.estorno }))
      .sort((a, b) => b.faturado - a.faturado)
  }, [businessFiltered, dateRange])

  const hasActiveFilters = Object.values(bizFilters).some(Boolean)
  const updateFilter = (key: keyof DashComercialFilters, value: string) =>
    setBizFilters((prev) => ({ ...prev, [key]: value }))

  if (hasError) {
    return (
      <DashboardSection title="Comercial" icon={<ShoppingCart size={20} />}>
        <ErrorCard message="Erro ao carregar dados comerciais" onRetry={() => { pedRefetch(); skuRefetch() }} />
      </DashboardSection>
    )
  }

  return (
    <DashboardSection title="Comercial" icon={<ShoppingCart size={20} />}>
      {/* Business filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={bizFilters.vendedor} onChange={(e) => updateFilter('vendedor', e.target.value)} className={selectClass}>
          <option value="">Todos vendedores</option>
          {filterOptions.vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={bizFilters.uf} onChange={(e) => updateFilter('uf', e.target.value)} className={selectClass}>
          <option value="">Todos UFs</option>
          {filterOptions.ufs.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={bizFilters.canal} onChange={(e) => updateFilter('canal', e.target.value)} className={selectClass}>
          <option value="">Todos canais</option>
          {filterOptions.canais.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={bizFilters.grupo} onChange={(e) => updateFilter('grupo', e.target.value)} className={selectClass}>
          <option value="">Todos grupos</option>
          <option value="Conserva">Conserva</option>
          <option value="Outros">Outros</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => setBizFilters(emptyFilters)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            Limpar
          </button>
        )}
      </div>

      {/* KPIs — Row 1: date-dependent with trend */}
      <div className="grid gap-4 sm:grid-cols-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard
              title="Pedidos"
              value={formatCurrency(kpis.pedidos.total)}
              description={`${formatNumber(kpis.pedidos.count)} documentos`}
              icon={<ShoppingCart size={20} />}
              trend={pedidoTrend ? { value: pedidoTrend.pct, label: compLabel } : undefined}
            />
            <KpiCard
              title="Faturamento"
              value={formatCurrency(kpis.faturamento.total)}
              description={`${formatNumber(kpis.faturamento.count)} documentos`}
              icon={<FileText size={20} />}
              trend={faturadoTrend ? { value: faturadoTrend.pct, label: compLabel } : undefined}
            />
            <KpiCard
              title="Entregas"
              value={formatCurrency(kpis.entregas.total)}
              description={`${formatNumber(kpis.entregas.count)} documentos`}
              icon={<Truck size={20} />}
              trend={entregueTrend ? { value: entregueTrend.pct, label: compLabel } : undefined}
            />
          </>
        )}
      </div>

      {/* KPIs — Row 2: date-independent + estornos */}
      <div className="grid gap-4 sm:grid-cols-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard
              title="Carteira de Pedidos"
              value={formatCurrency(carteiraTotal)}
              description="Pedidos em aberto"
              icon={<ClipboardList size={20} />}
            />
            <KpiCard
              title="Pendente Entrega"
              value={formatCurrency(pendenteEntregaTotal)}
              description="Faturado aguardando entrega"
              icon={<PackageCheck size={20} />}
            />
            <KpiCard
              title="Estornos"
              value={formatCurrency(estornosTotal)}
              description="Total de estornos no período"
              icon={<RotateCcw size={20} />}
              className={estornosTotal > 0 ? 'border-destructive/50 bg-destructive/5' : ''}
            />
          </>
        )}
      </div>

      {/* Existing charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Receita por Vendedor" loading={pedLoading} isEmpty={receitaPorVendedor.length === 0}>
          <BarChart data={receitaPorVendedor} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="vendedor" width={120} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Bar dataKey="valor" fill="#1e40af" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Receita por UF" loading={pedLoading} isEmpty={receitaPorUF.length === 0}>
          <BarChart data={receitaPorUF} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="uf" width={60} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Bar dataKey="valor" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Fat / Ped / Ent — mês a mês" loading={pedLoading} isEmpty={monthlyBarData.length === 0}>
          <BarChart data={monthlyBarData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
            <Bar dataKey="faturamento" name="Faturamento" fill="#1e40af" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pedidos" name="Pedidos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="entregas" name="Entregas" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Status por Mês" loading={pedLoading} isEmpty={statusMonthlyData.length === 0}>
          <BarChart data={statusMonthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {allStatuses.map((status) => (
              <Bar key={status} dataKey={status} stackId="status" fill={STATUS_COLORS[status] ?? '#94a3b8'} />
            ))}
          </BarChart>
        </ChartCard>
      </div>

      {/* SKU Group Analysis */}
      <h3 className="text-sm font-medium text-muted-foreground">Análise por Grupo de SKU</h3>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mix table */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-medium">Mix de Produtos</h4>
          {skuLoading ? (
            <div className="h-48 animate-pulse rounded bg-muted" />
          ) : skuMixData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Grupo SKU</th>
                    <th className="pb-2 text-right font-medium">Receita</th>
                    <th className="pb-2 text-right font-medium">Volume</th>
                    <th className="pb-2 text-right font-medium">Vlr Médio/Und</th>
                    <th className="pb-2 text-right font-medium">% Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {skuMixData.map((row) => (
                    <tr key={row.grupo} className="border-b border-border/50">
                      <td className="py-2 font-medium">{row.grupo}</td>
                      <td className="py-2 text-right">{formatCurrency(row.receita)}</td>
                      <td className="py-2 text-right">{formatNumber(row.volume)}</td>
                      <td className="py-2 text-right">{formatCurrency(row.valorMedioUnd)}</td>
                      <td className="py-2 text-right">{formatPercent(row.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Canal table */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-medium">Receita por Canal</h4>
          {pedLoading ? (
            <div className="h-48 animate-pulse rounded bg-muted" />
          ) : canalTableData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Canal</th>
                    <th className="pb-2 text-right font-medium">Faturado</th>
                    <th className="pb-2 text-right font-medium">Estorno</th>
                    <th className="pb-2 text-right font-medium">Fat. Líquido</th>
                    <th className="pb-2 text-right font-medium">Entregas</th>
                  </tr>
                </thead>
                <tbody>
                  {canalTableData.map((row) => (
                    <tr key={row.canal} className="border-b border-border/50">
                      <td className="py-2 font-medium">{row.canal}</td>
                      <td className="py-2 text-right">{formatCurrency(row.faturado)}</td>
                      <td className="py-2 text-right">{formatCurrency(row.estorno)}</td>
                      <td className="py-2 text-right">{formatCurrency(row.liquido)}</td>
                      <td className="py-2 text-right">{formatNumber(row.entregas)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-semibold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{formatCurrency(canalTableData.reduce((s, r) => s + r.faturado, 0))}</td>
                    <td className="py-2 text-right">{formatCurrency(canalTableData.reduce((s, r) => s + r.estorno, 0))}</td>
                    <td className="py-2 text-right">{formatCurrency(canalTableData.reduce((s, r) => s + r.liquido, 0))}</td>
                    <td className="py-2 text-right">{formatNumber(canalTableData.reduce((s, r) => s + r.entregas, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </DashboardSection>
  )
}
