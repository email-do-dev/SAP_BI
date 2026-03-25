import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import { Ship, Container, Clock, Plus, LayoutGrid, Table2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/shared/data-table'
import { KpiSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { FreeTimeBadge } from '@/components/importacao/free-time-badge'
import { getFreeTimeRemaining } from '@/lib/import-constants'
import { PipelineView } from '@/components/importacao/pipeline-view'
import { useImportProcesses, type ImportProcess } from '@/hooks/use-import-queries'
import { useAuth } from '@/contexts/auth-context'
import { usePageView } from '@/hooks/use-activity-log'
import { cn } from '@/lib/utils'

const col = createColumnHelper<ImportProcess>()

const columns = [
  col.accessor('reference', { header: 'Referência', cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  col.accessor('supplier', { header: 'Fornecedor' }),
  col.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  col.accessor('container_number', {
    header: 'Container',
    cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
  }),
  col.accessor('currency', {
    header: 'Total FOB',
    cell: (info) => {
      const row = info.row.original
      return `${row.currency} ${Number(row.total_fob).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    },
  }),
  col.accessor('arrival_date', {
    header: 'Free Time',
    cell: (info) => {
      const row = info.row.original
      return <FreeTimeBadge arrivalDate={row.arrival_date} freeTimeDays={row.free_time_days} />
    },
  }),
  col.accessor('created_at', {
    header: 'Criado em',
    cell: (info) => format(parseISO(info.getValue()), 'dd/MM/yyyy', { locale: ptBR }),
  }),
]

export default function ImportacaoListPage() {
  usePageView('importacao')
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const { data: processes = [], isLoading } = useImportProcesses()
  const [view, setView] = useState<'tabela' | 'pipeline'>('tabela')
  const canCreate = hasRole('diretoria') || hasRole('importacao')

  const kpis = useMemo(() => {
    const active = processes.filter((p) => p.status !== 'encerrado')
    const inTransit = processes.filter((p) => ['embarque', 'transito'].includes(p.status))
    const freeTimeExpiring = processes.filter((p) => {
      const rem = getFreeTimeRemaining(p.arrival_date, p.free_time_days)
      return rem !== null && rem <= 5
    })
    return { active: active.length, inTransit: inTransit.length, freeTimeExpiring: freeTimeExpiring.length }
  }, [processes])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Importações</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border">
            <button
              onClick={() => setView('tabela')}
              className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors', view === 'tabela' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent')}
            >
              <Table2 size={14} /> Tabela
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors', view === 'pipeline' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent')}
            >
              <LayoutGrid size={14} /> Pipeline
            </button>
          </div>
          {canCreate && (
            <button onClick={() => navigate('/importacao/novo')} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              <Plus size={16} /> Novo Processo
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard title="Processos Ativos" value={String(kpis.active)} icon={<Ship size={20} />} />
          <KpiCard title="Containers em Trânsito" value={String(kpis.inTransit)} icon={<Container size={20} />} />
          <KpiCard
            title="Free Time Expirando"
            value={String(kpis.freeTimeExpiring)}
            icon={<Clock size={20} />}
            className={kpis.freeTimeExpiring > 0 ? 'border-yellow-300 bg-yellow-50' : undefined}
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <TableSkeleton />
      ) : view === 'tabela' ? (
        <DataTable
          data={processes}
          columns={columns}
          searchPlaceholder="Buscar referência, fornecedor..."
          onRowClick={(row) => navigate(`/importacao/${row.id}`)}
        />
      ) : (
        <PipelineView processes={processes} />
      )}
    </div>
  )
}
