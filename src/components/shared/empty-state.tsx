import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  message?: string
  className?: string
}

export function EmptyState({ message = 'Sem dados para o período selecionado', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-10 text-muted-foreground', className)}>
      <Inbox size={32} className="mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
