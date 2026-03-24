import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ScrollText,
  Activity,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Shield,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/utils'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { DataTable } from '@/components/shared/data-table'
import { Dialog } from '@/components/shared/dialog'
import { LogKpis } from '@/components/logs/log-kpis'
import { SyncDetailDialog } from '@/components/logs/sync-detail-dialog'
import { ErrorDetailDialog } from '@/components/logs/error-detail-dialog'
import type { Database } from '@/types/database'

type AuditLog = Database['public']['Tables']['audit_logs']['Row']
type FrontendErrorLog = Database['public']['Tables']['frontend_error_logs']['Row']
type EdgeFunctionLog = Database['public']['Tables']['edge_function_logs']['Row']
type SecurityLog = Database['public']['Tables']['security_logs']['Row']
type SapSyncLog = Database['public']['Tables']['sap_sync_log']['Row']

type LogTab = 'atividades' | 'erros' | 'sync' | 'edge' | 'seguranca'

const TABS: { id: LogTab; label: string; icon: typeof Activity }[] = [
  { id: 'atividades', label: 'Atividades', icon: Activity },
  { id: 'erros', label: 'Erros Frontend', icon: AlertTriangle },
  { id: 'sync', label: 'Sync SAP', icon: RefreshCw },
  { id: 'edge', label: 'Edge Functions', icon: Cpu },
  { id: 'seguranca', label: 'Segurança', icon: Shield },
]

function formatDate(iso: string) {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
}

function formatDateShort(iso: string) {
  return format(new Date(iso), 'dd/MM HH:mm', { locale: ptBR })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: 'bg-emerald-100 text-emerald-700',
    error: 'bg-red-100 text-red-700',
    partial: 'bg-amber-100 text-amber-700',
    running: 'bg-blue-100 text-blue-700',
    login_success: 'bg-emerald-100 text-emerald-700',
    login_failure: 'bg-red-100 text-red-700',
    logout: 'bg-gray-100 text-gray-700',
    access_denied: 'bg-red-100 text-red-700',
    session_expired: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', colors[status] ?? 'bg-gray-100 text-gray-700')}>
      {status}
    </span>
  )
}

// === Column definitions ===

function auditColumns() {
  return [
    { accessorKey: 'created_at', header: 'Data', cell: (info: { getValue: () => string }) => formatDateShort(info.getValue()) },
    { accessorKey: 'user_email', header: 'Usuário', cell: (info: { getValue: () => string | null }) => info.getValue()?.split('@')[0] ?? '—' },
    { accessorKey: 'action', header: 'Ação', cell: (info: { getValue: () => string }) => <StatusBadge status={info.getValue()} /> },
    { accessorKey: 'resource', header: 'Recurso', cell: (info: { getValue: () => string | null }) => info.getValue() ?? '—' },
    { accessorKey: 'resource_id', header: 'ID', cell: (info: { getValue: () => string | null }) => info.getValue() ? String(info.getValue()).slice(0, 8) : '—' },
  ]
}

function errorColumns() {
  return [
    { accessorKey: 'created_at', header: 'Data', cell: (info: { getValue: () => string }) => formatDateShort(info.getValue()) },
    { accessorKey: 'error_type', header: 'Tipo', cell: (info: { getValue: () => string }) => <StatusBadge status={info.getValue()} /> },
    { accessorKey: 'message', header: 'Mensagem', cell: (info: { getValue: () => string }) => <span className="max-w-xs truncate block">{info.getValue()}</span> },
    { accessorKey: 'url', header: 'URL', cell: (info: { getValue: () => string | null }) => info.getValue()?.replace(/^https?:\/\/[^/]+/, '') ?? '—' },
  ]
}

function syncColumns() {
  return [
    { accessorKey: 'started_at', header: 'Início', cell: (info: { getValue: () => string }) => formatDateShort(info.getValue()) },
    { accessorKey: 'status', header: 'Status', cell: (info: { getValue: () => string }) => <StatusBadge status={info.getValue()} /> },
    { accessorKey: 'synced_count', header: 'Registros', cell: (info: { getValue: () => number }) => formatNumber(info.getValue()) },
    { accessorKey: 'error_count', header: 'Erros', cell: (info: { getValue: () => number }) => info.getValue() > 0 ? <span className="text-red-600 font-medium">{info.getValue()}</span> : '0' },
    { accessorKey: 'duration_ms', header: 'Duração', cell: (info: { getValue: () => number | null }) => info.getValue() ? `${(info.getValue()! / 1000).toFixed(1)}s` : '—' },
    { accessorKey: 'triggered_by', header: 'Origem' },
  ]
}

