import { useState, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { format } from 'date-fns'
import { RotateCcw, FileText, DollarSign, AlertTriangle } from 'lucide-react'
import { usePageView, useActivityLog } from '@/hooks/use-activity-log'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/shared/data-table'
import { RefreshIndicator } from '@/components/shared/refresh-indicator'
import { Dialog } from '@/components/shared/dialog'
import { KpiSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'
import { useCacheQuery, useSapQuery } from '@/hooks/use-sap-query'
import { formatCurrency, formatNumber, exportToCsv } from '@/lib/utils'
import type { Database } from '@/types/database'

type Devolucao = Database['public']['Tables']['sap_cache_devolucoes']['Row']

interface DevolucaoLinha {
  ItemCode: string
  Dscription: string
  Quantity: number
  Price: number
  LineTotal: number
}

const col = createColumnHelper<Devolucao>()

type Tab = 'returns' | 'credit_memos'

export default function DevolucoesPage() {
  usePageView('devolucoes')
  const { logActivity } = useActivityLog()
  const [tab, setTab] = useState<Tab>('returns')
  const [selected, setSelected] = useState<Devolucao | null>(null)

  const { data: devolucoes, isLoading, error } = useCacheQuery<Devolucao[]>('sap_cache_devolucoes', {
    order: 'doc_date',
  })

  const { data: linhas, isLoading: linhasLoading } = useSapQuery<DevolucaoLinha[]>({
    queryName: 'devolucao_linhas',
    params: { docEntry: selected?.doc_entry ?? 0, docType: selected?.doc_type ?? 'return' },
    enabled: !!selected,
  })

  const filtered = useMemo(
    () => (devolucoes ?? []).filter((d) => (tab === 'returns' ? d.doc_type === 'return' : d.doc_type === 'credit_memo')),
    [devolucoes, tab]
  )

  const stats = useMemo(() => {
    const all = devolucoes ?? []
    const returns = all.filter((d) => d.doc_type === 'return')
    const credits = all.filter((d) => d.doc_type === 'credit_memo')
    return {
      totalReturns: returns.length,
      totalCredits: credits.length,
      returnValue: returns.reduce((s, d) => s + d.doc_total, 0),
      creditValue: credits.reduce((s, d) => s + d.doc_total, 0),
    }
  }, [devolucoes])

  const handleExport = () => {
    logActivity({ action: 'export', resource: 'devolucoes', metadata: { rows: filtered.length } })
    exportToCsv(filtered, [
      { key: 'doc_num', header: 'Nº Documento' },
      { key: 'card_name', header: 'Cliente' },
      { key: 'doc_date', header: 'Data' },
      { key: 'doc_total', header: 'Valor' },
      { key: 'doc_type', header: 'Tipo' },
    ], `devolucoes_${tab}`)
  }

  const columns = useMemo(
    () => [
      col.accessor('doc_num', { header: 'Nº Documento', size: 120 }),
      col.accessor('card_name', { header: 'Cliente' }),
      col.accessor('doc_date', {
        header: 'Data',
        cell: (info) => format(new Date(info.getValue()), 'dd/MM/yyyy'),
        size: 120,
      }),
      col.accessor('doc_total', {
        header: 'Valor',
        cell: (info) => formatCurrency(info.getValue()),
        size: 130,
      }),
    ],
    []
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Devoluções</h1>
        <RefreshIndicator refreshedAt={devolucoes?.[0]?.refreshed_at} />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Erro ao carregar dados: {error.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard title="Devoluções" value={formatNumber(stats.totalReturns)} icon={<RotateCcw size={20} />} />
            <KpiCard title="Notas de Crédito" value={formatNumber(stats.totalCredits)} icon={<FileText size={20} />} />
            <KpiCard title="Valor Devoluções" value={formatCurrency(stats.returnValue)} icon={<AlertTriangle size={20} />} />
            <KpiCard title="Valor Créditos" value={formatCurrency(stats.creditValue)} icon={<DollarSign size={20} />} />
          </>
        )}
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('returns')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'returns' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Devoluções
        </button>
        <button
          onClick={() => setTab('credit_memos')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'credit_memos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Notas de Crédito
        </button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          searchPlaceholder="Buscar por cliente..."
          searchColumn="card_name"
          onRowClick={setSelected}
          onExport={handleExport}
        />
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={`Documento ${selected?.doc_num ?? ''}`}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Cliente:</span>
                <p className="font-medium">{selected.card_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Data:</span>
                <p className="font-medium">{format(new Date(selected.doc_date), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total:</span>
                <p className="font-medium">{formatCurrency(selected.doc_total)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <p className="font-medium">{selected.doc_type === 'return' ? 'Devolução' : 'Nota de Crédito'}</p>
              </div>
            </div>

            <h3 className="text-sm font-medium text-muted-foreground">Itens</h3>
            {linhasLoading ? (
              <TableSkeleton rows={3} />
            ) : (
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground">Código</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Descrição</th>
                      <th className="px-3 py-2 text-right text-muted-foreground">Qtd</th>
                      <th className="px-3 py-2 text-right text-muted-foreground">Preço</th>
                      <th className="px-3 py-2 text-right text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(linhas ?? []).map((l, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">{l.ItemCode}</td>
                        <td className="px-3 py-2">{l.Dscription}</td>
                        <td className="px-3 py-2 text-right">{l.Quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(l.Price)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(l.LineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
