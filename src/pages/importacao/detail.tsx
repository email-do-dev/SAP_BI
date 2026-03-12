import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Pencil, Save, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createColumnHelper } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/shared/data-table'
import { Dialog } from '@/components/shared/dialog'
import { StatusStepper } from '@/components/importacao/status-stepper'
import { FreeTimeBadge } from '@/components/importacao/free-time-badge'
import { TrackingTab } from '@/components/importacao/tracking-tab'
import { TimelineTab } from '@/components/importacao/timeline-tab'
import { DocumentsTab } from '@/components/importacao/documents-tab'
import { CostsTab } from '@/components/importacao/costs-tab'
import {
  useImportProcess,
  useImportItems,
  useUpdateProcess,
  useAdvanceStatus,
  type ImportItem,
} from '@/hooks/use-import-queries'
import { getNextStatus, getStatusDef, INCOTERMS, CURRENCIES } from '@/lib/import-constants'

type Tab = 'dados' | 'documentos' | 'custos' | 'tracking' | 'historico'

const itemCol = createColumnHelper<ImportItem>()

export default function ImportacaoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()
  const canEdit = hasRole('diretoria') || hasRole('importacao')

  const { data: process, isLoading } = useImportProcess(id)
  const { data: items = [] } = useImportItems(id)
  const updateProcess = useUpdateProcess()
  const advanceStatus = useAdvanceStatus()

  const [tab, setTab] = useState<Tab>('dados')
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false)
  const [advanceNotes, setAdvanceNotes] = useState('')
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState<Record<string, string | number | null>>({})

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!process) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/importacao')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Voltar
        </button>
        <p className="text-center text-muted-foreground">Processo não encontrado.</p>
      </div>
    )
  }

  const nextStatus = getNextStatus(process.status)
  const nextDef = nextStatus ? getStatusDef(nextStatus) : null

  const handleAdvance = async () => {
    if (!nextStatus || !user) return
    await advanceStatus.mutateAsync({
      processId: process.id,
      fromStatus: process.status,
      toStatus: nextStatus,
      userId: user.id,
      notes: advanceNotes || undefined,
    })
    setShowAdvanceDialog(false)
    setAdvanceNotes('')
  }

  const startEdit = () => {
    setEditFields({
      supplier: process.supplier,
      incoterm: process.incoterm,
      currency: process.currency,
      exchange_rate: process.exchange_rate,
      container_number: process.container_number ?? '',
      vessel: process.vessel ?? '',
      port_origin: process.port_origin ?? '',
      port_destination: process.port_destination ?? '',
      free_time_days: process.free_time_days,
      daily_demurrage_rate: process.daily_demurrage_rate,
      etd: process.etd ?? '',
      eta: process.eta ?? '',
      arrival_date: process.arrival_date ?? '',
      notes: process.notes ?? '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    await updateProcess.mutateAsync({
      id: process.id,
      ...Object.fromEntries(
        Object.entries(editFields).map(([k, v]) => [k, v === '' ? null : v])
      ),
      updated_by: user?.id,
    })
    setEditing(false)
  }

  const itemColumns = [
    itemCol.accessor('description', { header: 'Descrição' }),
    itemCol.accessor('ncm', { header: 'NCM', cell: (i) => i.getValue() || '—' }),
    itemCol.accessor('quantity', { header: 'Qtd', cell: (i) => Number(i.getValue()).toLocaleString('pt-BR') }),
    itemCol.accessor('unit', { header: 'Un' }),
    itemCol.accessor('unit_price', { header: 'Preço Unit.', cell: (i) => Number(i.getValue()).toLocaleString('pt-BR', { minimumFractionDigits: 4 }) }),
    itemCol.accessor('total_price', { header: 'Total', cell: (i) => Number(i.getValue()).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }),
  ]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dados', label: 'Dados' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'custos', label: 'Custos' },
    { key: 'tracking', label: 'Tracking' },
    { key: 'historico', label: 'Histórico' },
  ]

  const inputCls = 'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/importacao')} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{process.reference}</h1>
            <StatusBadge status={process.status} />
            {process.arrival_date && (
              <FreeTimeBadge arrivalDate={process.arrival_date} freeTimeDays={process.free_time_days} />
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {process.supplier}
            {process.container_number && ` • ${process.container_number}`}
            {process.vessel && ` • ${process.vessel}`}
          </p>
        </div>
        {canEdit && nextStatus && nextDef && (
          <button
            onClick={() => setShowAdvanceDialog(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            Avançar para {nextDef.label} <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Status stepper */}
      <StatusStepper currentStatus={process.status} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dados' && (
        <div className="space-y-6">
          {/* Process info */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Dados do Processo</h3>
              {canEdit && !editing && (
                <button onClick={startEdit} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Pencil size={12} /> Editar
                </button>
              )}
              {editing && (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <X size={12} /> Cancelar
                  </button>
                  <button onClick={saveEdit} disabled={updateProcess.isPending} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Save size={12} /> Salvar
                  </button>
                </div>
              )}
            </div>
            {editing ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <Field label="Fornecedor">
                  <input className={inputCls} value={String(editFields.supplier ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, supplier: e.target.value }))} />
                </Field>
                <Field label="Incoterm">
                  <select className={inputCls} value={String(editFields.incoterm ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, incoterm: e.target.value }))}>
                    {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </Field>
                <Field label="Moeda">
                  <select className={inputCls} value={String(editFields.currency ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, currency: e.target.value }))}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Taxa de Câmbio">
                  <input type="number" step="0.0001" className={inputCls} value={String(editFields.exchange_rate ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, exchange_rate: parseFloat(e.target.value) || 0 }))} />
                </Field>
                <Field label="Container">
                  <input className={inputCls} value={String(editFields.container_number ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, container_number: e.target.value }))} />
                </Field>
                <Field label="Navio">
                  <input className={inputCls} value={String(editFields.vessel ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, vessel: e.target.value }))} />
                </Field>
                <Field label="Porto Origem">
                  <input className={inputCls} value={String(editFields.port_origin ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, port_origin: e.target.value }))} />
                </Field>
                <Field label="Porto Destino">
                  <input className={inputCls} value={String(editFields.port_destination ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, port_destination: e.target.value }))} />
                </Field>
                <Field label="Free Time (dias)">
                  <input type="number" className={inputCls} value={String(editFields.free_time_days ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, free_time_days: parseInt(e.target.value) || 14 }))} />
                </Field>
                <Field label="Demurrage Diário">
                  <input type="number" step="0.01" className={inputCls} value={String(editFields.daily_demurrage_rate ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, daily_demurrage_rate: parseFloat(e.target.value) || 0 }))} />
                </Field>
                <Field label="ETD">
                  <input type="date" className={inputCls} value={String(editFields.etd ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, etd: e.target.value }))} />
                </Field>
                <Field label="ETA">
                  <input type="date" className={inputCls} value={String(editFields.eta ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, eta: e.target.value }))} />
                </Field>
                <Field label="Data Chegada">
                  <input type="date" className={inputCls} value={String(editFields.arrival_date ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, arrival_date: e.target.value }))} />
                </Field>
                <div className="col-span-full">
                  <Field label="Observações">
                    <textarea className={inputCls + ' min-h-[60px]'} value={String(editFields.notes ?? '')} onChange={(e) => setEditFields((p) => ({ ...p, notes: e.target.value }))} />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <InfoField label="Fornecedor" value={process.supplier} />
                <InfoField label="Incoterm" value={process.incoterm} />
                <InfoField label="Moeda" value={process.currency} />
                <InfoField label="Taxa de Câmbio" value={String(process.exchange_rate)} />
                <InfoField label="Container" value={process.container_number} />
                <InfoField label="Navio" value={process.vessel} />
                <InfoField label="Porto Origem" value={process.port_origin} />
                <InfoField label="Porto Destino" value={process.port_destination} />
                <InfoField label="Free Time" value={`${process.free_time_days} dias`} />
                <InfoField label="Demurrage Diário" value={process.daily_demurrage_rate > 0 ? `USD ${process.daily_demurrage_rate}` : '—'} />
                <InfoField label="ETD" value={process.etd ? format(parseISO(process.etd), 'dd/MM/yyyy', { locale: ptBR }) : null} />
                <InfoField label="ETA" value={process.eta ? format(parseISO(process.eta), 'dd/MM/yyyy', { locale: ptBR }) : null} />
                <InfoField label="Data Chegada" value={process.arrival_date ? format(parseISO(process.arrival_date), 'dd/MM/yyyy', { locale: ptBR }) : null} />
                <InfoField label="Total FOB" value={`${process.currency} ${Number(process.total_fob).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                {process.notes && <div className="col-span-full"><InfoField label="Observações" value={process.notes} /></div>}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold">Itens</h3>
            <DataTable data={items} columns={itemColumns} pageSize={50} />
          </div>
        </div>
      )}

      {tab === 'documentos' && (
        <DocumentsTab processId={process.id} readOnly={!canEdit} />
      )}

      {tab === 'custos' && (
        <CostsTab processId={process.id} currency={process.currency} exchangeRate={process.exchange_rate} readOnly={!canEdit} />
      )}

      {tab === 'tracking' && (
        <TrackingTab processId={process.id} readOnly={!canEdit} />
      )}

      {tab === 'historico' && (
        <TimelineTab processId={process.id} />
      )}

      {/* Advance dialog */}
      <Dialog
        open={showAdvanceDialog}
        onClose={() => setShowAdvanceDialog(false)}
        title={`Avançar para: ${nextDef?.label ?? ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O status será alterado de <strong>{getStatusDef(process.status).label}</strong> para <strong>{nextDef?.label}</strong>.
          </p>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Observações (opcional)</label>
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
              value={advanceNotes}
              onChange={(e) => setAdvanceNotes(e.target.value)}
              placeholder="Ex: Documentação completa, aguardando embarque..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdvanceDialog(false)} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">
              Cancelar
            </button>
            <button
              onClick={handleAdvance}
              disabled={advanceStatus.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {advanceStatus.isPending ? 'Avançando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  )
}
