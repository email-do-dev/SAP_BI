import { useState } from 'react'
import { Download, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshIndicator } from '@/components/shared/refresh-indicator'
import { DATE_PRESETS } from '@/hooks/use-dashboard-filters'
import type { ComparisonMode } from '@/hooks/use-dashboard-filters'
import { supabase } from '@/lib/supabase'

interface DashboardHeaderProps {
  refreshedAt?: string
  dateRange: { from: string; to: string }
  onDateRangeChange: (range: { from: string; to: string }) => void
  comparison: ComparisonMode
  onComparisonChange: (mode: ComparisonMode) => void
  onExport: () => void
}

export function DashboardHeader({ refreshedAt, dateRange, onDateRangeChange, comparison, onComparisonChange, onExport }: DashboardHeaderProps) {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null)

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sap-sync', {
        body: { triggered_by: 'manual' },
      })
      if (error) throw error
      return data as { status: string; synced?: string[]; errors?: string[] }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cache'] })
      const synced = data?.synced?.length ?? 0
      const errors = data?.errors?.length ?? 0
      if (data?.status === 'partial') {
        const errorList = data.errors?.slice(0, 3).join(', ') ?? ''
        setFeedback({ type: 'warning', message: `Parcial: ${synced} OK, ${errors} erro(s)${errorList ? ` — ${errorList}` : ''}` })
      } else {
        setFeedback({ type: 'success', message: `${synced ? `${synced} blocos` : 'Dados'} sincronizados!` })
      }
      setTimeout(() => setFeedback(null), 6000)
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: `Erro: ${err instanceof Error ? err.message : 'falha na sincronização'}` })
      setTimeout(() => setFeedback(null), 6000)
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <Download size={14} />
            CSV
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          {feedback && (
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              feedback.type === 'success' && 'text-green-600',
              feedback.type === 'warning' && 'text-amber-600',
              feedback.type === 'error' && 'text-red-600'
            )}>
              {feedback.type === 'success' ? <Check size={14} /> :
               feedback.type === 'warning' ? <AlertCircle size={14} /> :
               <AlertCircle size={14} />}
              {feedback.message}
            </span>
          )}
          <RefreshIndicator refreshedAt={refreshedAt} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-sm text-muted-foreground">até</span>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => onDateRangeChange(p.range())}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Comparar:</span>
          <select
            value={comparison}
            onChange={(e) => onComparisonChange(e.target.value as ComparisonMode)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="none">Sem comparação</option>
            <option value="prev_period">Período anterior</option>
            <option value="prev_year">Mesmo período ano passado</option>
          </select>
        </div>
      </div>
    </div>
  )
}
