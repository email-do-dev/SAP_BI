import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Plus, Calendar, List, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SHIPMENT_STATUS_CONFIG, type ShipmentStatus } from '@/lib/logistics-constants'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ShipmentCalendar } from './shipment-calendar'
import { CalendarDayDetail } from './calendar-day-detail'
import { OrderSelectionTable, type OrderFilters } from './order-selection-table'
import { ShipmentCreateDialog } from './shipment-create-dialog'
import { ShipmentEditDialog } from './shipment-edit-dialog'
import { SkuWeeklyTable } from './sku-weekly-table'
import { useWeeklySkuTotals } from '@/hooks/use-weekly-sku-totals'
import type { Database } from '@/types/database'

type PedidoRow = Database['public']['Tables']['sap_cache_pedidos']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type DriverRow = Database['public']['Tables']['drivers']['Row']
type ShipmentItemRow = Database['public']['Tables']['shipment_items']['Row']
type ShipmentRow = Database['public']['Tables']['shipments']['Row']

export interface ShipmentWithRelations extends ShipmentRow {
  vehicle?: VehicleRow | null
  driver?: DriverRow | null
  items?: ShipmentItemRow[]
}

type ViewMode = 'calendar' | 'list'
type CalendarView = 'month' | 'week'

export function TabProgramacao() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [orderPanelOpen, setOrderPanelOpen] = useState(true)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingShipment, setEditingShipment] = useState<ShipmentWithRelations | null>(null)
  const [orderFilters, setOrderFilters] = useState<OrderFilters>({ uf: '', vendedor: '', grupo: '', search: '', maxAgeDays: 30 })
  const [calView, setCalView] = useState<CalendarView>('week')
  const [weekAnchor, setWeekAnchor] = useState(new Date())

  // Week boundaries for SKU table
  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor])
  const weekEnd = useMemo(() => endOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor])

  // Month boundaries for query
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd')
  const monthKey = format(currentMonth, 'yyyy-MM')

  // Fetch shipments for month
  const { data: shipments = [], isLoading: shipmentsLoading } = useQuery<ShipmentWithRelations[]>({
    queryKey: ['shipments', monthKey],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shipments') as any)
        .select('*, vehicle:vehicles(*), driver:drivers(*), items:shipment_items(*)')
        .gte('delivery_date', monthStart)
        .lte('delivery_date', monthEnd)
        .neq('status', 'cancelada')
        .order('delivery_date')
      if (error) throw error
      return (data ?? []) as unknown as ShipmentWithRelations[]
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Fetch doc_entries already assigned to shipments
  const { data: assignedDocEntries = [] as number[] } = useQuery<number[]>({
    queryKey: ['assigned-doc-entries'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shipment_items') as any)
        .select('doc_entry')
      if (error) throw error
      return (data ?? []).map((r: { doc_entry: number }) => r.doc_entry)
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch pending orders (excluding already-assigned)
  const { data: pendingOrders = [], isLoading: ordersLoading } = useQuery<PedidoRow[]>({
    queryKey: ['pending-orders', assignedDocEntries],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sap_cache_pedidos')
        .select('*')
        .in('status_pedido', ['Pedido', 'Faturado'])
        .order('doc_date', { ascending: false })
      if (error) throw error
      const orders = (data ?? []) as PedidoRow[]
      if (assignedDocEntries.length === 0) return orders
      const assignedSet = new Set(assignedDocEntries)
      return orders.filter((o) => !assignedSet.has(o.doc_entry))
    },
    staleTime: 5 * 60 * 1000,
  })

  // Weekly SKU totals
  const { data: weeklySkuData = [], isLoading: skuLoading } = useWeeklySkuTotals(weekStart, weekEnd)

  // Shipments for selected date
  const dayShipments = useMemo(() => {
    if (!selectedDate) return []
    return shipments.filter((s) => {
      const d = s.delivery_date?.slice(0, 10)
      if (!d) return false
      return isSameDay(parseISO(d), selectedDate)
    })
  }, [shipments, selectedDate])

  // Toggle order selection
  const toggleOrder = useCallback((id: string) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Toggle all FILTERED orders
  const toggleAll = useCallback((filteredIds: string[]) => {
    setSelectedOrders((prev) => {
      const allSelected = filteredIds.every((id) => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        filteredIds.forEach((id) => next.delete(id))
        return next
      }
      const next = new Set(prev)
      filteredIds.forEach((id) => next.add(id))
      return next
    })
  }, [])

  // Get selected order objects for dialog
  const selectedOrderObjects = useMemo(
    () => pendingOrders.filter((o) => selectedOrders.has(o.id)),
    [pendingOrders, selectedOrders]
  )

  function handleNewShipment() {
    setCreateDialogOpen(true)
  }

  function handleSelectShipment(shipment: ShipmentWithRelations) {
    setEditingShipment(shipment)
  }

  return (
    <div className="flex gap-4">
      {/* Left panel: Calendar / List + Day Detail + SKU Table */}
      <div className={cn('flex-1 space-y-4 transition-all', orderPanelOpen ? 'w-[55%]' : 'w-full')}>
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                viewMode === 'calendar' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Calendar size={14} />
              Calendário
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                viewMode === 'list' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <List size={14} />
              Lista
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewShipment}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus size={16} />
              Nova Carga {selectedOrders.size > 0 && `(${selectedOrders.size})`}
            </button>
            <button
              onClick={() => setOrderPanelOpen(!orderPanelOpen)}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title={orderPanelOpen ? 'Fechar painel de pedidos' : 'Abrir painel de pedidos'}
            >
              {orderPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </div>
        </div>

        {/* Calendar or List view */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          {shipmentsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : viewMode === 'calendar' ? (
            <ShipmentCalendar
              shipments={shipments}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onSelectShipment={handleSelectShipment}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              calView={calView}
              onCalViewChange={setCalView}
              weekAnchor={weekAnchor}
              onWeekAnchorChange={setWeekAnchor}
            />
          ) : (
            /* List view */
            <div className="space-y-2">
              <h3 className="text-sm font-semibold capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              {shipments.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
                  <p className="text-sm text-muted-foreground">Nenhuma carga programada neste mês</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {shipments.map((s) => {
                    const cfg = SHIPMENT_STATUS_CONFIG[s.status as ShipmentStatus] ?? SHIPMENT_STATUS_CONFIG.programada
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleSelectShipment(s)}
                        className="flex w-full items-center justify-between px-2 py-2.5 text-left text-sm hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{s.reference}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bgColor, cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{(s as ShipmentWithRelations).vehicle?.plate ?? '-'}</span>
                          <span>{s.delivery_date ? format(parseISO(s.delivery_date), 'dd/MM') : '-'}</span>
                          <span>{(s.total_weight_kg ?? 0).toLocaleString('pt-BR')} kg</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Day detail (only in calendar view) */}
        {viewMode === 'calendar' && selectedDate && (
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <CalendarDayDetail
              date={selectedDate}
              shipments={dayShipments}
              onSelectShipment={handleSelectShipment}
              onNewShipment={handleNewShipment}
            />
          </div>
        )}

        {/* SKU Weekly Table */}
        <SkuWeeklyTable
          data={weeklySkuData}
          isLoading={skuLoading}
          weekStart={weekStart}
          weekEnd={weekEnd}
        />
      </div>

      {/* Right panel: Order selection */}
      {orderPanelOpen && (
        <div className="w-[45%] min-w-[380px] rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Pedidos Pendentes</h3>
            <p className="text-xs text-muted-foreground">
              {ordersLoading ? 'Carregando...' : `${pendingOrders.length} pedidos disponíveis`}
            </p>
          </div>
          {ordersLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <OrderSelectionTable
              orders={pendingOrders}
              selectedOrders={selectedOrders}
              onToggleOrder={toggleOrder}
              onToggleAll={toggleAll}
              filters={orderFilters}
              onFilterChange={setOrderFilters}
            />
          )}
        </div>
      )}

      {/* Edit shipment dialog */}
      <ShipmentEditDialog
        shipment={editingShipment}
        open={!!editingShipment}
        onClose={() => setEditingShipment(null)}
        pendingOrders={pendingOrders}
        allShipments={shipments}
      />

      {/* Create shipment dialog */}
      <ShipmentCreateDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false)
          setSelectedOrders(new Set())
        }}
        selectedOrders={selectedOrderObjects}
        pendingOrders={pendingOrders}
        preselectedDate={selectedDate ?? undefined}
        allShipments={shipments}
        onRemoveOrder={(id) => {
          setSelectedOrders((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }}
      />
    </div>
  )
}
