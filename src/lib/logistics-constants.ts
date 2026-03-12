import { Truck, Package, ClipboardCheck, MapPin, RotateCcw, Calculator } from 'lucide-react'

// === Shipment Status ===
export type ShipmentStatus = 'programada' | 'em_expedicao' | 'expedida' | 'em_transito' | 'entregue_parcial' | 'entregue' | 'finalizada' | 'cancelada'

export const SHIPMENT_STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string; bgColor: string }> = {
  programada:       { label: 'Programada',       color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  em_expedicao:     { label: 'Em Expedição',     color: 'text-amber-700',  bgColor: 'bg-amber-100' },
  expedida:         { label: 'Expedida',         color: 'text-green-700',  bgColor: 'bg-green-100' },
  em_transito:      { label: 'Em Trânsito',      color: 'text-orange-700', bgColor: 'bg-orange-100' },
  entregue_parcial: { label: 'Entregue Parcial', color: 'text-cyan-700',   bgColor: 'bg-cyan-100' },
  entregue:         { label: 'Entregue',         color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  finalizada:       { label: 'Finalizada',       color: 'text-gray-700',   bgColor: 'bg-gray-100' },
  cancelada:        { label: 'Cancelada',        color: 'text-red-700',    bgColor: 'bg-red-100' },
}

// === Return Request Status ===
export type ReturnRequestStatus = 'solicitada' | 'em_aprovacao' | 'aprovada' | 'nf_emitida' | 'retornada' | 'descartada' | 'fechada'

export const RETURN_STATUS_CONFIG: Record<ReturnRequestStatus, { label: string; color: string; bgColor: string }> = {
  solicitada:  { label: 'Solicitada',   color: 'text-blue-700',    bgColor: 'bg-blue-100' },
  em_aprovacao: { label: 'Em Aprovação', color: 'text-amber-700',   bgColor: 'bg-amber-100' },
  aprovada:    { label: 'Aprovada',     color: 'text-green-700',   bgColor: 'bg-green-100' },
  nf_emitida:  { label: 'NF Emitida',  color: 'text-purple-700',  bgColor: 'bg-purple-100' },
  retornada:   { label: 'Retornada',    color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  descartada:  { label: 'Descartada',   color: 'text-red-700',     bgColor: 'bg-red-100' },
  fechada:     { label: 'Fechada',      color: 'text-gray-700',    bgColor: 'bg-gray-100' },
}

// === Vehicle Types ===
export type VehicleType = 'carreta' | 'bitruck' | 'toco' | 'truck' | '3/4'

export const VEHICLE_TYPE_CONFIG: Record<VehicleType, { label: string; defaultWeight: number; defaultVolume: number; defaultPallets: number }> = {
  carreta:  { label: 'Carreta',  defaultWeight: 27000, defaultVolume: 85, defaultPallets: 28 },
  bitruck:  { label: 'Bitruck',  defaultWeight: 22000, defaultVolume: 65, defaultPallets: 20 },
  toco:     { label: 'Toco',     defaultWeight: 8000,  defaultVolume: 30, defaultPallets: 12 },
  truck:    { label: 'Truck',    defaultWeight: 14000, defaultVolume: 45, defaultPallets: 16 },
  '3/4':    { label: '3/4',      defaultWeight: 4000,  defaultVolume: 18, defaultPallets: 6 },
}

export const VEHICLE_TYPES = Object.keys(VEHICLE_TYPE_CONFIG) as VehicleType[]

// === Delivery Type ===
export type DeliveryType = 'direct' | 'operator'

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  direct: 'Entrega Direta',
  operator: 'Via Operador',
}

// === Delivery Status (per shipment item) ===
export type DeliveryItemStatus = 'pendente' | 'entregue' | 'devolvido_parcial' | 'devolvido_total'

export const DELIVERY_ITEM_STATUS_CONFIG: Record<DeliveryItemStatus, { label: string; color: string; bgColor: string }> = {
  pendente:          { label: 'Pendente',           color: 'text-amber-700',   bgColor: 'bg-amber-100' },
  entregue:          { label: 'Entregue',           color: 'text-green-700',   bgColor: 'bg-green-100' },
  devolvido_parcial: { label: 'Devolvido Parcial',  color: 'text-orange-700',  bgColor: 'bg-orange-100' },
  devolvido_total:   { label: 'Devolvido Total',    color: 'text-red-700',     bgColor: 'bg-red-100' },
}

// === Valid Status Transitions ===
export const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  programada:       ['em_expedicao', 'cancelada'],
  em_expedicao:     ['expedida', 'programada', 'cancelada'],
  expedida:         ['em_transito', 'em_expedicao'],
  em_transito:      ['entregue_parcial', 'entregue'],
  entregue_parcial: ['entregue'],
  entregue:         ['finalizada'],
  finalizada:       [],
  cancelada:        ['programada'],
}

// === License Types ===
export const LICENSE_TYPES = ['B', 'C', 'D', 'E'] as const

// === Logistics Tabs ===
export type LogisticsTab = 'programacao' | 'romaneio' | 'acompanhamento' | 'descarrego' | 'devolucoes' | 'custo'

export const LOGISTICS_TABS: { id: LogisticsTab; label: string; icon: typeof Truck }[] = [
  { id: 'programacao',     label: 'Programação',     icon: ClipboardCheck },
  { id: 'romaneio',        label: 'Romaneio',        icon: Package },
  { id: 'acompanhamento',  label: 'Acompanhamento',  icon: MapPin },
  { id: 'descarrego',      label: 'Descarrego',      icon: Truck },
  { id: 'devolucoes',      label: 'Devoluções',      icon: RotateCcw },
  { id: 'custo',           label: 'Custo Logístico',  icon: Calculator },
]

// === Physical Return Status ===
export type PhysicalReturnStatus = 'pendente' | 'em_transito' | 'recebido_fabrica' | 'descartado'

export const PHYSICAL_RETURN_LABELS: Record<PhysicalReturnStatus, string> = {
  pendente: 'Pendente',
  em_transito: 'Em Trânsito',
  recebido_fabrica: 'Recebido na Fábrica',
  descartado: 'Descartado',
}

// === Tracking Event Types ===
export type TrackingEventType = 'departure' | 'arrival_operator' | 'delivery' | 'delay' | 'incident' | 'note'

export const TRACKING_EVENT_LABELS: Record<TrackingEventType, string> = {
  departure: 'Saída',
  arrival_operator: 'Chegada ao Operador',
  delivery: 'Entrega',
  delay: 'Atraso',
  incident: 'Ocorrência',
  note: 'Observação',
}
