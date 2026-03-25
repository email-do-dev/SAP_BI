import { useState, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { usePageView, useActivityLog } from '@/hooks/use-activity-log'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ShoppingCart, FileText, Truck, ClipboardList, PackageCheck, RotateCcw } from 'lucide-react'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { KpiCard } from '@/components/shared/kpi-card'
import { RefreshIndicator } from '@/components/shared/refresh-indicator'
import { PedidoDetalheDialog } from '@/components/pedido-detalhe-dialog'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { useComercialFilters } from '@/hooks/use-comercial-filters'
import { DATE_PRESETS } from '@/hooks/use-dashboard-filters'
import { formatCurrency, formatNumber, filterByDateRange, exportToCsv } from '@/lib/utils'
import { EXCLUDED_STATUSES, computeIndependentKpis } from '@/lib/comercial-utils'
import type { Database } from '@/types/database'

type Pedido = Database['public']['Tables']['sap_cache_pedidos']['Row']

const col = createColumnHelper<Pedido>()

const inputClass = 'rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

type DateFieldOption = 'doc_date' | 'nf_date' | 'entrega_data'

interface BusinessFilters {
  vendedor: string
  tipo: string
  status: string
  uf: string
  canal: string
  grupo: string
}

const emptyFilters: BusinessFilters = {
  vendedor: '',
  tipo: '',
  status: '',
  uf: '',
  canal: '',
  grupo: '',
}

function formatDateCell(value: string | null) {
  if (!value) return '—'
  return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })
}

