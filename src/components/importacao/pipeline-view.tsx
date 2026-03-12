import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { IMPORT_STATUSES, PHASE_LABELS, type ImportProcessStatus } from '@/lib/import-constants'
import { StatusBadge } from '@/components/shared/status-badge'
import { FreeTimeBadge } from './free-time-badge'
import type { ImportProcess } from '@/hooks/use-import-queries'

interface PipelineViewProps {
  processes: ImportProcess[]
}

export function PipelineView({ processes }: PipelineViewProps) {
  const navigate = useNavigate()

  const phases = ['preparacao', 'transporte', 'porto', 'finalizacao'] as const
  const phaseStatuses: Record<string, ImportProcessStatus[]> = {}
  for (const s of IMPORT_STATUSES) {
    if (!phaseStatuses[s.phase]) phaseStatuses[s.phase] = []
    phaseStatuses[s.phase].push(s.value)
  }

  const phaseColors: Record<string, string> = {
    preparacao: 'border-blue-200 bg-blue-50/50',
    transporte: 'border-cyan-200 bg-cyan-50/50',
    porto: 'border-orange-200 bg-orange-50/50',
    finalizacao: 'border-green-200 bg-green-50/50',
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {phases.map((phase) => {
        const statuses = phaseStatuses[phase] ?? []
        const phaseProcesses = processes.filter((p) => statuses.includes(p.status))

        return (
          <div key={phase} className={cn('rounded-lg border-2 p-3', phaseColors[phase])}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{PHASE_LABELS[phase]}</h3>
              <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {phaseProcesses.length}
              </span>
            </div>
            <div className="space-y-2">
              {phaseProcesses.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">Nenhum processo</p>
              )}
              {phaseProcesses.map((proc) => (
                <div
                  key={proc.id}
                  onClick={() => navigate(`/importacao/${proc.id}`)}
                  className="cursor-pointer rounded-md border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{proc.reference}</span>
                    <StatusBadge status={proc.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{proc.supplier}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {proc.container_number && (
                      <span className="truncate text-[10px] text-muted-foreground">{proc.container_number}</span>
                    )}
                    {proc.arrival_date && (
                      <FreeTimeBadge arrivalDate={proc.arrival_date} freeTimeDays={proc.free_time_days} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
