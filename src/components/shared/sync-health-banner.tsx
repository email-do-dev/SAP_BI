import { AlertTriangle, XCircle, Clock, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface SyncLog {
  status: 'ok' | 'partial' | 'error' | 'running'
  started_at: string
  error_count: number
  synced_count: number
  errors: Array<{ step: string; message: string }>
}

interface SyncHealthBannerProps {
  syncLog: SyncLog | undefined
}

export function SyncHealthBanner({ syncLog }: SyncHealthBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  const minutesAgo = useMemo(() => {
    if (!syncLog) return 0
    return (Date.now() - new Date(syncLog.started_at).getTime()) / 60000
  }, [syncLog])

  if (!syncLog || dismissed) return null
  const isStale = minutesAgo > 25

  // No alert needed if last sync was OK and recent
  if (syncLog.status === 'ok' && !isStale) return null
  if (syncLog.status === 'running' && minutesAgo < 5) return null

  let variant: 'error' | 'warning' = 'warning'
  let icon = <AlertTriangle size={16} />
  let message = ''

  if (syncLog.status === 'error') {
    variant = 'error'
    icon = <XCircle size={16} />
    const errDetail = syncLog.errors?.[0]?.step === 'connection'
      ? 'Verifique as credenciais do servidor SAP.'
      : syncLog.errors?.[0]?.message || 'Verifique os logs do Edge Function.'
    message = `Sincronização SAP falhou. ${errDetail}`
  } else if (syncLog.status === 'partial' && syncLog.error_count > syncLog.synced_count) {
    variant = 'error'
    icon = <XCircle size={16} />
    message = `Sincronização com muitas falhas: ${syncLog.error_count} erro(s) de ${syncLog.synced_count + syncLog.error_count} etapas.`
  } else if (syncLog.status === 'partial') {
    message = `Sincronização parcial: ${syncLog.synced_count} OK, ${syncLog.error_count} erro(s).`
  } else if (isStale) {
    icon = <Clock size={16} />
    message = `Sincronização atrasada — última execução há ${Math.round(minutesAgo)} minutos.`
  } else if (syncLog.status === 'running' && minutesAgo >= 5) {
    icon = <Clock size={16} />
    message = `Sincronização em andamento há ${Math.round(minutesAgo)} minutos — pode estar travada.`
  }

  if (!message) return null

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
      variant === 'error' && 'border-red-200 bg-red-50 text-red-800',
      variant === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800'
    )}>
      {icon}
      <span className="flex-1">{message}</span>
      <button
        onClick={() => setDismissed(true)}
        className={cn(
          'rounded p-0.5 transition-colors',
          variant === 'error' && 'hover:bg-red-100',
          variant === 'warning' && 'hover:bg-amber-100'
        )}
      >
        <X size={14} />
      </button>
    </div>
  )
}
