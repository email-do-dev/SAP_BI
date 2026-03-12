import { cn } from '@/lib/utils'

const variants: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
  delivered: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  partial: 'bg-orange-100 text-orange-800',
  // Unified comercial statuses
  pedido: 'bg-blue-100 text-blue-800',
  faturado: 'bg-purple-100 text-purple-800',
  entregue: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
  estorno: 'bg-orange-100 text-orange-800',
  // Tipo badges
  venda: 'bg-emerald-100 text-emerald-800',
  bonificacao: 'bg-amber-100 text-amber-800',
  // Import process statuses
  cotacao: 'bg-slate-100 text-slate-800',
  pedido_compra: 'bg-blue-100 text-blue-800',
  proforma: 'bg-blue-100 text-blue-800',
  li_aprovacao: 'bg-purple-100 text-purple-800',
  producao_origem: 'bg-amber-100 text-amber-800',
  embarque: 'bg-cyan-100 text-cyan-800',
  transito: 'bg-cyan-100 text-cyan-800',
  chegada_porto: 'bg-teal-100 text-teal-800',
  desembaraco: 'bg-orange-100 text-orange-800',
  di_registrada: 'bg-orange-100 text-orange-800',
  nacionalizacao: 'bg-rose-100 text-rose-800',
  liberacao: 'bg-green-100 text-green-800',
  transporte_interno: 'bg-green-100 text-green-800',
  recebimento: 'bg-emerald-100 text-emerald-800',
  encerrado: 'bg-gray-100 text-gray-800',
}

const labels: Record<string, string> = {
  O: 'Aberto',
  C: 'Fechado',
  open: 'Aberto',
  closed: 'Fechado',
  delivered: 'Entregue',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  partial: 'Parcial',
  // Unified comercial
  pedido: 'Pedido',
  faturado: 'Faturado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  estorno: 'Estorno',
  // Tipo
  venda: 'Venda',
  bonificacao: 'Bonificação',
  // Import process statuses
  cotacao: 'Cotação',
  pedido_compra: 'Pedido de Compra',
  proforma: 'Proforma',
  li_aprovacao: 'LI / Aprovação',
  producao_origem: 'Produção Origem',
  embarque: 'Embarque',
  transito: 'Em Trânsito',
  chegada_porto: 'Chegada Porto',
  desembaraco: 'Desembaraço',
  di_registrada: 'DI Registrada',
  nacionalizacao: 'Nacionalização',
  liberacao: 'Liberação',
  transporte_interno: 'Transporte Interno',
  recebimento: 'Recebimento',
  encerrado: 'Encerrado',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase()
  const mapped = normalized === 'o' ? 'open' : normalized === 'c' ? 'closed' : normalized
  const variant = variants[mapped] ?? 'bg-gray-100 text-gray-800'
  const label = labels[status] ?? labels[mapped] ?? status

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', variant, className)}>
      {label}
    </span>
  )
}
