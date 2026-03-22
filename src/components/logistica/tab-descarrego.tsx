import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { FileCheck, Clock, Truck, CheckCircle, Filter, Lock } from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { SHIPMENT_STATUS_CONFIG, type ShipmentStatus } from '@/lib/logistics-constants'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { KpiCard } from '@/components/shared/kpi-card'
import { DescarregoDetailDialog } from './descarrego-detail-dialog'
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

export function TabDescarrego() {
  const [selectedShipment, setSelectedShipment] = useState<ShipmentWithDetails | null>(null)
  const [filterDate, setFilterDate] = useState('')

  // Fetch shipments with status entregue (awaiting document confirmation)
  const { data: shipments = [], isLoading, refetch } = useQuery<ShipmentWithDetails[]>({
    queryKey: ['descarrego-shipments'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shipments') as any)
        .select('*, vehicle:vehicles(*), driver:drivers(*), items:shipment_items(*)')
        .in('status', ['entregue'])
        .order('delivery_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ShipmentWithDetails[]
    },
    staleTime: 30 * 1000,
  })

  // Count finalizadas today
  const { data: finalizadasHoje = 0 } = useQuery<number>({
    queryKey: ['descarrego-finalizadas-hoje'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error } = await (supabase.from('shipments') as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'finalizada')
        .gte('completed_at', `${today}T00:00:00`)
        .lte('completed_at', `${today}T23:59:59`)
      if (error) throw error
      return count ?? 0
    },
    staleTime: 30 * 1000,
  })

  // Filtered list
  const filtered = useMemo(() => {
    let list = shipments
    if (filterDate) list = list.filter(s => s.delivery_date === filterDate)
    return list
  }, [shipments, filterDate])

  // KPI calculations
  const aguardandoCanhoto = shipments.filter(s => {
    const items = s.items ?? []
    return items.some(i => !i.canhoto_storage_path)
  }).length

  const aguardandoCte = shipments.filter(s => {
    const items = s.items ?? []
    return items.some(i => i.delivery_type === 'operator' && !i.cte_doc_entry)
  }).length

  function handleCloseDetail() {
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
          title="Aguardando Canhoto"
          value={String(aguardandoCanhoto)}
          icon={<FileCheck size={20} />}
          description="Cargas sem canhoto em todas as NFs"
        />
        <KpiCard
          title="Aguardando CTE"
          value={String(aguardandoCte)}
          icon={<Clock size={20} />}
          description="NFs via operador sem CTE registrado"
        />
        <KpiCard
          title="Finalizadas Hoje"
          value={String(finalizadasHoje)}
          icon={<CheckCircle size={20} />}
          description="Cargas finalizadas hoje"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-muted-foreground" />
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
        {filterDate && (
          <button
            onClick={() => setFilterDate('')}
            className="text-xs text-primary hover:underline"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Shipment Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 py-16 text-center">
          <p className="text-base font-medium text-muted-foreground">
            Nenhuma carga aguardando confirmação
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Cargas entregues aparecerão aqui para confirmação documental.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(shipment => {
            const shipmentItems = shipment.items ?? []
            const totalNfs = shipmentItems.length
            const nfsComCanhoto = shipmentItems.filter(i => !!i.canhoto_storage_path).length
            const canhotoPct = totalNfs > 0 ? Math.min((nfsComCanhoto / totalNfs) * 100, 100) : 0
            const statusConfig = SHIPMENT_STATUS_CONFIG[shipment.status as ShipmentStatus]
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
                      <span>{totalNfs} {totalNfs === 1 ? 'NF' : 'NFs'}</span>
                    </div>

                    {/* Canhoto progress bar */}
                    <div className="mt-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{nfsComCanhoto}/{totalNfs} canhotos recebidos</span>
                        <span>{canhotoPct.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all',
                            canhotoPct >= 100 ? 'bg-green-500' : canhotoPct > 0 ? 'bg-amber-500' : 'bg-muted'
                          )}
                          style={{ width: `${canhotoPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right - Action */}
                  <div className="flex shrink-0 items-start">
                    <button
                      onClick={() => setSelectedShipment(shipment)}
                      className="flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                    >
                      <FileCheck size={18} />
                      Confirmar Entrega
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Dialog */}
      {selectedShipment && (
        <DescarregoDetailDialog
          shipment={selectedShipment}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  )
}
