import { useState, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { cn, formatNumber } from '@/lib/utils'
import { OP_STATUS_CONFIG, type OpStatus } from '@/lib/production-constants'
import { DataTable } from '@/components/shared/data-table'
import { OrdemDetalheDialog } from './ordem-detalhe-dialog'
import { KpiSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'

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

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columnHelper = createColumnHelper<OrdemRow>()

const columns = [
  columnHelper.accessor('doc_num', {
    header: 'DocNum',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const status = info.getValue() as OpStatus
      const config = OP_STATUS_CONFIG[status]
      if (!config) return <span>{status}</span>
      return (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            config.bgColor,
            config.color
          )}
        >
          {status}
        </span>
      )
    },
  }),
  columnHelper.accessor('item_name', {
    header: 'Item',
    cell: (info) => (
      <span className="max-w-[200px] truncate" title={info.getValue()}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('planned_qty', {
    header: 'Planejada',
    cell: (info) => formatNumber(info.getValue()),
  }),
  columnHelper.accessor('completed_qty', {
    header: 'Realizada',
    cell: (info) => formatNumber(info.getValue()),
  }),
  columnHelper.accessor('eficiencia_pct', {
    header: 'Eficiencia %',
    cell: (info) => {
      const val = info.getValue()
      if (val == null) return <span className="text-muted-foreground">-</span>
      return <span>{Math.round(val * 10) / 10}%</span>
    },
  }),
  columnHelper.accessor('due_date', {
    header: 'Prazo',
    cell: (info) => {
      const val = info.getValue()
      if (!val) return '-'
      // Format yyyy-MM-dd to dd/MM/yyyy
      const parts = val.substring(0, 10).split('-')
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : val
    },
  }),
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TabOrdens() {
  const { data: ordens, isLoading } = useCacheQuery<OrdemRow[]>('sap_cache_producao_ordens_lista')

  const [selectedDocEntry, setSelectedDocEntry] = useState<number | null>(null)

  // --- Filters ---
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterItem, setFilterItem] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('')

  // --- Unique warehouses for select ---
  const warehouses = useMemo(() => {
    if (!ordens) return []
    const unique = new Set(ordens.map((o) => o.warehouse).filter(Boolean))
    return Array.from(unique).sort()
  }, [ordens])

  // --- Filtered data ---
  const filtered = useMemo(() => {
    if (!ordens) return []
    return ordens.filter((o) => {
      if (filterStatus && o.status !== filterStatus) return false
      if (filterDateFrom && o.due_date < filterDateFrom) return false
      if (filterDateTo && o.due_date > filterDateTo) return false
      if (filterItem && !o.item_name?.toLowerCase().includes(filterItem.toLowerCase())) return false
      if (filterWarehouse && o.warehouse !== filterWarehouse) return false
      return true
    })
  }, [ordens, filterStatus, filterDateFrom, filterDateTo, filterItem, filterWarehouse])

  // --- KPIs ---
  const kpis = useMemo(() => {
    const total = filtered.length
    const abertas = filtered.filter((o) => o.status === 'Planejada' || o.status === 'Liberada').length
    const encerradas = filtered.filter((o) => o.status === 'Encerrada').length
    const taxaConclusao = total > 0 ? Math.round((encerradas / total) * 1000) / 10 : 0
    const qtdProduzida = filtered.reduce((sum, o) => sum + (o.completed_qty ?? 0), 0)

    return { total, abertas, taxaConclusao, qtdProduzida }
  }, [filtered])

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total OPs</p>
              <p className="mt-2 text-3xl font-bold">{formatNumber(kpis.total)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">OPs Abertas</p>
              <p className="mt-2 text-3xl font-bold">{formatNumber(kpis.abertas)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Planejadas + Liberadas</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Taxa Conclusao</p>
              <p className="mt-2 text-3xl font-bold">{kpis.taxaConclusao}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Encerradas / Total</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Qtd Produzida</p>
              <p className="mt-2 text-3xl font-bold">{formatNumber(kpis.qtdProduzida)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Total realizado</p>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos</option>
            <option value="Planejada">Planejada</option>
            <option value="Liberada">Liberada</option>
            <option value="Encerrada">Encerrada</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Ate</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Item</label>
          <input
            type="text"
            placeholder="Buscar item..."
            value={filterItem}
            onChange={(e) => setFilterItem(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Deposito</label>
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos</option>
            {warehouses.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        {(filterStatus || filterDateFrom || filterDateTo || filterItem || filterWarehouse) && (
          <button
            onClick={() => {
              setFilterStatus('')
              setFilterDateFrom('')
              setFilterDateTo('')
              setFilterItem('')
              setFilterWarehouse('')
            }}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          searchPlaceholder="Buscar por DocNum, item..."
          onRowClick={(row) => setSelectedDocEntry(row.doc_entry)}
          pageSize={20}
        />
      )}

      {/* Detail dialog */}
      <OrdemDetalheDialog
        docEntry={selectedDocEntry}
        onClose={() => setSelectedDocEntry(null)}
      />
    </div>
  )
}
