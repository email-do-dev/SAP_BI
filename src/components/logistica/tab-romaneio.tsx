import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Package, ClipboardCheck, Truck, CheckCircle, Filter, Lock } from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { SHIPMENT_STATUS_CONFIG, type ShipmentStatus } from '@/lib/logistics-constants'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { KpiCard } from '@/components/shared/kpi-card'
import { RomaneioChecklistDialog } from './romaneio-checklist-dialog'
import type { Database } from '@/types/database'

type ShipmentRow = Database['public']['Tables']['shipments']['Row']
type ShipmentItemRow = Database['public']['Tables']['shipment_items']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type DriverRow = Database['public']['Tables']['drivers']['Row']

interface ShipmentWithDetails extends ShipmentRow {
  vehicle?: VehicleRow | null
  driver?: DriverRow | null
  items?: ShipmentItemRow[]
}

export function TabRomaneio() {
  const [selectedShipment, setSelectedShipment] = useState<ShipmentWithDetails | null>(null)
  const [filterStatus, setFilterStatus] = useState<'' | 'programada' | 'em_expedicao'>('')
  const [filterDate, setFilterDate] = useState('')

  // Fetch shipments with status programada or em_expedicao
  const { data: shipments = [], isLoading, refetch } = useQuery<ShipmentWithDetails[]>({
    queryKey: ['romaneio-shipments'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shipments') as any)
        .select('*, vehicle:vehicles(*), driver:drivers(*), items:shipment_items(*)')
        .in('status', ['programada', 'em_expedicao'])
        .order('delivery_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ShipmentWithDetails[]
    },
    staleTime: 30 * 1000,
  })

  // Count expedidas today
  const { data: expedidasHoje = 0 } = useQuery<number>({
    queryKey: ['romaneio-expedidas-hoje'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error } = await (supabase.from('shipments') as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'expedida')
        .gte('expedition_verified_at', `${today}T00:00:00`)
        .lte('expedition_verified_at', `${today}T23:59:59`)
      if (error) throw error
      return count ?? 0
    },
    staleTime: 30 * 1000,
  })

  // Filtered list
  const filtered = useMemo(() => {
    let list = shipments
    if (filterStatus) list = list.filter(s => s.status === filterStatus)
    if (filterDate) list = list.filter(s => s.delivery_date === filterDate)
    return list
  }, [shipments, filterStatus, filterDate])

  // Fetch expected SKU quantities for all shipment items (for progress by qty)
  const allDocEntries = useMemo(() => shipments.flatMap(s => (s.items ?? []).map(i => i.doc_entry)), [shipments])
  const allOrigens = useMemo(() => [...new Set(shipments.flatMap(s => (s.items ?? []).map(i => i.origem)))], [shipments])
  const allItems = useMemo(() => shipments.flatMap(s => s.items ?? []), [shipments])

  const { data: skuByItem = new Map<string, number>() } = useQuery({
    queryKey: ['romaneio-sku-totals', allDocEntries.join(',')],
    queryFn: async () => {
      if (allDocEntries.length === 0) return new Map<string, number>()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('sap_cache_pedido_linhas') as any)
        .select('doc_entry, origem, quantidade')
        .in('doc_entry', allDocEntries)
        .in('origem', allOrigens)

      if (error) throw error
      if (!data) return new Map<string, number>()

      // Sum expected qty per shipment_item_id
      const map = new Map<string, number>()
      for (const row of data as Array<{ doc_entry: number; origem: string; quantidade: number }>) {
        const si = allItems.find(i => i.doc_entry === row.doc_entry && i.origem === row.origem)
        if (!si) continue
        map.set(si.id, (map.get(si.id) ?? 0) + row.quantidade)
      }
      return map
    },
    staleTime: 5 * 60 * 1000,
    enabled: allDocEntries.length > 0,
  })

  // KPI calculations
  const totalPendentes = shipments.length
  const totalNfsSemPalete = shipments.reduce((acc, s) => {
    const totalNfs = (s.items ?? []).length
    const palletsData = s.pallets_data ?? []
    const nfsWithPallets = new Set(
      palletsData
        .filter(p => p.shipment_item_id && p.items.some(i => i.item_code && i.quantidade > 0))
        .map(p => p.shipment_item_id)
    ).size
    return acc + Math.max(0, totalNfs - nfsWithPallets)
  }, 0)

  function handleOpenChecklist(shipment: ShipmentWithDetails) {
    setSelectedShipment(shipment)
  }

  function handleCloseChecklist() {
    setSelectedShipment(null)
    refetch()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Cargas Pendentes"
          value={String(totalPendentes)}
          icon={<Package size={20} />}
          description="Programadas + em expedição"
        />
        <KpiCard
          title="NFs sem Palete"
          value={String(totalNfsSemPalete)}
          icon={<ClipboardCheck size={20} />}
          description="NFs aguardando registro de paletes"
        />
        <KpiCard
          title="Expedidas Hoje"
          value={String(expedidasHoje)}
          icon={<CheckCircle size={20} />}
          description="Cargas expedidas hoje"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-muted-foreground" />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as '' | 'programada' | 'em_expedicao')}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="programada">Programada</option>
          <option value="em_expedicao">Em Expedição</option>
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        {(filterStatus || filterDate) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterDate('') }}
            className="text-xs text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Shipment Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 py-16 text-center">
          <p className="text-base font-medium text-muted-foreground">
            Nenhuma carga pendente de conferência
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            As cargas programadas aparecerão aqui para conferência.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(shipment => {
            const palletsData = shipment.pallets_data ?? []
            // Progress by item quantity: sum paletized vs expected
            const shipmentItems = shipment.items ?? []
            const totalExpected = shipmentItems.reduce((acc, si) => acc + (skuByItem.get(si.id) ?? 0), 0)
            const totalPaletizado = palletsData.reduce((acc, p) =>
              acc + p.items.reduce((s, i) => s + (i.quantidade || 0), 0), 0)
            const progress = totalExpected > 0
              ? Math.min((totalPaletizado / totalExpected) * 100, 100)
              : (totalPaletizado > 0 ? 100 : 0)
            const statusConfig = SHIPMENT_STATUS_CONFIG[shipment.status as ShipmentStatus]
            const isInProgress = shipment.status === 'em_expedicao'
            const hasSeal = !!shipment.seal_number

            return (
              <div
                key={shipment.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{shipment.reference}</span>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusConfig.bgColor, statusConfig.color)}>
                        {statusConfig.label}
                      </span>
                      {hasSeal && (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          <Lock size={12} />
                          {shipment.seal_number}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        {format(parseISO(shipment.delivery_date), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                      </span>
                      {shipment.vehicle && (
                        <span className="flex items-center gap-1">
                          <Truck size={14} />
                          {shipment.vehicle.plate} — {shipment.vehicle.vehicle_type}
                        </span>
                      )}
                      {shipment.driver && (
                        <span>{shipment.driver.name}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatNumber(shipment.total_weight_kg)} kg</span>
                      <span>{formatCurrency(shipment.total_value)}</span>
                      <span>{(shipment.items ?? []).length} {(shipment.items ?? []).length === 1 ? 'item' : 'itens'}</span>
                    </div>

                    {/* Progress bar — item qty */}
                    <div className="mt-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatNumber(totalPaletizado)}/{formatNumber(totalExpected)} un carregadas</span>
                        <span>{progress.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all',
                            progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-amber-500' : 'bg-muted'
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right - Action */}
                  <div className="flex shrink-0 items-start">
                    <button
                      onClick={() => handleOpenChecklist(shipment)}
                      className={cn(
                        'flex min-h-[44px] items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors',
                        isInProgress
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-primary hover:bg-primary/90'
                      )}
                    >
                      <ClipboardCheck size={18} />
                      {isInProgress ? 'Continuar Conferência' : 'Iniciar Conferência'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Checklist Dialog */}
      {selectedShipment && (
        <RomaneioChecklistDialog
          shipment={selectedShipment}
          onClose={handleCloseChecklist}
        />
      )}
    </div>
  )
}