export default function ComercialPage() {
  usePageView('comercial')
  const { logActivity } = useActivityLog()
  const [selectedOrder, setSelectedOrder] = useState<Pedido | null>(null)
  const [filters, setFilters] = useState<BusinessFilters>(emptyFilters)
  const [tableDateField, setTableDateField] = useState<DateFieldOption>('doc_date')

  const {
    dateRange, setDateRange,
    comparison, setComparison,
    comparisonRange,
    filterData, compareValues,
  } = useComercialFilters()

  const { data: pedidos, isLoading, error } = useCacheQuery<Pedido[]>('sap_cache_pedidos', {
    order: 'doc_date',
    ascending: false,
    limit: 10000,
  })

  // Unique filter options derived from data
  const filterOptions = useMemo(() => {
    if (!pedidos) return { vendedores: [], ufs: [], canais: [] }
    const vendedores = [...new Set(pedidos.map((p) => p.vendedor).filter(Boolean))].sort()
    const ufs = [...new Set(pedidos.map((p) => p.uf).filter(Boolean))].sort()
    const canais = [...new Set(pedidos.map((p) => p.canal).filter(Boolean))].sort()
    return { vendedores, ufs, canais }
  }, [pedidos])

  // Step 1: business filters only (NO date filter)
  const businessFilteredData = useMemo(() => {
    if (!pedidos) return []
    return pedidos.filter((p) => {
      if (filters.vendedor && p.vendedor !== filters.vendedor) return false
      if (filters.tipo && p.tipo !== filters.tipo) return false
      if (filters.status && p.status_pedido !== filters.status) return false
      if (filters.uf && p.uf !== filters.uf) return false
      if (filters.canal && p.canal !== filters.canal) return false
      if (filters.grupo && p.grupo_principal !== filters.grupo) return false
      return true
    })
  }, [pedidos, filters])

  // Table data: business filters + date filter on selected field
  const filteredData = useMemo(() => {
    return filterData(businessFilteredData as Record<string, unknown>[], tableDateField) as Pedido[]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessFilteredData, dateRange, tableDateField])

  const filteredTotal = useMemo(() => {
    return filteredData
      .filter((p) => !EXCLUDED_STATUSES.includes(p.status_pedido))
      .reduce((sum, p) => sum + ((p.nf_total ?? p.doc_total) || 0), 0)
  }, [filteredData])

  // KPIs: each card filters independently by its own date field
  const kpis = useMemo(
    () => computeIndependentKpis(businessFilteredData, dateRange.from, dateRange.to),
    [businessFilteredData, dateRange]
  )

  const compKpis = useMemo(
    () => comparison !== 'none'
      ? computeIndependentKpis(businessFilteredData, comparisonRange.from, comparisonRange.to)
      : null,
    [businessFilteredData, comparison, comparisonRange]
  )

  // Date-independent KPIs
  const carteiraTotal = useMemo(() => {
    return businessFilteredData
      .filter(p => p.status_pedido === 'Pedido')
      .reduce((sum, p) => sum + Number(p.doc_total), 0)
  }, [businessFilteredData])

  const pendenteEntregaTotal = useMemo(() => {
    return businessFilteredData
      .filter(p => p.status_pedido === 'Faturado')
      .reduce((sum, p) => sum + Number(p.nf_total ?? p.doc_total), 0)
  }, [businessFilteredData])

  const estornosTotal = useMemo(() => {
    const rows = filterByDateRange(
      businessFilteredData as Record<string, unknown>[],
      'nf_date', dateRange.from, dateRange.to
    ) as Pedido[]
    return rows.reduce((sum, p) => sum + Number(p.estorno_total || 0), 0)
  }, [businessFilteredData, dateRange])

  // Trends
  const compLabel = comparison === 'prev_year' ? 'vs ano anterior' : 'vs período anterior'
  const pedidoTrend = compKpis ? compareValues(kpis.pedidos.total, compKpis.pedidos.total) : null
  const faturadoTrend = compKpis ? compareValues(kpis.faturamento.total, compKpis.faturamento.total) : null
  const entregueTrend = compKpis ? compareValues(kpis.entregas.total, compKpis.entregas.total) : null

  const columns = useMemo(
    () => [
      col.accessor('doc_num', { header: 'Nº Doc', size: 90 }),
      col.accessor('tipo', {
        header: 'Tipo',
        cell: (info) => <StatusBadge status={info.getValue()} />,
        size: 100,
      }),
      col.accessor('card_name', { header: 'Cliente' }),
      col.accessor('vendedor', { header: 'Vendedor', size: 150 }),
      col.accessor('uf', { header: 'UF', size: 60 }),
      col.accessor('doc_total', {
        header: 'Valor',
        cell: (info) => formatCurrency(info.row.original.nf_total ?? info.getValue()),
        size: 130,
      }),
      col.accessor('doc_date', {
        header: 'Data Pedido',
        cell: (info) => formatDateCell(info.getValue()),
        size: 110,
      }),
      col.accessor('nf_date', {
        header: 'Data NF',
        cell: (info) => formatDateCell(info.getValue()),
        size: 110,
      }),
      col.accessor('entrega_data', {
        header: 'Data Entrega',
        cell: (info) => formatDateCell(info.getValue()),
        size: 110,
      }),
      col.accessor('nf_num', {
        header: 'NF',
        cell: (info) => info.getValue() ?? '—',
        size: 90,
      }),
      col.accessor('estorno_total', {
        header: 'Estornos',
        cell: (info) => {
          const v = info.getValue()
          return v > 0 ? formatCurrency(v) : '—'
        },
        size: 120,
      }),
      col.accessor('faturamento_liquido', {
        header: 'Fat. Líquido',
        cell: (info) => {
          const v = info.getValue()
          return v != null ? formatCurrency(v) : '—'
        },
        size: 130,
      }),
      col.accessor('status_pedido', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
        size: 110,
      }),
    ],
    []
  )

  const hasActiveFilters = Object.values(filters).some(Boolean)
  const refreshedAt = pedidos?.[0]?.refreshed_at

  const updateFilter = (key: keyof BusinessFilters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const handleExport = () => {
    logActivity({ action: 'export', resource: 'comercial', metadata: { rows: filteredData.length } })
    exportToCsv(filteredData, [
      { key: 'doc_num', header: 'Nº Doc' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'card_name', header: 'Cliente' },
      { key: 'vendedor', header: 'Vendedor' },
      { key: 'uf', header: 'UF' },
      { key: 'nf_total', header: 'Valor (NF)' },
      { key: 'doc_total', header: 'Valor (Doc)' },
      { key: 'doc_date', header: 'Data Pedido' },
      { key: 'nf_date', header: 'Data NF' },
      { key: 'entrega_data', header: 'Data Entrega' },
      { key: 'nf_num', header: 'NF' },
      { key: 'estorno_total', header: 'Estornos' },
      { key: 'faturamento_liquido', header: 'Fat. Líquido' },
      { key: 'status_pedido', header: 'Status' },
      { key: 'grupo_principal', header: 'Grupo' },
    ], 'comercial')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Comercial</h1>
        <RefreshIndicator refreshedAt={refreshedAt} />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Erro ao carregar dados: {error.message}
        </div>
      )}

      {/* Date range + presets + comparison */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tableDateField}
          onChange={(e) => setTableDateField(e.target.value as DateFieldOption)}
          className={inputClass + ' text-xs'}
        >
          <option value="doc_date">Filtrar por: Data Pedido</option>
          <option value="nf_date">Filtrar por: Data NF</option>
          <option value="entrega_data">Filtrar por: Data Entrega</option>
        </select>
        <div className="mx-1 h-6 w-px bg-border" />
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
          className={inputClass}
        />
        <span className="text-sm text-muted-foreground">até</span>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
          className={inputClass}
        />
        <div className="mx-1 h-6 w-px bg-border" />
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setDateRange(preset.range())}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {preset.label}
          </button>
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        <span className="text-xs text-muted-foreground">Comparar:</span>
        <select
          value={comparison}
          onChange={(e) => setComparison(e.target.value as typeof comparison)}
          className={inputClass + ' text-xs'}
        >
          <option value="none">Nenhum</option>
          <option value="prev_period">Período anterior</option>
          <option value="prev_year">Ano anterior</option>
        </select>
      </div>

      {/* Business filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filters.vendedor}
          onChange={(e) => updateFilter('vendedor', e.target.value)}
          className={inputClass}
        >
          <option value="">Todos vendedores</option>
          {filterOptions.vendedores.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select
          value={filters.tipo}
          onChange={(e) => updateFilter('tipo', e.target.value)}
          className={inputClass}
        >
          <option value="">Todos tipos</option>
          <option value="Venda">Venda</option>
          <option value="Bonificacao">Bonificação</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className={inputClass}
        >
          <option value="">Todos status</option>
          <option value="Pedido">Pedido</option>
          <option value="Faturado">Faturado</option>
          <option value="Entregue">Entregue</option>
          <option value="Cancelado">Cancelado</option>
          <option value="Estorno">Estorno</option>
        </select>
        <select
          value={filters.uf}
          onChange={(e) => updateFilter('uf', e.target.value)}
          className={inputClass}
        >
          <option value="">Todos UFs</option>
          {filterOptions.ufs.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <select
          value={filters.canal}
          onChange={(e) => updateFilter('canal', e.target.value)}
          className={inputClass}
        >
          <option value="">Todos canais</option>
          {filterOptions.canais.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filters.grupo}
          onChange={(e) => updateFilter('grupo', e.target.value)}
          className={inputClass}
        >
          <option value="">Todos grupos</option>
          <option value="Conserva">Conserva</option>
          <option value="Outros">Outros</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => setFilters(emptyFilters)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* KPI Cards — 3 cards with independent date filtering */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>

      {/* KPI Cards — date-independent */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Carteira de Pedidos"
          value={formatCurrency(carteiraTotal)}
          description="Pedidos em aberto (sem filtro de data)"
          icon={<ClipboardList size={20} />}
        />
        <KpiCard
          title="Pendente Entrega"
          value={formatCurrency(pendenteEntregaTotal)}
          description="Faturado aguardando entrega (sem filtro de data)"
          icon={<PackageCheck size={20} />}
        />
        <KpiCard
          title="Estornos"
          value={formatCurrency(estornosTotal)}
          description="Total de estornos no período"
          icon={<RotateCcw size={20} />}
          className={estornosTotal > 0 ? 'border-destructive/50 bg-destructive/5' : ''}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          {formatNumber(filteredData.length)} registro(s) na tabela
        </span>
        <span className="font-semibold">
          Total: {formatCurrency(filteredTotal)}
        </span>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} />
      ) : (
        <DataTable
          data={filteredData}
          columns={columns}
          searchPlaceholder="Buscar..."
          onRowClick={setSelectedOrder}
          onExport={handleExport}
        />
      )}

      <PedidoDetalheDialog
        pedido={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  )
}
