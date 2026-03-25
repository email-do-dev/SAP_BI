import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
const toast = {
  success: (msg: string) => console.log('[success]', msg),
  error: (msg: string) => console.error('[error]', msg),
}
import { Dialog } from '@/components/shared/dialog'
import { CapacityGauge } from './capacity-gauge'
import { cn, formatCurrency } from '@/lib/utils'
import { VEHICLE_TYPE_CONFIG, DELIVERY_TYPE_LABELS, type VehicleType, type DeliveryType } from '@/lib/logistics-constants'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ChevronUp, X, Plus, Search, AlertTriangle } from 'lucide-react'
import type { Database } from '@/types/database'
import type { ShipmentWithRelations } from './tab-programacao'

type PedidoRow = Database['public']['Tables']['sap_cache_pedidos']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type DriverRow = Database['public']['Tables']['drivers']['Row']
type OperatorRow = Database['public']['Tables']['logistics_operators']['Row']

interface ShipmentCreateDialogProps {
  open: boolean
  onClose: () => void
  selectedOrders: PedidoRow[]
  pendingOrders?: PedidoRow[]
  preselectedDate?: Date
  allShipments?: ShipmentWithRelations[]
  onRemoveOrder?: (id: string) => void
}

interface OrderWithDeliveryType extends PedidoRow {
  delivery_type: DeliveryType
}

