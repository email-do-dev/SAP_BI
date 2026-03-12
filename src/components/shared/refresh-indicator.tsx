import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RefreshCw } from 'lucide-react'

interface RefreshIndicatorProps {
  refreshedAt: string | null | undefined
  className?: string
}

export function RefreshIndicator({ refreshedAt, className }: RefreshIndicatorProps) {
  if (!refreshedAt) return null

  const date = new Date(refreshedAt)
  const formatted = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  return (
    <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ''}`}>
      <RefreshCw size={12} />
      <span>Atualizado em {formatted}</span>
    </div>
  )
}
