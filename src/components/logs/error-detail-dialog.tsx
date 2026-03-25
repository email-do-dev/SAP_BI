import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Dialog } from '@/components/shared/dialog'
import type { Database } from '@/types/database'

type FrontendErrorLog = Database['public']['Tables']['frontend_error_logs']['Row']

function formatDate(iso: string) {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
}

interface ErrorDetailDialogProps {
  error: FrontendErrorLog | null
  onClose: () => void
}

export function ErrorDetailDialog({ error, onClose }: ErrorDetailDialogProps) {
  if (!error) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>

  return (
    <Dialog open={!!error} onClose={onClose} title={`Erro: ${error.error_type}`}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-muted-foreground">Data:</span> {formatDate(error.created_at)}</div>
          <div><span className="text-muted-foreground">Tipo:</span> <span className="font-mono text-red-600">{error.error_type}</span></div>
          <div className="col-span-2"><span className="text-muted-foreground">URL:</span> {error.url ?? '—'}</div>
        </div>

        <div>
          <span className="text-muted-foreground">Mensagem:</span>
          <pre className="mt-1 overflow-auto rounded bg-red-50 p-2 text-xs text-red-700 whitespace-pre-wrap">{error.message}</pre>
        </div>

        {error.stack && (
          <div>
            <span className="text-muted-foreground">Stack Trace:</span>
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/50 p-2 text-xs whitespace-pre-wrap">{error.stack}</pre>
          </div>
        )}

        {error.component_stack && (
          <div>
            <span className="text-muted-foreground">Component Stack:</span>
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs whitespace-pre-wrap">{error.component_stack}</pre>
          </div>
        )}

        {Object.keys(error.metadata ?? {}).length > 0 && (
          <div>
            <span className="text-muted-foreground">Metadata:</span>
            <pre className="mt-1 overflow-auto rounded bg-muted/50 p-2 text-xs">{JSON.stringify(error.metadata, null, 2)}</pre>
          </div>
        )}
      </div>
    </Dialog>
  )
}
