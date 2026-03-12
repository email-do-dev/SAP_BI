import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight } from 'lucide-react'
import { useImportTimeline } from '@/hooks/use-import-queries'
import { getStatusDef } from '@/lib/import-constants'
import { StatusBadge } from '@/components/shared/status-badge'

interface TimelineTabProps {
  processId: string
}

export function TimelineTab({ processId }: TimelineTabProps) {
  const { data: entries = [], isLoading } = useImportTimeline(processId)

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>

  if (entries.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma alteração de status registrada.</div>
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const toDef = getStatusDef(entry.to_status)
        return (
          <div key={entry.id} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <toDef.icon size={14} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {entry.from_status && <StatusBadge status={entry.from_status} />}
                {entry.from_status && <ArrowRight size={12} className="text-muted-foreground" />}
                <StatusBadge status={entry.to_status} />
              </div>
              {entry.notes && (
                <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {format(parseISO(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
