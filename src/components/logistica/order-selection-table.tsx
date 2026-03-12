import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { differenceInDays, parseISO } from 'date-fns'
import type { Database } from '@/types/database'

type PedidoRow = Database['public']['Tables']['sap_cache_pedidos']['Row']

export interface OrderFilters {
  uf: string
  vendedor: string
  grupo: string
  search: string
  maxAgeDays: number
}

type SortOption = 'date_desc' | 'date_asc' | 'value' | 'weight' | 'uf' | 'client'

const SORT_LABELS: Record<SortOption, string> = {
  date_desc: 'Mais recente',
  date_asc: 'Mais antigo',
  value: 'Maior valor',
  weight: 'Maior peso',
  uf: 'UF (A-Z)',
  client: 'Cliente (A-Z)',
}

function getAgeDays(docDate: string | null | undefined): number {
  if (!docDate) return 0
  try {
    return differenceInDays(new Date(), parseISO(docDate))
  } catch { return 0 }
}

function getAgeDotColor(days: number): string {
  if (days > 7) return 'bg-red-500'
  if (days >= 3) return 'bg-amber-500'
  return 'bg-green-500'
}

function formatPallets(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

interface OrderSelectionTableProps {
  orders: PedidoRow[]
  selectedOrders: Set<string>
  onToggleOrder: (id: string) => void
  onToggleAll: (filteredIds: string[]) => void
  filters: OrderFilters
  onFilterChange: (filters: OrderFilters) => void
}

export function OrderSelectionTable({
  orders,
  selectedOrders,
  onToggleOrder,
  onToggleAll,
  filters,
  onFilterChange,
}: OrderSelectionTableProps) {
  const [sortBy, setSortBy] = useState<SortOption>('date_desc')

  // Unique filter options
  const ufOptions = useMemo(
    () => [...new Set(orders.map((o) => o.uf).filter(Boolean))].sort(),
    [orders]
  )
  const vendedorOptions = useMemo(
    () => [...new Set(orders.map((o) => o.vendedor).filter(Boolean))].sort(),
    [orders]
  )
  const grupoOptions = useMemo(
    () => [...new Set(orders.map((o) => o.grupo_principal).filter(Boolean))].sort(),
    [orders]
  )

  // Top UFs for quick filter chips
  const topUFs = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const o of orders) {
      const uf = o.uf
      if (uf) counts[uf] = (counts[uf] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([uf]) => uf)
  }, [orders])

  // Filtered orders
  const filtered = useMemo(() => {
    let result = orders.filter((o) => {
      if (filters.uf && o.uf !== filters.uf) return false
      if (filters.vendedor && o.vendedor !== filters.vendedor) return false
      if (filters.grupo && o.grupo_principal !== filters.grupo) return false
      if (filters.search) {
        const s = filters.search.toLowerCase()
        const match =
          String(o.doc_num).includes(s) ||
          o.card_name.toLowerCase().includes(s) ||
          o.card_code.toLowerCase().includes(s)
        if (!match) return false
      }
      if (filters.maxAgeDays > 0) {
        const age = getAgeDays(o.doc_date)
        if (age > filters.maxAgeDays) return false
      }
      return true
    })

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'date_desc': return (b.doc_date ?? '').localeCompare(a.doc_date ?? '')
        case 'date_asc': return (a.doc_date ?? '').localeCompare(b.doc_date ?? '')
        case 'value': return (b.doc_total ?? 0) - (a.doc_total ?? 0)
        case 'weight': return (b.total_weight_kg ?? 0) - (a.total_weight_kg ?? 0)
        case 'uf': return (a.uf ?? '').localeCompare(b.uf ?? '')
        case 'client': return (a.card_name ?? '').localeCompare(b.card_name ?? '')
        default: return 0
      }
    })

    return result
  }, [orders, filters, sortBy])

  // Selection totals
  const selectedItems = useMemo(
    () => filtered.filter((o) => selectedOrders.has(o.id)),
    [filtered, selectedOrders]
  )
  const totals = useMemo(() => {
    return selectedItems.reduce(
      (acc, o) => ({
        count: acc.count + 1,
        weight: acc.weight + (o.total_weight_kg ?? 0),
        pallets: acc.pallets + (o.total_pallets ?? 0),
        volume: acc.volume + (o.total_volume_m3 ?? 0),
        value: acc.value + (o.doc_total ?? 0),
      }),
      { count: 0, weight: 0, pallets: 0, volume: 0, value: 0 }
    )
  }, [selectedItems])

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((o) => selectedOrders.has(o.id))

  return (
    <div className="flex h-full flex-col">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar pedido ou cliente..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={filters.uf}
          onChange={(e) => onFilterChange({ ...filters, uf: e.target.value })}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todos UFs</option>
          {ufOptions.map((uf) => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
        <select
          value={filters.vendedor}
          onChange={(e) => onFilterChange({ ...filters, vendedor: e.target.value })}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todos Vendedores</option>
          {vendedorOptions.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select
          value={filters.grupo}
          onChange={(e) => onFilterChange({ ...filters, grupo: e.target.value })}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todos Grupos</option>
          {grupoOptions.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* Sort + UF quick chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
        >
          {Object.entries(SORT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <label className="whitespace-nowrap">Máx dias:</label>
          <select
            value={filters.maxAgeDays}
            onChange={(e) => onFilterChange({ ...filters, maxAgeDays: Number(e.target.value) })}
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={0}>Todos</option>
            <option value={7}>7 dias</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1">
          {topUFs.map((uf) => (
            <button
              key={uf}
              onClick={() => onFilterChange({ ...filters, uf: filters.uf === uf ? '' : uf })}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
                filters.uf === uf
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {uf}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr className="text-left text-xs font-medium text-muted-foreground">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={() => onToggleAll(filtered.map((o) => o.id))}
                  className="rounded border-border"
                />
              </th>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">UF</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-right">Peso (kg)</th>
              <th className="px-3 py-2 text-right">Pallets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((order) => {
              const selected = selectedOrders.has(order.id)
              const ageDays = getAgeDays(order.doc_date)
              const ageDotColor = getAgeDotColor(ageDays)
              return (
                <tr
                  key={order.id}
                  onClick={() => onToggleOrder(order.id)}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selected ? 'bg-primary/5' : 'hover:bg-muted/50'
                  )}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleOrder(order.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn('h-2 w-2 rounded-full flex-shrink-0', ageDotColor)}
                        title={`${ageDays}d atrás`}
                      />
                      {order.doc_num}
                    </div>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2" title={order.card_name}>
                    {order.card_name}
                  </td>
                  <td className="px-3 py-2">{order.uf}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(order.doc_total)}</td>
                  <td className="px-3 py-2 text-right">
                    {(order.total_weight_kg ?? 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right">{formatPallets(order.total_pallets ?? 0)}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum pedido encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Selection totals */}
      {totals.count > 0 && (
        <div className="flex items-center justify-between border-t border-border bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium text-primary">
            {totals.count} pedido{totals.count !== 1 ? 's' : ''} selecionado{totals.count !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Peso: <strong>{totals.weight.toLocaleString('pt-BR')} kg</strong></span>
            <span>Pallets: <strong>{formatPallets(totals.pallets)}</strong></span>
            <span>Valor: <strong>{formatCurrency(totals.value)}</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}
