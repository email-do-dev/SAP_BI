import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import {
  X, Truck, MapPin, Package, Clock, CheckCircle2, AlertTriangle,
  Loader2, Send, Navigation,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import {
  SHIPMENT_STATUS_CONFIG,
  TRACKING_EVENT_LABELS,
  DELIVERY_ITEM_STATUS_CONFIG,
  DELIVERY_TYPE_LABELS,
  VALID_TRANSITIONS,
  type ShipmentStatus,
  type TrackingEventType,
  type DeliveryItemStatus,
} from '@/lib/logistics-constants'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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

interface Props {
  shipment: ShipmentWithDetails
  onClose: () => void
}

const EVENT_ICONS: Record<string, string> = {
  departure: '🚛',
  arrival_operator: '📦',
  delivery: '✅',
  delay: '⏰',
  incident: '⚠️',
  note: '📝',
}

export function AcompanhamentoDetailDialog({ shipment, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [currentStatus, setCurrentStatus] = useState<ShipmentStatus>(shipment.status as ShipmentStatus)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Event form state
  const [eventType, setEventType] = useState<TrackingEventType>('departure')
  const [eventDescription, setEventDescription] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventItemId, setEventItemId] = useState<string>('')
  const [submittingEvent, setSubmittingEvent] = useState(false)

  const items = shipment.items ?? []

  // Fetch tracking events (refreshable)
  const { data: events = [], refetch: refetchEvents } = useQuery<TrackingEventRow[]>({
    queryKey: ['tracking-events', shipment.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shipment_tracking_events') as any)
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as TrackingEventRow[]
    },
    staleTime: 10 * 1000,
  })

  // Fetch fresh items (for delivery_status updates)
  const { data: freshItems = items, refetch: refetchItems } = useQuery<ShipmentItemRow[]>({
    queryKey: ['shipment-items', shipment.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shipment_items') as any)
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('loading_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ShipmentItemRow[]
    },
    staleTime: 10 * 1000,
  })

  // Open dialog
  useEffect(() => {
    const el = dialogRef.current
    if (el && !el.open) el.showModal()
  }, [])

  // Update shipment status
  const updateShipmentStatus = useCallback(async (newStatus: ShipmentStatus, extra?: Record<string, unknown>) => {
    setUpdatingStatus(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase.from('shipments') as any)
        .update({ status: newStatus, ...extra })
        .eq('id', shipment.id)
      if (updateErr) throw updateErr
      setCurrentStatus(newStatus)
      queryClient.invalidateQueries({ queryKey: ['acompanhamento-shipments'] })
    } catch (err) {
      setError(`Erro ao atualizar status: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    } finally {
      setUpdatingStatus(false)
    }
  }, [shipment.id, queryClient])

  // Mark item as delivered
  const markItemDelivered = useCallback(async (itemId: string) => {
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('shipment_items') as any)
        .update({
          delivery_status: 'entregue',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', itemId)

      await refetchItems()

      // Check if all items are now delivered to auto-update shipment status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allItems } = await (supabase.from('shipment_items') as any)
        .select('delivery_status')
        .eq('shipment_id', shipment.id)
      const statuses = (allItems ?? []).map((i: { delivery_status: string }) => i.delivery_status)
      const allEntregue = statuses.length > 0 && statuses.every((s: string) => s === 'entregue')
      const someEntregue = statuses.some((s: string) => s === 'entregue')

      if (allEntregue && currentStatus !== 'entregue') {
        await updateShipmentStatus('entregue', { completed_at: new Date().toISOString() })
      } else if (someEntregue && !allEntregue && currentStatus !== 'entregue_parcial') {
        await updateShipmentStatus('entregue_parcial')
      }
    } catch (err) {
      setError(`Erro ao marcar entrega: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }, [shipment.id, currentStatus, updateShipmentStatus, refetchItems])

  // Mark operator delivery
  const markOperatorDelivered = useCallback(async (itemId: string) => {
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('shipment_items') as any)
        .update({
          operator_delivered: true,
          operator_delivered_at: new Date().toISOString(),
        })
        .eq('id', itemId)
      await refetchItems()
    } catch (err) {
      setError(`Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }, [refetchItems])

  // Submit tracking event
  const handleSubmitEvent = async () => {
    if (!eventDescription.trim()) return
    setSubmittingEvent(true)
    setError(null)
    try {
      const profileName = user?.email?.split('@')[0] ?? 'sistema'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertErr } = await (supabase.from('shipment_tracking_events') as any)
        .insert({
          shipment_id: shipment.id,
          event_type: eventType,
          description: eventDescription.trim(),
          location: eventLocation.trim() || null,
          shipment_item_id: eventItemId || null,
          reported_by: profileName,
        })
      if (insertErr) throw insertErr

      // Auto status transitions
      if (eventType === 'departure' && currentStatus === 'expedida') {
        await updateShipmentStatus('em_transito', { departed_at: new Date().toISOString() })
      }

      if (eventType === 'delivery' && eventItemId) {
        await markItemDelivered(eventItemId)
      }

      // Reset form
      setEventDescription('')
      setEventLocation('')
      setEventItemId('')
      await refetchEvents()
    } catch (err) {
      setError(`Erro ao registrar evento: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    } finally {
      setSubmittingEvent(false)
    }
  }

  const statusConfig = SHIPMENT_STATUS_CONFIG[currentStatus]
  const validTransitions = VALID_TRANSITIONS[currentStatus] ?? []

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-full max-w-full overflow-y-auto bg-card p-0 backdrop:bg-black/50"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold">{shipment.reference}</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(shipment.delivery_date), "dd/MM/yyyy", { locale: ptBR })}
            {shipment.vehicle && ` — ${shipment.vehicle.plate}`}
            {shipment.driver && ` — ${shipment.driver.name}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X size={20} />
        </button>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">

        {/* Section A — Resumo */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Truck size={20} className="text-primary" />
            Resumo da Carga
          </h3>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={cn('rounded-full px-3 py-1 text-sm font-medium', statusConfig.bgColor, statusConfig.color)}>
                {statusConfig.label}
              </span>
              {shipment.seal_number && (
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  🔒 {shipment.seal_number}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Peso Total</p>
                <p className="font-medium">{formatNumber(shipment.total_weight_kg)} kg</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="font-medium">{formatCurrency(shipment.total_value)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NFs</p>
                <p className="font-medium">{freshItems.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saída</p>
                <p className="font-medium">
                  {shipment.departed_at
                    ? format(parseISO(shipment.departed_at), "dd/MM HH:mm", { locale: ptBR })
                    : 'Não registrada'}
                </p>
              </div>
            </div>

            {/* Status transition buttons */}
            {validTransitions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                <span className="text-xs text-muted-foreground self-center">Mudar status:</span>
                {validTransitions.map(nextStatus => {
                  const nextConfig = SHIPMENT_STATUS_CONFIG[nextStatus]
                  return (
                    <button
                      key={nextStatus}
                      onClick={() => updateShipmentStatus(nextStatus)}
                      disabled={updatingStatus}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        nextConfig.bgColor, nextConfig.color,
                        'hover:opacity-80 disabled:opacity-50'
                      )}
                    >
                      {updatingStatus ? '...' : nextConfig.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Section B — NFs / Destinos */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Package size={20} className="text-primary" />
            NFs / Destinos
            <span className="text-sm font-normal text-muted-foreground">
              ({freshItems.length} {freshItems.length === 1 ? 'NF' : 'NFs'})
            </span>
          </h3>
          <div className="space-y-2">
            {freshItems.map(item => {
              const deliveryConfig = DELIVERY_ITEM_STATUS_CONFIG[item.delivery_status as DeliveryItemStatus]
              const deliveryTypeLabel = DELIVERY_TYPE_LABELS[item.delivery_type as 'direct' | 'operator']
              const isPendente = item.delivery_status === 'pendente'
              const isOperator = item.delivery_type === 'operator'

              return (
                <div key={item.id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">
                      {item.origem} {item.doc_num ?? item.doc_entry}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      — {item.card_name} ({item.uf})
                    </span>
                    <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs font-medium', deliveryConfig.bgColor, deliveryConfig.color)}>
                      {deliveryConfig.label}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatNumber(item.weight_kg ?? 0)} kg</span>
                    <span>{formatCurrency(item.doc_total)}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{deliveryTypeLabel}</span>
                    {item.delivered_at && (
                      <span className="text-green-700">
                        Entregue {format(parseISO(item.delivered_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    )}
                    {isOperator && item.operator_delivered && item.operator_delivered_at && (
                      <span className="text-blue-700">
                        Operador recebeu {format(parseISO(item.operator_delivered_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  {isPendente && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {isOperator && !item.operator_delivered && (
                        <button
                          onClick={() => markOperatorDelivered(item.id)}
                          className="flex min-h-[36px] items-center gap-1.5 rounded-md bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
                        >
                          <Navigation size={14} />
                          Entregue ao Operador
                        </button>
                      )}
                      <button
                        onClick={() => markItemDelivered(item.id)}
                        className="flex min-h-[36px] items-center gap-1.5 rounded-md bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200"
                      >
                        <CheckCircle2 size={14} />
                        Marcar como Entregue
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Section C — Timeline */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Clock size={20} className="text-primary" />
            Timeline de Eventos
            <span className="text-sm font-normal text-muted-foreground">
              ({events.length})
            </span>
          </h3>
          {events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum evento registrado ainda
            </div>
          ) : (
            <div className="space-y-2">
              {events.map(event => {
                const icon = EVENT_ICONS[event.event_type] ?? '📋'
                const label = TRACKING_EVENT_LABELS[event.event_type as TrackingEventType] ?? event.event_type
                return (
                  <div key={event.id} className="flex gap-3 rounded-md border border-border bg-card p-3">
                    <span className="text-lg">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{label}</span>
                        {event.location && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin size={10} />
                            {event.location}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {format(parseISO(event.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>
                      {event.reported_by && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">por {event.reported_by}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Section D — Register Event */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Send size={20} className="text-primary" />
            Registrar Evento
          </h3>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de Evento</label>
                <select
                  value={eventType}
                  onChange={e => setEventType(e.target.value as TrackingEventType)}
                  className="w-full rounded-md border border-border bg-white px-3 py-3 text-sm"
                >
                  {(Object.entries(TRACKING_EVENT_LABELS) as [TrackingEventType, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{EVENT_ICONS[key]} {label}</option>
                  ))}
                </select>
              </div>
              {eventType === 'delivery' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">NF (opcional)</label>
                  <select
                    value={eventItemId}
                    onChange={e => setEventItemId(e.target.value)}
                    className="w-full rounded-md border border-border bg-white px-3 py-3 text-sm"
                  >
                    <option value="">Geral</option>
                    {freshItems.filter(i => i.delivery_status === 'pendente').map(item => (
                      <option key={item.id} value={item.id}>
                        {item.origem} {item.doc_num ?? item.doc_entry} — {item.card_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição *</label>
              <input
                type="text"
                value={eventDescription}
                onChange={e => setEventDescription(e.target.value)}
                placeholder="Ex: Saída da fábrica às 08:00"
                className="w-full rounded-md border border-border bg-white px-3 py-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Localização (opcional)</label>
              <input
                type="text"
                value={eventLocation}
                onChange={e => setEventLocation(e.target.value)}
                placeholder="Ex: Recife - PE"
                className="w-full rounded-md border border-border bg-white px-3 py-3 text-sm"
              />
            </div>
            <button
              onClick={handleSubmitEvent}
              disabled={submittingEvent || !eventDescription.trim()}
              className={cn(
                'flex min-h-[44px] items-center gap-2 rounded-md px-6 py-2.5 text-sm font-medium text-white transition-colors',
                !submittingEvent && eventDescription.trim()
                  ? 'bg-primary hover:bg-primary/90'
                  : 'cursor-not-allowed bg-gray-400'
              )}
            >
              {submittingEvent ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
              Registrar Evento
            </button>
          </div>
        </section>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
      </div>
    </dialog>
  )
}
