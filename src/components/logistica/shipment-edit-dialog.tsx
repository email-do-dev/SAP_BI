import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Dialog } from '@/components/shared/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { VEHICLE_TYPE_CONFIG, SHIPMENT_STATUS_CONFIG, VALID_TRANSITIONS, type VehicleType, type ShipmentStatus } from '@/lib/logistics-constants'
import { format, parseISO } from 'date-fns'
import { Trash2, Ban, Plus, Search, X, AlertTriangle } from 'lucide-react'
import type { Database } from '@/types/database'
import type { ShipmentWithRelations } from './tab-programacao'
import { CapacityGauge } from './capacity-gauge'

const toast = {
  success: (msg: string) => console.log('[success]', msg),
  error: (msg: string) => console.error('[error]', msg),
}

type PedidoRow = Database['public']['Tables']['sap_cache_pedidos']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type DriverRow = Database['public']['Tables']['drivers']['Row']
type OperatorRow = Database['public']['Tables']['logistics_operators']['Row']

interface ShipmentEditDialogProps {
  shipment: ShipmentWithRelations | null
  open: boolean
  onClose: () => void
  pendingOrders?: PedidoRow[]
  allShipments?: ShipmentWithRelations[]
}

function formatPallets(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function ShipmentEditDialog({ shipment, open, onClose, pendingOrders = [], allShipments = [] }: ShipmentEditDialogProps) {
  const queryClient = useQueryClient()
  const [vehicleId, setVehicleId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [operatorId, setOperatorId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [status, setStatus] = useState<ShipmentStatus>('programada')
  const [notes, setNotes] = useState('')
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const [addedOrders, setAddedOrders] = useState<PedidoRow[]>([])
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addSearch, setAddSearch] = useState('')

  // Initialize form when shipment changes
  if (shipment && (!initialized || vehicleId === '')) {
    setVehicleId(shipment.vehicle_id ?? '')
    setDriverId(shipment.driver_id ?? '')
    setOperatorId(shipment.operator_id ?? '')
    setDeliveryDate(shipment.delivery_date?.slice(0, 10) ?? '')
    setStatus(shipment.status as ShipmentStatus)
    setNotes(shipment.notes ?? '')
    setRemovedItemIds(new Set())
    setAddedOrders([])
    setShowAddPanel(false)
    setAddSearch('')
    setInitialized(true)
  }

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

  const items = shipment?.items?.filter((i) => !removedItemIds.has(i.id)) ?? []
  const totalWeight = items.reduce((sum, i) => sum + (i.weight_kg ?? 0), 0)
    + addedOrders.reduce((s, o) => s + (o.total_weight_kg ?? 0), 0)
  const totalValue = items.reduce((sum, i) => sum + (i.doc_total ?? 0), 0)
    + addedOrders.reduce((s, o) => s + (o.doc_total ?? 0), 0)
  const totalPallets = items.reduce((sum, i) => sum + (i.pallet_count ?? 0), 0)
    + addedOrders.reduce((sum, o) => sum + (o.total_pallets ?? 0), 0)

  // Filter available orders for add panel
  const availableOrders = useMemo(() => {
    const existingDocEntries = new Set(items.map((i) => i.doc_entry))
    const addedDocEntries = new Set(addedOrders.map((o) => o.doc_entry))
    return pendingOrders.filter((o) => {
      if (existingDocEntries.has(o.doc_entry) || addedDocEntries.has(o.doc_entry)) return false
      if (!addSearch) return true
      const s = addSearch.toLowerCase()
      return (
        String(o.doc_num).includes(s) ||
        (o.card_name ?? '').toLowerCase().includes(s) ||
        (o.uf ?? '').toLowerCase().includes(s)
      )
    })
  }, [pendingOrders, items, addedOrders, addSearch])

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)
  const vehicleType = selectedVehicle?.vehicle_type as VehicleType | undefined
  const vehicleDefaults = vehicleType ? VEHICLE_TYPE_CONFIG[vehicleType] : null
  const maxWeight = selectedVehicle?.max_weight_kg ?? vehicleDefaults?.defaultWeight ?? 0
  const maxPallets = selectedVehicle?.max_pallets ?? vehicleDefaults?.defaultPallets ?? 0

  // Valid status transitions
  const currentShipmentStatus = (shipment?.status ?? 'programada') as ShipmentStatus
  const validNextStatuses = VALID_TRANSITIONS[currentShipmentStatus] ?? []
  const statusOptions = [currentShipmentStatus, ...validNextStatuses]

  // Vehicle already allocated warning
  const vehicleAlreadyAllocated = useMemo(() => {
    if (!vehicleId || !deliveryDate || !shipment) return false
    return allShipments.some(
      (s) => s.id !== shipment.id && s.vehicle_id === vehicleId && s.delivery_date?.slice(0, 10) === deliveryDate
    )
  }, [vehicleId, deliveryDate, allShipments, shipment])

  // Capacity warnings
  const weightPct = maxWeight > 0 ? (totalWeight / maxWeight) * 100 : 0
  const palletPct = maxPallets > 0 ? (totalPallets / maxPallets) * 100 : 0

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!shipment) throw new Error('Sem carga selecionada')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from('shipments') as any)
        .update({
          vehicle_id: vehicleId,
          driver_id: driverId || null,
          operator_id: operatorId || null,
          delivery_date: deliveryDate,
          status,
          notes: notes || null,
          total_weight_kg: totalWeight,
          total_value: totalValue,
          total_pallets: totalPallets,
        } as Database['public']['Tables']['shipments']['Update'])
        .eq('id', shipment.id)
      if (updateError) throw updateError

      // Delete removed items
      if (removedItemIds.size > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteError } = await (supabase.from('shipment_items') as any)
          .delete()
          .in('id', Array.from(removedItemIds))
        if (deleteError) throw deleteError
      }

      // Insert newly added orders
      if (addedOrders.length > 0) {
        const newItems = addedOrders.map((order) => ({
          shipment_id: shipment.id,
          doc_entry: order.doc_entry,
          doc_num: order.doc_num,
          origem: order.origem ?? 'PV',
          card_code: order.card_code,
          card_name: order.card_name,
          doc_total: order.doc_total,
          weight_kg: order.total_weight_kg,
          volume_m3: order.total_volume_m3,
          pallet_count: order.total_pallets ?? 0,
          delivery_type: 'direct',
          uf: order.uf ?? '',
        } as Database['public']['Tables']['shipment_items']['Insert']))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase.from('shipment_items') as any).insert(newItems)
        if (insertError) throw insertError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      queryClient.invalidateQueries({ queryKey: ['assigned-doc-entries'] })
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-sku-totals'] })
      toast.success('Carga atualizada com sucesso!')
      handleClose()
    },
    onError: (err) => {
      toast.error('Erro ao salvar: ' + (err as Error).message)
    },
  })

  // Cancel shipment mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!shipment) throw new Error('Sem carga selecionada')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase.from('shipment_items') as any)
        .delete()
        .eq('shipment_id', shipment.id)
      if (deleteError) throw deleteError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from('shipments') as any)
        .update({ status: 'cancelada', total_weight_kg: 0, total_value: 0 })
        .eq('id', shipment.id)
      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      queryClient.invalidateQueries({ queryKey: ['assigned-doc-entries'] })
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-sku-totals'] })
      toast.success('Carga cancelada com sucesso!')
      handleClose()
    },
    onError: (err) => {
      toast.error('Erro ao cancelar: ' + (err as Error).message)
    },
  })

  function handleCancel() {
    if (window.confirm('Tem certeza que deseja cancelar esta carga? Todos os pedidos serão liberados.')) {
      cancelMutation.mutate()
    }
  }

  function handleClose() {
    setInitialized(false)
    setAddedOrders([])
    setShowAddPanel(false)
    setAddSearch('')
    onClose()
  }

  if (!shipment) return null

  const statusCfg = SHIPMENT_STATUS_CONFIG[shipment.status as ShipmentStatus] ?? SHIPMENT_STATUS_CONFIG.programada

  return (
    <Dialog open={open} onClose={handleClose} title={`Editar ${shipment.reference}`} className="max-w-3xl">
      <div className="space-y-5">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusCfg.bgColor, statusCfg.color)}>
            {statusCfg.label}
          </span>
          <span className="text-xs text-muted-foreground">
            Criada em {format(parseISO(shipment.created_at), 'dd/MM/yyyy HH:mm')}
          </span>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-2 gap-4">
          {/* Vehicle */}
          <div>
            <label className="mb-1 block text-sm font-medium">Veículo *</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Selecione</option>
              {vehicles.map((v) => {
                const vt = v.vehicle_type as VehicleType
                const cfg = VEHICLE_TYPE_CONFIG[vt]
                return (
                  <option key={v.id} value={v.id}>
                    {v.plate} - {cfg?.label ?? v.vehicle_type}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Driver */}
          <div>
            <label className="mb-1 block text-sm font-medium">Motorista</label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Selecione</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Operator */}
          <div>
            <label className="mb-1 block text-sm font-medium">Operador</label>
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

          {/* Status (with valid transitions) */}
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              {statusOptions.map((key) => {
                const cfg = SHIPMENT_STATUS_CONFIG[key]
                return (
                  <option key={key} value={key}>{cfg?.label ?? key}</option>
                )
              })}
            </select>
          </div>

          {/* Capacity gauges */}
          <div className="flex flex-col justify-end gap-1">
            {selectedVehicle && (
              <>
                <CapacityGauge current={totalWeight} max={maxWeight} label="Peso" unit="kg" />
                <CapacityGauge current={totalPallets} max={maxPallets} label="Paletes" unit="un" />
              </>
            )}
          </div>
        </div>

        {/* Warnings */}
        {vehicleAlreadyAllocated && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="flex-shrink-0" />
            Este veículo já possui outra carga programada para esta data
          </div>
        )}
        {weightPct > 100 && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-800">
            <AlertTriangle size={14} className="flex-shrink-0" />
            Peso excede a capacidade em {(totalWeight - maxWeight).toLocaleString('pt-BR')} kg
          </div>
        )}
        {palletPct > 100 && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-800">
            <AlertTriangle size={14} className="flex-shrink-0" />
            Pallets excedem a capacidade em {formatPallets(totalPallets - maxPallets)}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium">Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            placeholder="Observações sobre a carga..."
          />
        </div>

        {/* Orders list */}
        <div>
          <h4 className="mb-2 text-sm font-medium">
            Pedidos ({items.length + addedOrders.length})
            {removedItemIds.size > 0 && (
              <span className="ml-2 text-xs text-destructive">
                {removedItemIds.size} removido{removedItemIds.size !== 1 ? 's' : ''}
              </span>
            )}
          </h4>
          <div className="max-h-[250px] overflow-auto rounded-lg border border-border">
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
                {items.map((item) => (
                  <tr key={item.id} className="text-xs">
                    <td className="px-3 py-1.5 font-medium">{item.doc_num ?? item.doc_entry}</td>
                    <td className="max-w-[150px] truncate px-3 py-1.5" title={item.card_name}>
                      {item.card_name}
                    </td>
                    <td className="px-3 py-1.5">{item.uf}</td>
                    <td className="px-3 py-1.5 text-right">{formatCurrency(item.doc_total)}</td>
                    <td className="px-3 py-1.5 text-right">{(item.weight_kg ?? 0).toLocaleString('pt-BR')} kg</td>
                    <td className="px-3 py-1.5 text-right">{formatPallets(item.pallet_count ?? 0)}</td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => setRemovedItemIds((prev) => new Set([...prev, item.id]))}
                        className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remover pedido"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Added orders (not yet saved) */}
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
                {items.length === 0 && addedOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Nenhum pedido na carga
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add orders button */}
          {shipment.status === 'programada' && (
            <button
              type="button"
              onClick={() => setShowAddPanel(!showAddPanel)}
              className="mt-2 flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus size={14} />
              Adicionar Pedidos
            </button>
          )}

          {/* Add orders panel */}
          {showAddPanel && (
            <div className="mt-2 rounded-lg border border-border p-3">
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
        </div>

        {/* Totals */}
        <div className="flex items-center gap-4 rounded-lg bg-muted/50 px-4 py-2 text-sm">
          <span className="font-medium">{items.length + addedOrders.length} pedido{(items.length + addedOrders.length) !== 1 ? 's' : ''}</span>
          <span>Peso: <strong>{totalWeight.toLocaleString('pt-BR')} kg</strong></span>
          <span>Pallets: <strong>{formatPallets(totalPallets)}</strong></span>
          <span>Valor: <strong>{formatCurrency(totalValue)}</strong></span>
        </div>

        {/* Actions */}
        <div className="flex justify-between border-t border-border pt-4">
          {shipment.status === 'programada' ? (
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1.5 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Ban size={14} />
              {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar Carga'}
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
          <button
            onClick={handleClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Fechar
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !vehicleId || !deliveryDate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