function formatPallets(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function ShipmentCreateDialog({
  open,
  onClose,
  selectedOrders,
  pendingOrders = [],
  preselectedDate,
  allShipments = [],
  onRemoveOrder,
}: ShipmentCreateDialogProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [orderListOpen, setOrderListOpen] = useState(true)
  const [vehicleId, setVehicleId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [operatorId, setOperatorId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(
    preselectedDate ? format(preselectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  )
  const [ordersWithType, setOrdersWithType] = useState<OrderWithDeliveryType[]>([])
  const [addedOrders, setAddedOrders] = useState<PedidoRow[]>([])
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addSearch, setAddSearch] = useState('')

  // Initialize orders with delivery_type when dialog opens
  useEffect(() => {
    setOrdersWithType(selectedOrders.map((o) => ({ ...o, delivery_type: 'direct' as DeliveryType })))
    setAddedOrders([])
    setShowAddPanel(false)
    setAddSearch('')
  }, [selectedOrders])

  // Filter available orders for add panel
  const availableOrders = useMemo(() => {
    const selectedDocEntries = new Set(ordersWithType.map((o) => o.doc_entry))
    const addedDocEntries = new Set(addedOrders.map((o) => o.doc_entry))
    return pendingOrders.filter((o) => {
      if (selectedDocEntries.has(o.doc_entry) || addedDocEntries.has(o.doc_entry)) return false
      if (!addSearch) return true
      const s = addSearch.toLowerCase()
      return (
        String(o.doc_num).includes(s) ||
        (o.card_name ?? '').toLowerCase().includes(s) ||
        (o.uf ?? '').toLowerCase().includes(s)
      )
    })
  }, [pendingOrders, ordersWithType, addedOrders, addSearch])

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery<VehicleRow[]>({
    queryKey: ['vehicles-active'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('vehicles') as any).select('*').eq('is_active', true)
      return data ?? []
    },
    enabled: open,
  })

  // Fetch drivers
  const { data: drivers = [] } = useQuery<DriverRow[]>({
    queryKey: ['drivers-active'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('drivers') as any).select('*').eq('is_active', true)
      return data ?? []
    },
    enabled: open,
  })

  // Fetch operators
  const { data: operators = [] } = useQuery<OperatorRow[]>({
    queryKey: ['operators-active'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('logistics_operators') as any).select('*').eq('is_active', true)
      return data ?? []
    },
    enabled: open,
  })

  // Selected vehicle info
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)
  const vehicleType = selectedVehicle?.vehicle_type as VehicleType | undefined
  const vehicleDefaults = vehicleType ? VEHICLE_TYPE_CONFIG[vehicleType] : null

  const maxWeight = selectedVehicle?.max_weight_kg ?? vehicleDefaults?.defaultWeight ?? 0
  const maxPallets = selectedVehicle?.max_pallets ?? vehicleDefaults?.defaultPallets ?? 0

  // Merge pre-selected + added orders for totals and mutation
  const allOrdersWithType = useMemo(() => {
    const added = addedOrders.map((o) => ({ ...o, delivery_type: 'direct' as DeliveryType }))
    return [...ordersWithType, ...added]
  }, [ordersWithType, addedOrders])

  // Totals from all orders
  const totals = useMemo(() => {
    return allOrdersWithType.reduce(
      (acc, o) => ({
        weight: acc.weight + (o.total_weight_kg ?? 0),
        volume: acc.volume + (o.total_volume_m3 ?? 0),
        value: acc.value + (o.doc_total ?? 0),
        pallets: acc.pallets + (o.total_pallets ?? 0),
        count: acc.count + 1,
      }),
      { weight: 0, volume: 0, value: 0, pallets: 0, count: 0 }
    )
  }, [allOrdersWithType])

  // Destination summary
  const destinoSummary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const o of allOrdersWithType) {
      const uf = o.uf ?? ''
      if (uf) counts[uf] = (counts[uf] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [allOrdersWithType])

  // Capacity warnings
  const weightPct = maxWeight > 0 ? (totals.weight / maxWeight) * 100 : 0
  const palletPct = maxPallets > 0 ? (totals.pallets / maxPallets) * 100 : 0
  const weightOverLimit = weightPct > 100
  const palletOverLimit = palletPct > 100
  const weightWarning = weightPct > 90
  const palletWarning = palletPct > 90

  // Vehicle already allocated warning
  const vehicleAlreadyAllocated = useMemo(() => {
    if (!vehicleId || !deliveryDate) return false
    return allShipments.some(
      (s) => s.vehicle_id === vehicleId && s.delivery_date?.slice(0, 10) === deliveryDate
    )
  }, [vehicleId, deliveryDate, allShipments])

  function toggleDeliveryType(idx: number) {
    const preSelectedCount = ordersWithType.length
    if (idx < preSelectedCount) {
      setOrdersWithType((prev) =>
        prev.map((o, i) =>
          i === idx ? { ...o, delivery_type: o.delivery_type === 'direct' ? 'operator' : 'direct' } : o
        )
      )
    }
  }

  // Create shipment mutation
  const createShipment = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // Insert shipment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newShipment, error: shipmentError } = await (supabase.from('shipments') as any)
        .insert({
          delivery_date: deliveryDate,
          vehicle_id: vehicleId,
          driver_id: driverId || null,
          operator_id: operatorId || null,
          total_weight_kg: totals.weight,
          total_volume_m3: totals.volume,
          total_pallets: totals.pallets,
          total_value: totals.value,
          total_boxes: 0,
          created_by: user.id,
        } as Database['public']['Tables']['shipments']['Insert'])
        .select()
        .single()
      if (shipmentError) throw shipmentError

      // Insert shipment items
      const itemsToInsert = allOrdersWithType.map((order) => ({
        shipment_id: newShipment.id,
        doc_entry: order.doc_entry,
        doc_num: order.doc_num,
        origem: order.origem ?? 'PV',
        card_code: order.card_code,
        card_name: order.card_name,
        doc_total: order.doc_total,
        weight_kg: order.total_weight_kg,
        volume_m3: order.total_volume_m3,
        pallet_count: order.total_pallets ?? 0,
        delivery_type: order.delivery_type,
        uf: order.uf ?? '',
      } as Database['public']['Tables']['shipment_items']['Insert']))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: itemsError } = await (supabase.from('shipment_items') as any)
        .insert(itemsToInsert)
      if (itemsError) throw itemsError

      return newShipment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      queryClient.invalidateQueries({ queryKey: ['assigned-doc-entries'] })
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-sku-totals'] })
      toast.success('Carga criada com sucesso!')
      handleClose()
    },
    onError: (err) => {
      toast.error('Erro ao criar carga: ' + (err as Error).message)
    },
  })

  function handleClose() {
    setStep(1)
    setVehicleId('')
    setDriverId('')
    setOperatorId('')
    setAddedOrders([])
    setShowAddPanel(false)
    setAddSearch('')
    onClose()
  }

  function handleNext() {
    if (allOrdersWithType.length === 0) {
      toast.error('Adicione pelo menos um pedido')
      return
    }
    if (!vehicleId) {
      toast.error('Selecione um veículo')
      return
    }
    if (!deliveryDate) {
      toast.error('Informe a data de entrega')
      return
    }
    setStep(2)
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Criar Nova Carga" className="max-w-3xl">
      {step === 1 ? (
        <div className="space-y-5">
          {/* Vehicle select */}
          <div>
            <label className="mb-1 block text-sm font-medium">Veículo *</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Selecione um veículo</option>
              {vehicles.map((v) => {
                const vt = v.vehicle_type as VehicleType
                const cfg = VEHICLE_TYPE_CONFIG[vt]
                return (
                  <option key={v.id} value={v.id}>
                    {v.plate} - {cfg?.label ?? v.vehicle_type} ({v.ownership === 'own' ? 'Próprio' : 'Spot'})
                    {v.max_weight_kg ? ` - ${(v.max_weight_kg / 1000).toFixed(0)}t` : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Vehicle already allocated warning */}
          {vehicleAlreadyAllocated && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="flex-shrink-0" />
              Este veículo já possui carga programada para esta data
            </div>
          )}

          {/* Driver select */}
          <div>
            <label className="mb-1 block text-sm font-medium">Motorista</label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Selecione um motorista</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Operator select */}
          <div>
            <label className="mb-1 block text-sm font-medium">Operador (opcional)</label>
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Sem operador</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>{op.name}</option>
              ))}
            </select>
          </div>

          {/* Delivery date */}
          <div>
            <label className="mb-1 block text-sm font-medium">Data de Entrega *</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Capacity gauges + warnings */}
          {selectedVehicle && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Capacidade do Veículo</h4>
              <CapacityGauge current={totals.weight} max={maxWeight} label="Peso" unit="kg" />
              <CapacityGauge current={totals.pallets} max={maxPallets} label="Paletes" unit="un" />

              {weightOverLimit && (
                <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-800">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  Peso excede a capacidade em {(totals.weight - maxWeight).toLocaleString('pt-BR')} kg
                </div>
              )}
              {!weightOverLimit && weightWarning && (
                <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  Peso acima de 90% da capacidade
                </div>
              )}
              {palletOverLimit && (
                <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-800">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  Pallets excedem a capacidade em {formatPallets(totals.pallets - maxPallets)}
                </div>
              )}
              {!palletOverLimit && palletWarning && (
                <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  Pallets acima de 90% da capacidade
                </div>
              )}
            </div>
          )}

          {/* Destination summary */}
          {destinoSummary.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">Destinos:</span>
              {destinoSummary.map(([uf, count]) => (
                <span key={uf} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                  {uf} ({count})
                </span>
              ))}
            </div>
          )}

          {/* Order summary list */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setOrderListOpen(!orderListOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              <span>
                {totals.count} pedido{totals.count !== 1 ? 's' : ''} selecionado{totals.count !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Peso: {totals.weight.toLocaleString('pt-BR')} kg</span>
                <span>Pallets: {formatPallets(totals.pallets)}</span>
                <span>{formatCurrency(totals.value)}</span>
                {orderListOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            {orderListOpen && (
              <div className="max-h-[200px] overflow-auto border-t border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr className="text-left text-xs font-medium text-muted-foreground">
                      <th className="px-3 py-1.5">Pedido</th>
                      <th className="px-3 py-1.5">Cliente</th>
                      <th className="px-3 py-1.5">UF</th>
                      <th className="px-3 py-1.5 text-right">Valor</th>
                      <th className="px-3 py-1.5 text-right">Peso</th>
                      <th className="px-3 py-1.5 text-right">Pallets</th>
                      <th className="px-3 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ordersWithType.map((order) => (
                      <tr key={order.id} className="text-xs">
                        <td className="px-3 py-1.5 font-medium">{order.doc_num}</td>
                        <td className="max-w-[150px] truncate px-3 py-1.5" title={order.card_name}>
                          {order.card_name}
                        </td>
                        <td className="px-3 py-1.5">{order.uf}</td>
                        <td className="px-3 py-1.5 text-right">{formatCurrency(order.doc_total)}</td>
                        <td className="px-3 py-1.5 text-right">{(order.total_weight_kg ?? 0).toLocaleString('pt-BR')} kg</td>
                        <td className="px-3 py-1.5 text-right">{formatPallets(order.total_pallets ?? 0)}</td>
                        <td className="px-3 py-1.5">
                          {onRemoveOrder && (
                            <button
                              type="button"
                              onClick={() => onRemoveOrder(order.id)}
                              className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Remover pedido"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {addedOrders.map((order) => (
                      <tr key={`added-${order.id}`} className="text-xs bg-green-50">
                        <td className="px-3 py-1.5 font-medium">
                          {order.doc_num}
                          <span className="ml-1 text-[10px] text-green-600">novo</span>
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-1.5" title={order.card_name}>
                          {order.card_name}
                        </td>
                        <td className="px-3 py-1.5">{order.uf}</td>
                        <td className="px-3 py-1.5 text-right">{formatCurrency(order.doc_total)}</td>
                        <td className="px-3 py-1.5 text-right">{(order.total_weight_kg ?? 0).toLocaleString('pt-BR')} kg</td>
                        <td className="px-3 py-1.5 text-right">{formatPallets(order.total_pallets ?? 0)}</td>
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => setAddedOrders((prev) => prev.filter((o) => o.id !== order.id))}
                            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Remover pedido"
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {ordersWithType.length === 0 && addedOrders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-xs text-muted-foreground">
                          Nenhum pedido adicionado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add orders button */}
          <button
            type="button"
            onClick={() => setShowAddPanel(!showAddPanel)}
            className="flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus size={14} />
            Adicionar Pedidos
          </button>

          {/* Add orders search panel */}
          {showAddPanel && (
            <div className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <Search size={14} className="text-muted-foreground" />
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Buscar pedido, cliente, UF..."
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="max-h-[180px] overflow-auto">
                {availableOrders.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Nenhum pedido disponível</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr className="text-left font-medium text-muted-foreground">
                        <th className="px-2 py-1">Pedido</th>
                        <th className="px-2 py-1">Cliente</th>
                        <th className="px-2 py-1">UF</th>
                        <th className="px-2 py-1 text-right">Valor</th>
                        <th className="px-2 py-1 text-right">Peso</th>
                        <th className="px-2 py-1 text-right">Pallets</th>
                        <th className="px-2 py-1 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {availableOrders.slice(0, 50).map((order) => (
                        <tr key={order.id} className="hover:bg-muted/50">
                          <td className="px-2 py-1 font-medium">{order.doc_num}</td>
                          <td className="max-w-[120px] truncate px-2 py-1" title={order.card_name}>{order.card_name}</td>
                          <td className="px-2 py-1">{order.uf}</td>
                          <td className="px-2 py-1 text-right">{formatCurrency(order.doc_total)}</td>
                          <td className="px-2 py-1 text-right">{(order.total_weight_kg ?? 0).toLocaleString('pt-BR')} kg</td>
                          <td className="px-2 py-1 text-right">{formatPallets(order.total_pallets ?? 0)}</td>
                          <td className="px-2 py-1">
                            <button
                              type="button"
                              onClick={() => setAddedOrders((prev) => [...prev, order])}
                              className="rounded p-0.5 text-muted-foreground hover:bg-green-100 hover:text-green-700"
                              title="Adicionar pedido"
                            >
                              <Plus size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
              {totals.count} pedido{totals.count !== 1 ? 's' : ''} | {formatCurrency(totals.value)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleNext}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>Veículo: <strong className="text-foreground">{selectedVehicle?.plate}</strong></span>
            {driverId && <span>Motorista: <strong className="text-foreground">{drivers.find((d) => d.id === driverId)?.name}</strong></span>}
            <span>Data: <strong className="text-foreground">{deliveryDate ? format(parseISO(deliveryDate), 'dd/MM/yyyy') : '-'}</strong></span>
          </div>

          {/* Orders review */}
          <div className="max-h-[350px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2">Pedido</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-right">Peso</th>
                  <th className="px-3 py-2">Tipo Entrega</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allOrdersWithType.map((order, idx) => (
                  <tr key={order.id}>
                    <td className="px-3 py-2 font-medium">{order.doc_num}</td>
                    <td className="max-w-[200px] truncate px-3 py-2" title={order.card_name}>
                      {order.card_name}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(order.doc_total)}</td>
                    <td className="px-3 py-2 text-right">{(order.total_weight_kg ?? 0).toLocaleString('pt-BR')} kg</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleDeliveryType(idx)}
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                          order.delivery_type === 'direct'
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        )}
                      >
                        {DELIVERY_TYPE_LABELS[order.delivery_type]}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex items-center gap-4 rounded-lg bg-muted/50 px-4 py-2 text-sm">
            <span className="font-medium">{totals.count} pedido{totals.count !== 1 ? 's' : ''}</span>
            <span>Peso: <strong>{totals.weight.toLocaleString('pt-BR')} kg</strong></span>
            <span>Pallets: <strong>{formatPallets(totals.pallets)}</strong></span>
            <span>Valor: <strong>{formatCurrency(totals.value)}</strong></span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Voltar
            </button>
            <button
              onClick={() => createShipment.mutate()}
              disabled={createShipment.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {createShipment.isPending ? 'Criando...' : 'Criar Carga'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
