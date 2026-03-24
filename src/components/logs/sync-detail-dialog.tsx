import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Dialog } from '@/components/shared/dialog'
import type { Database } from '@/types/database'

type SapSyncLog = Database['public']['Tables']['sap_sync_log']['Row']

function formatDate(iso: string) {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
}

interface SyncDetailDialogProps {
  sync: SapSyncLog | null
  onClose: () => void
}

export function SyncDetailDialog({ sync, onClose }: SyncDetailDialogProps) {
  if (!sync) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>

  const details = sync.table_details ?? []
  const totalRows = details.reduce((sum, d) => sum + (d.upserted ?? 0), 0)

  return (
    <Dialog open={!!sync} onClose={onClose} title={`Sync — ${formatDate(sync.started_at)}`}>
      <div className="space-y-4 text-sm">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className={`font-medium ${sync.status === 'ok' ? 'text-emerald-600' : sync.status === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
              {sync.status.toUpperCase()}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Registros</span>
            <p className="font-medium">{totalRows.toLocaleString('pt-BR')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Duração</span>
            <p className="font-medium">{sync.duration_ms ? `${(sync.duration_ms / 1000).toFixed(1)}s` : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Erros</span>
            <p className={`font-medium ${sync.error_count > 0 ? 'text-red-600' : ''}`}>{sync.error_count}</p>
          </div>
        </div>

        {/* Table details */}
        {details.length > 0 && (
          <div>
            <h3 className="mb-2 font-medium text-muted-foreground">Detalhes por Tabela</h3>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tabela</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Upserted</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Deleted</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5 font-mono">{d.table}</td>
                      <td className="px-3 py-1.5 text-right">{(d.upserted ?? 0).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-1.5 text-right">{(d.deleted ?? 0).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-1.5 text-right">{d.duration_ms ? `${d.duration_ms}ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Errors */}
        {sync.errors && sync.errors.length > 0 && (
          <div>
            <h3 className="mb-2 font-medium text-red-600">Erros</h3>
            <div className="space-y-1">
              {sync.errors.map((err, i) => (
                <div key={i} className="rounded bg-red-50 px-3 py-2 text-xs">
                  <span className="font-medium">{err.step}:</span> {err.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div>Início: {formatDate(sync.started_at)}</div>
          <div>Fim: {sync.completed_at ? formatDate(sync.completed_at) : '—'}</div>
        </div>
      </div>
    </Dialog>
  )
}