function edgeColumns() {
  return [
    { accessorKey: 'created_at', header: 'Data', cell: (info: { getValue: () => string }) => formatDateShort(info.getValue()) },
    { accessorKey: 'function_name', header: 'Função' },
    { accessorKey: 'status', header: 'Status', cell: (info: { getValue: () => string }) => <StatusBadge status={info.getValue()} /> },
    { accessorKey: 'response_status', header: 'HTTP', cell: (info: { getValue: () => number | null }) => info.getValue() ?? '—' },
    { accessorKey: 'duration_ms', header: 'Duração', cell: (info: { getValue: () => number | null }) => info.getValue() ? `${info.getValue()}ms` : '—' },
    { accessorKey: 'request_method', header: 'Método' },
  ]
}

function securityColumns() {
  return [
    { accessorKey: 'created_at', header: 'Data', cell: (info: { getValue: () => string }) => formatDateShort(info.getValue()) },
    { accessorKey: 'user_email', header: 'Usuário', cell: (info: { getValue: () => string | null }) => info.getValue()?.split('@')[0] ?? '—' },
    { accessorKey: 'event_type', header: 'Evento', cell: (info: { getValue: () => string }) => <StatusBadge status={info.getValue()} /> },
    { accessorKey: 'metadata', header: 'Detalhes', cell: (info: { getValue: () => Record<string, unknown> }) => {
      const meta = info.getValue()
      if (meta?.path) return meta.path as string
      if (meta?.reason) return <span className="text-red-600 text-xs">{String(meta.reason).slice(0, 50)}</span>
      return '—'
    }},
  ]
}

