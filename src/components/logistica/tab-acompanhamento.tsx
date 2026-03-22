import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { MapPin, Truck, Clock, AlertTriangle, Filter, Lock } from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import {
  SHIPMENT_STATUS_CONFIG,
  TRACKING_EVENT_LABELS,
  type ShipmentStatus,
  type TrackingEventType,
} from '@/lib/logistics-constants'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { KpiCard } from '@/components/shared/kpi-card'
import { AcompanhamentoDetailDialog } from './acompanhamento-detail-dialog'
import type { Database } from '@/types/database'

type ShipmentRow = Database['public']['Tables']['shipments']['Row']
type ShipmentItemRow = Database['public']['Tables']['shipment_items']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type DriverRow = Database['public']['Tables']['drivers']['Row']
type TrackingEventRow = Database['public']['Tables']['shipment_tracking_events']['Row']

interface ShipmentWithDetails extends ShipmentRow {
  vehicle?: VehicleRow | null
  driver?: DriverRow | null
  items?: ShipmentItemRow[]
  tracking_events?: TrackingEventRow[]
}

const ACOMPANHAMENTO_STATUSES: ShipmentStatus[] = ['expedida', 'em_transito', 'entregue_parcial']

export function TabAcompanhamento() {
  const [selectedShipment, setSelectedShipment] = useState<ShipmentWithDetails | null>(null)
  const [filterStatus, setFilterStatus] = useState<'' | 'expedida' | 'em_transito' | 'entregue_parcial'>('')
  const [filterDate, setFilterDate] = useState('')

  // Fetch shipments with tracking-relevant statuses
  const { data: shipments = [], isLoading, refetch } = useQuery<ShipmentWithDetails[]>({
    queryKey: ['acompanhamento-shipments'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shipments') as any)
        .select('*, vehicle:vehicles(*), driver:drivers(*), items:shipment_items(*), tracking_events:shipment_tracking_events(*)')
        .in('status', ACOMPANHAMENTO_STATUSES)
        .order('delivery_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ShipmentWithDetails[]
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

  // KPI calculations
  const emTransito = shipments.filter(s => s.status === 'em_transito').length
  const aguardandoSaida = shipments.filter(s => s.status === 'expedida').length
  const entregasParciais = shipments.filter(s => s.status === 'entregue_parcial').length

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
          title="Em Trânsito"
          value={String(emTransito)}
          icon={<Truck size={20} />}
          description="Cargas a caminho do destino"
        />
        <KpiCard
          title="Aguardando Saída"
          value={String(aguardandoSaida)}
          icon={<Clock size={20} />}
          description="Expedidas, aguardando registro de saída"
        />
        <KpiCard
          title="Entregas Parciais"
          value={String(entregasParciais)}
          icon={<AlertTriangle size={20} />}
          description="Cargas com entregas pendentes"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-muted-foreground" />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="expedida">Expedida</option>
          <option value="em_transito">Em Trânsito</option>
          <option value="entregue_parcial">Entregue Parcial</option>
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
            Nenhuma carga em acompanhamento
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            As cargas expedidas aparecerão aqui para acompanhamento.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(shipment => {
            const shipmentItems = shipment.items ?? []
            const totalNfs = shipmentItems.length
            const nfsEntregues = shipmentItems.filter(i => i.delivery_status === 'entregue').length
            const deliveryProgress = totalNfs > 0 ? Math.min((nfsEntregues / totalNfs) * 100, 100) : 0
            const statusConfig = SHIPMENT_STATUS_CONFIG[shipment.status as ShipmentStatus]
            const hasSeal = !!shipment.seal_number

            // Last tracking event
            const events = shipment.tracking_events ?? []
            const lastEvent = events.length > 0
              ? events.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
              : null

            // Unique destinations
            const destinations = [...new Set(shipmentItems.map(i => `${i.card_name} (${i.uf})`))]

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

                    {/* Destinations */}
                    {destinations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {destinations.slice(0, 3).map(d => (
                          <span key={d} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                            {d}
                          </span>
                        ))}
                        {destinations.length > 3 && (
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                            +{destinations.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Delivery progress bar */}
                    <div className="mt-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{nfsEntregues}/{totalNfs} NFs entregues</span>
                        <span>{deliveryProgress.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all',
                            deliveryProgress >= 100 ? 'bg-green-500' : deliveryProgress > 0 ? 'bg-amber-500' : 'bg-muted'
                          )}
                          style={{ width: `${deliveryProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Last event */}
                    {lastEvent && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin size={12} />
                        <span className="font-medium">
                          {TRACKING_EVENT_LABELS[lastEvent.event_type as TrackingEventType] ?? lastEvent.event_type}
                        </span>
                        <span>— {lastEvent.description}</span>
                        <span className="ml-auto shrink-0">
                          {format(parseISO(lastEvent.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right - Action */}
                  <div className="flex shrink-0 items-start">
                    <button
                      onClick={() => setSelectedShipment(shipment)}
                      className="flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                    >
                      <MapPin size={18} />
                      Ver Detalhes
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
        <AcompanhamentoDetailDialog
          shipment={selectedShipment}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  )
}
