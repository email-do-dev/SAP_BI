import {
  FileSearch,
  ShoppingCart,
  FileText,
  Shield,
  Factory,
  Ship,
  Navigation,
  Anchor,
  ClipboardCheck,
  FileCheck,
  Flag,
  Unlock,
  Truck,
  PackageCheck,
  Lock,
} from 'lucide-react'

// === Status ===

export type ImportProcessStatus =
  | 'cotacao'
  | 'pedido_compra'
  | 'proforma'
  | 'li_aprovacao'
  | 'producao_origem'
  | 'embarque'
  | 'transito'
  | 'chegada_porto'
  | 'desembaraco'
  | 'di_registrada'
  | 'nacionalizacao'
  | 'liberacao'
  | 'transporte_interno'
  | 'recebimento'
  | 'encerrado'

export const IMPORT_STATUSES: {
  value: ImportProcessStatus
  label: string
  color: string
  bgColor: string
  icon: typeof FileSearch
  phase: 'preparacao' | 'transporte' | 'porto' | 'finalizacao'
}[] = [
  { value: 'cotacao', label: 'Cotacao', color: 'text-slate-700', bgColor: 'bg-slate-100', icon: FileSearch, phase: 'preparacao' },
  { value: 'pedido_compra', label: 'Pedido de Compra', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: ShoppingCart, phase: 'preparacao' },
  { value: 'proforma', label: 'Proforma Invoice', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: FileText, phase: 'preparacao' },
  { value: 'li_aprovacao', label: 'LI / Aprovacao', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Shield, phase: 'preparacao' },
  { value: 'producao_origem', label: 'Producao na Origem', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Factory, phase: 'preparacao' },
  { value: 'embarque', label: 'Embarque', color: 'text-cyan-700', bgColor: 'bg-cyan-100', icon: Ship, phase: 'transporte' },
  { value: 'transito', label: 'Em Transito', color: 'text-cyan-700', bgColor: 'bg-cyan-100', icon: Navigation, phase: 'transporte' },
  { value: 'chegada_porto', label: 'Chegada ao Porto', color: 'text-teal-700', bgColor: 'bg-teal-100', icon: Anchor, phase: 'porto' },
  { value: 'desembaraco', label: 'Desembaraco', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: ClipboardCheck, phase: 'porto' },
  { value: 'di_registrada', label: 'DI Registrada', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: FileCheck, phase: 'porto' },
  { value: 'nacionalizacao', label: 'Nacionalizacao', color: 'text-rose-700', bgColor: 'bg-rose-100', icon: Flag, phase: 'porto' },
  { value: 'liberacao', label: 'Liberacao', color: 'text-green-700', bgColor: 'bg-green-100', icon: Unlock, phase: 'finalizacao' },
  { value: 'transporte_interno', label: 'Transporte Interno', color: 'text-green-700', bgColor: 'bg-green-100', icon: Truck, phase: 'finalizacao' },
  { value: 'recebimento', label: 'Recebimento', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: PackageCheck, phase: 'finalizacao' },
  { value: 'encerrado', label: 'Encerrado', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: Lock, phase: 'finalizacao' },
]

export const STATUS_INDEX = Object.fromEntries(
  IMPORT_STATUSES.map((s, i) => [s.value, i])
) as Record<ImportProcessStatus, number>

export function getStatusDef(status: ImportProcessStatus) {
  return IMPORT_STATUSES[STATUS_INDEX[status]]
}

export function getNextStatus(status: ImportProcessStatus): ImportProcessStatus | null {
  const idx = STATUS_INDEX[status]
  if (idx >= IMPORT_STATUSES.length - 1) return null
  return IMPORT_STATUSES[idx + 1].value
}

// === Phase grouping for pipeline ===

export const PHASE_LABELS: Record<string, string> = {
  preparacao: 'Preparacao',
  transporte: 'Transporte',
  porto: 'Porto',
  finalizacao: 'Finalizacao',
}

// === Cost types ===

export type ImportCostType =
  | 'frete_internacional'
  | 'seguro'
  | 'ii'
  | 'ipi'
  | 'pis'
  | 'cofins'
  | 'icms'
  | 'taxa_siscomex'
  | 'armazenagem'
  | 'capatazia'
  | 'frete_interno'
  | 'despachante'
  | 'demurrage'
  | 'outros'

export const COST_TYPE_LABELS: Record<ImportCostType, string> = {
  frete_internacional: 'Frete Internacional',
  seguro: 'Seguro',
  ii: 'II (Imposto de Importacao)',
  ipi: 'IPI',
  pis: 'PIS',
  cofins: 'COFINS',
  icms: 'ICMS',
  taxa_siscomex: 'Taxa Siscomex',
  armazenagem: 'Armazenagem',
  capatazia: 'Capatazia',
  frete_interno: 'Frete Interno',
  despachante: 'Despachante',
  demurrage: 'Demurrage',
  outros: 'Outros',
}

export const COST_TYPES = Object.keys(COST_TYPE_LABELS) as ImportCostType[]

// === Document types ===

export type ImportDocType =
  | 'invoice'
  | 'packing_list'
  | 'bl'
  | 'cert_origin'
  | 'li'
  | 'duimp'
  | 'nf_importacao'
  | 'comprovante'

export const DOC_TYPE_LABELS: Record<ImportDocType, string> = {
  invoice: 'Invoice',
  packing_list: 'Packing List',
  bl: 'Bill of Lading',
  cert_origin: 'Certificado de Origem',
  li: 'Licenca de Importacao',
  duimp: 'DUIMP',
  nf_importacao: 'NF de Importacao',
  comprovante: 'Comprovante',
}

export const DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as ImportDocType[]

// === Incoterms ===

export const INCOTERMS = ['FOB', 'CIF', 'CFR', 'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const

// === Currencies ===

export const CURRENCIES = ['USD', 'EUR', 'BRL'] as const

// === Free time helper ===

export function getFreeTimeRemaining(arrivalDate: string | null, freeTimeDays: number): number | null {
  if (!arrivalDate) return null
  const arrival = new Date(arrivalDate)
  const freeTimeEnd = new Date(arrival)
  freeTimeEnd.setDate(freeTimeEnd.getDate() + freeTimeDays)
  const today = new Date()
  const diffTime = freeTimeEnd.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
