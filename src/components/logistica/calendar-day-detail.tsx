import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn, formatCurrency } from '@/lib/utils'
import { SHIPMENT_STATUS_CONFIG, VEHICLE_TYPE_CONFIG, type ShipmentStatus, type VehicleType } from '@/lib/logistics-constants'
import type { ShipmentWithRelations } from './tab-programacao'

interface CalendarDayDetailProps {
  date: Date
  shipments: ShipmentWithRelations[]
  onSelectShipment: (shipment: ShipmentWithRelations) => void
  onNewShipment: () => void
}

function getAllUFs(items: ShipmentWithRelations['items']): string[] {
  if (!items || items.length === 0) return []
  const ufs = new Set<string>()
  for (const item of items) {
    if (item.uf) ufs.add(item.uf)
  }
  return [...ufs].sort()
}

function formatPallets(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function CalendarDayDetail({
  date,
  shipments,
  onSelectShipment,
  onNewShipment,
}: CalendarDayDetailProps) {
  // Day totals
  const dayTotalWeight = shipments.reduce((s, sh) => s + (sh.total_weight_kg ?? 0), 0)
  const dayTotalPallets = shipments.reduce((s, sh) => s + (sh.total_pallets ?? 0), 0)
  const dayTotalValue = shipments.reduce((s, sh) => s + (sh.total_value ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </h3>
          {shipments.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {shipments.length} carga{shipments.length !== 1 ? 's' : ''} | {(dayTotalWeight / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}t | {formatPallets(dayTotalPallets)} plt | {formatCurrency(dayTotalValue)}
            </p>
          )}
        </div>
        <button
          onClick={onNewShipment}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90"
        >
          <Plus size={14} />
          Nova Carga
        </button>
      </div>

      {shipments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10">
          <p className="text-sm text-muted-foreground">
            Nenhuma carga programada para este dia
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shipments.map((shipment) => {
            const statusCfg = SHIPMENT_STATUS_CONFIG[shipment.status as ShipmentStatus] ?? SHIPMENT_STATUS_CONFIG.programada
            const vehicleType = shipment.vehicle?.vehicle_type as VehicleType | undefined
            const vehicleLabel = vehicleType && VEHICLE_TYPE_CONFIG[vehicleType]
              ? VEHICLE_TYPE_CONFIG[vehicleType].label
              : shipment.vehicle?.vehicle_type ?? ''
            const plate = shipment.vehicle?.plate ?? ''

            // Occupancy
            const totalWeight = shipment.total_weight_kg ?? 0
            const maxWeight = shipment.vehicle?.max_weight_kg ?? 0
            const occupancy = maxWeight > 0 ? Math.min((totalWeight / maxWeight) * 100, 100) : 0

            // All destination UFs
            const destUFs = getAllUFs(shipment.items)

            const orderCount = shipment.items?.length ?? 0
            const totalPallets = shipment.total_pallets ?? 0

            return (
              <button
                key={shipment.id}
                onClick={() => onSelectShipment(shipment)}
                className={cn(
                  'w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/50',
                  'border-l-4'
                )}
                style={{
                  borderLeftColor: statusCfg.color.replace('text-', '').includes('blue')
                    ? '#1d4ed8'
                    : statusCfg.color.includes('amber') ? '#b45309'
                    : statusCfg.color.includes('green') ? '#15803d'
                    : statusCfg.color.includes('orange') ? '#c2410c'
                    : statusCfg.color.includes('cyan') ? '#0e7490'
                    : statusCfg.color.includes('emerald') ? '#047857'
                    : '#374151'
                }}
              >
                {/* Line 1: Reference + Status */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-sm font-semibold">{shipment.reference}</span>
                    <span className={cn('ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', statusCfg.bgColor, statusCfg.color)}>
                      {statusCfg.label}
                    </span>
                  </div>
                </div>

                {/* Line 2: Vehicle type (plate) + Driver */}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                  {shipment.vehicle && (
                    <span className="font-medium text-foreground">
                      {vehicleLabel} ({plate})
                    </span>
                  )}
                  {shipment.driver && (
                    <span>{shipment.driver.name}</span>
                  )}
                </div>

                {/* Line 3: Occupancy bar + Weight/Pallets + Destinos + Order count */}
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {/* Occupancy */}
                  {maxWeight > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-1.5 rounded-full',
                            occupancy > 95 ? 'bg-red-500' : occupancy > 80 ? 'bg-amber-500' : 'bg-green-500'
                          )}
                          style={{ width: `${occupancy}%` }}
                        />
                      </div>
                      <span>{occupancy.toFixed(0)}%</span>
                    </div>
                  )}

                  {/* Weight + pallets */}
                  <span>
                    {(totalWeight / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}t | {formatPallets(totalPallets)} plt
                  </span>

                  {/* Destination UFs (all) */}
                  {destUFs.length > 0 && (
                    <div className="flex gap-0.5">
                      {destUFs.map((uf) => (
                        <span key={uf} className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-700">
                          {uf}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Order count */}
                  <span>{orderCount} pedido{orderCount !== 1 ? 's' : ''}</span>

                  {/* Value */}
                  <span className="ml-auto">{formatCurrency(shipment.total_value ?? 0)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