export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') ?? 'atividades'
  const activeTab: LogTab = TABS.some((t) => t.id === rawTab) ? (rawTab as LogTab) : 'atividades'

  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null)
  const [selectedError, setSelectedError] = useState<FrontendErrorLog | null>(null)
  const [selectedSync, setSelectedSync] = useState<SapSyncLog | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<EdgeFunctionLog | null>(null)
  const [selectedSecurity, setSelectedSecurity] = useState<SecurityLog | null>(null)

  // Fetch all log tables
  const { data: auditLogs, isLoading: loadingAudit } = useCacheQuery<AuditLog[]>('audit_logs', { order: 'created_at', ascending: false, limit: 1000 })
  const { data: errorLogs, isLoading: loadingErrors } = useCacheQuery<FrontendErrorLog[]>('frontend_error_logs', { order: 'created_at', ascending: false, limit: 500 })
  const { data: syncLogs, isLoading: loadingSync } = useCacheQuery<SapSyncLog[]>('sap_sync_log', { order: 'started_at', ascending: false, limit: 500 })
  const { data: edgeLogs, isLoading: loadingEdge } = useCacheQuery<EdgeFunctionLog[]>('edge_function_logs', { order: 'created_at', ascending: false, limit: 1000 })
  const { data: securityLogs, isLoading: loadingSecurity } = useCacheQuery<SecurityLog[]>('security_logs', { order: 'created_at', ascending: false, limit: 1000 })

  // Memoized columns
  const auditCols = useMemo(() => auditColumns(), [])
  const errorCols = useMemo(() => errorColumns(), [])
  const syncCols = useMemo(() => syncColumns(), [])
  const edgeCols = useMemo(() => edgeColumns(), [])
  const securityCols = useMemo(() => securityColumns(), [])

  function setActiveTab(tab: LogTab) {
    setSearchParams({ tab }, { replace: true })
  }

  const isLoading = activeTab === 'atividades' ? loadingAudit
    : activeTab === 'erros' ? loadingErrors
    : activeTab === 'sync' ? loadingSync
    : activeTab === 'edge' ? loadingEdge
    : loadingSecurity

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScrollText size={28} className="text-primary" />
        <h1 className="text-2xl font-bold">Logs do Sistema</h1>
      </div>

      {/* KPIs */}
      <LogKpis
        auditCount={auditLogs?.length ?? 0}
        errorCount={errorLogs?.length ?? 0}
        syncCount={syncLogs?.length ?? 0}
        edgeCount={edgeLogs?.length ?? 0}
        securityCount={securityLogs?.length ?? 0}
        syncErrors={syncLogs?.filter((s) => s.status === 'error').length ?? 0}
        edgeErrors={edgeLogs?.filter((e) => e.status === 'error').length ?? 0}
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === t.id
                  ? 'border-b-2 border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {activeTab === 'atividades' && (
            <DataTable data={auditLogs ?? []} columns={auditCols} searchPlaceholder="Buscar atividade..." onRowClick={setSelectedAudit} />
          )}
          {activeTab === 'erros' && (
            <DataTable data={errorLogs ?? []} columns={errorCols} searchPlaceholder="Buscar erro..." onRowClick={setSelectedError} />
          )}
          {activeTab === 'sync' && (
            <DataTable data={syncLogs ?? []} columns={syncCols} searchPlaceholder="Buscar sync..." onRowClick={setSelectedSync} />
          )}
          {activeTab === 'edge' && (
            <DataTable data={edgeLogs ?? []} columns={edgeCols} searchPlaceholder="Buscar função..." onRowClick={setSelectedEdge} />
          )}
          {activeTab === 'seguranca' && (
            <DataTable data={securityLogs ?? []} columns={securityCols} searchPlaceholder="Buscar evento..." onRowClick={setSelectedSecurity} />
          )}
        </>
      )}

      {/* Detail Dialogs */}
      <Dialog open={!!selectedAudit} onClose={() => setSelectedAudit(null)} title="Detalhe da Atividade">
        {selectedAudit && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Data:</span> {formatDate(selectedAudit.created_at)}</div>
              <div><span className="text-muted-foreground">Ação:</span> <StatusBadge status={selectedAudit.action} /></div>
              <div><span className="text-muted-foreground">Usuário:</span> {selectedAudit.user_email ?? '—'}</div>
              <div><span className="text-muted-foreground">Recurso:</span> {selectedAudit.resource ?? '—'}</div>
              <div className="col-span-2"><span className="text-muted-foreground">ID Recurso:</span> {selectedAudit.resource_id ?? '—'}</div>
            </div>
            {Object.keys(selectedAudit.metadata ?? {}).length > 0 && (
              <div>
                <span className="text-muted-foreground">Metadata:</span>
                <pre className="mt-1 overflow-auto rounded bg-muted/50 p-2 text-xs">{JSON.stringify(selectedAudit.metadata, null, 2)}</pre>
              </div>
            )}
            {selectedAudit.user_agent && (
              <div><span className="text-muted-foreground">User Agent:</span> <span className="text-xs break-all">{selectedAudit.user_agent}</span></div>
            )}
          </div>
        )}
      </Dialog>

      <ErrorDetailDialog error={selectedError} onClose={() => setSelectedError(null)} />
      <SyncDetailDialog sync={selectedSync} onClose={() => setSelectedSync(null)} />

      <Dialog open={!!selectedEdge} onClose={() => setSelectedEdge(null)} title={`Edge Function: ${selectedEdge?.function_name ?? ''}`}>
        {selectedEdge && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Data:</span> {formatDate(selectedEdge.created_at)}</div>
              <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={selectedEdge.status} /></div>
              <div><span className="text-muted-foreground">HTTP:</span> {selectedEdge.response_status ?? '—'}</div>
              <div><span className="text-muted-foreground">Duração:</span> {selectedEdge.duration_ms ? `${selectedEdge.duration_ms}ms` : '—'}</div>
              <div><span className="text-muted-foreground">Método:</span> {selectedEdge.request_method ?? '—'}</div>
              <div><span className="text-muted-foreground">Path:</span> {selectedEdge.request_path ?? '—'}</div>
            </div>
            {selectedEdge.error_message && (
              <div>
                <span className="text-muted-foreground">Erro:</span>
                <pre className="mt-1 overflow-auto rounded bg-red-50 p-2 text-xs text-red-700">{selectedEdge.error_message}</pre>
              </div>
            )}
            {selectedEdge.error_stack && (
              <div>
                <span className="text-muted-foreground">Stack:</span>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">{selectedEdge.error_stack}</pre>
              </div>
            )}
            {selectedEdge.request_body_summary && Object.keys(selectedEdge.request_body_summary).length > 0 && (
              <div>
                <span className="text-muted-foreground">Request Body:</span>
                <pre className="mt-1 overflow-auto rounded bg-muted/50 p-2 text-xs">{JSON.stringify(selectedEdge.request_body_summary, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={!!selectedSecurity} onClose={() => setSelectedSecurity(null)} title="Evento de Segurança">
        {selectedSecurity && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Data:</span> {formatDate(selectedSecurity.created_at)}</div>
              <div><span className="text-muted-foreground">Evento:</span> <StatusBadge status={selectedSecurity.event_type} /></div>
              <div><span className="text-muted-foreground">Usuário:</span> {selectedSecurity.user_email ?? '—'}</div>
              <div><span className="text-muted-foreground">User ID:</span> {selectedSecurity.user_id?.slice(0, 8) ?? '—'}</div>
            </div>
            {Object.keys(selectedSecurity.metadata ?? {}).length > 0 && (
              <div>
                <span className="text-muted-foreground">Metadata:</span>
                <pre className="mt-1 overflow-auto rounded bg-muted/50 p-2 text-xs">{JSON.stringify(selectedSecurity.metadata, null, 2)}</pre>
              </div>
            )}
            {selectedSecurity.user_agent && (
              <div><span className="text-muted-foreground">User Agent:</span> <span className="text-xs break-all">{selectedSecurity.user_agent}</span></div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
