import { AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorCardProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorCard({ message = 'Erro ao carregar dados', onRetry, className }: ErrorCardProps) {
  return (
    <div className={cn('rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center', className)}>
      <AlertCircle size={24} className="mx-auto mb-2 text-destructive" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground shadow-sm hover:bg-muted transition-colors"
        >
          <RefreshCw size={12} />
          Tentar novamente
        </button>
      )}
    </div>
  )
}
