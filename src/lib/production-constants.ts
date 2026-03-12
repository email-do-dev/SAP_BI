import { BarChart3, ClipboardList, CalendarRange } from 'lucide-react'

// === Production Tabs ===
export type ProductionTab = 'dashboard' | 'ordens' | 'pcp'

export const PRODUCTION_TABS: { id: ProductionTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'ordens', label: 'Ordens de Produção', icon: ClipboardList },
  { id: 'pcp', label: 'PCP', icon: CalendarRange },
]

// === Line Types ===
export type LineType = 'conserva' | 'congelado' | 'salgado' | 'farinha'

export const LINE_TYPE_CONFIG: Record<LineType, { label: string; color: string; bgColor: string }> = {
  conserva:  { label: 'Conserva',  color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  congelado: { label: 'Congelado', color: 'text-cyan-700',   bgColor: 'bg-cyan-100' },
  salgado:   { label: 'Salgado',   color: 'text-amber-700',  bgColor: 'bg-amber-100' },
  farinha:   { label: 'Farinha',   color: 'text-orange-700', bgColor: 'bg-orange-100' },
}

export const LINE_TYPES = Object.keys(LINE_TYPE_CONFIG) as LineType[]

// === Stop Categories ===
export type StopCategory = 'mecanica' | 'eletrica' | 'falta_mp' | 'setup' | 'limpeza' | 'qualidade' | 'outros'

export const STOP_CATEGORY_LABELS: Record<StopCategory, string> = {
  mecanica:  'Mecânica',
  eletrica:  'Elétrica',
  falta_mp:  'Falta de MP',
  setup:     'Setup',
  limpeza:   'Limpeza',
  qualidade: 'Qualidade',
  outros:    'Outros',
}

export const STOP_CATEGORIES = Object.keys(STOP_CATEGORY_LABELS) as StopCategory[]

// === Team Roles ===
export type TeamRole = 'lider' | 'operador' | 'auxiliar'

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  lider:    'Líder',
  operador: 'Operador',
  auxiliar: 'Auxiliar',
}

// === PCP Plan Status ===
export type PcpPlanStatus = 'planejado' | 'em_andamento' | 'concluido' | 'cancelado'

export const PCP_STATUS_CONFIG: Record<PcpPlanStatus, { label: string; color: string; bgColor: string }> = {
  planejado:    { label: 'Planejado',     color: 'text-blue-700',    bgColor: 'bg-blue-100' },
  em_andamento: { label: 'Em Andamento',  color: 'text-amber-700',   bgColor: 'bg-amber-100' },
  concluido:    { label: 'Concluído',     color: 'text-green-700',   bgColor: 'bg-green-100' },
  cancelado:    { label: 'Cancelado',     color: 'text-red-700',     bgColor: 'bg-red-100' },
}

// === OP Status Config ===
export type OpStatus = 'Planejada' | 'Liberada' | 'Encerrada'

export const OP_STATUS_CONFIG: Record<OpStatus, { color: string; bgColor: string }> = {
  Planejada:  { color: 'text-blue-700',    bgColor: 'bg-blue-100' },
  Liberada:   { color: 'text-amber-700',   bgColor: 'bg-amber-100' },
  Encerrada:  { color: 'text-green-700',   bgColor: 'bg-green-100' },
}
