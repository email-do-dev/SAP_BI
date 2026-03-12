import { useSapQuery } from '@/hooks/use-sap-query'
import { Dialog } from '@/components/shared/dialog'
import { cn, formatNumber } from '@/lib/utils'
import { OP_STATUS_CONFIG, type OpStatus } from '@/lib/production-constants'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface OrdemHeader {
  doc_entry: number
  doc_num: number
  item_code: string
  item_name: string
  status: OpStatus
  planned_qty: number
  completed_qty: number
  rejected_qty: number
  create_date: string
  start_date: string | null
  due_date: string
  close_date: string | null
  warehouse: string
  remarks: string | null
}

interface OrdemComponent {
  line_num: number
  item_code: string
  item_name: string
  planned_qty: number
  issued_qty: number
  pending_qty: number
  stock_available: number
  uom: string
  warehouse: string
}

interface OrdemDetalheResult {
  header: OrdemHeader[]
  lines: OrdemComponent[]
}

interface OrdemDetalheDialogProps {
  docEntry: number | null
  onClose: () => void
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function OrdemDetalheDialog({ docEntry, onClose }: OrdemDetalheDialogProps) {
  const { data, isLoading } = useSapQuery<OrdemDetalheResult>({
    queryName: 'producao_ordem_detalhe',
    params: { doc_entry: docEntry! },
    enabled: !!docEntry,
  })

  const header = data?.header?.[0]
  const lines = data?.lines ?? []

  const progressPct = header
    ? Math.min(100, Math.round((header.completed_qty / header.planned_qty) * 100))
    : 0

  const statusConfig = header ? OP_STATUS_CONFIG[header.status] : null

  return (
    <Dialog
      open={!!docEntry}
      onClose={onClose}
      title={header ? `OP ${header.doc_num} \u2014 ${header.item_name}` : 'Detalhes da OP'}
      className="max-w-4xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !header ? (
        <p className="py-8 text-center text-muted-foreground">Nenhum dado encontrado.</p>
      ) : (
        <div className="space-y-6">
          {/* Cabecalho */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Produto</p>
              <p className="font-medium">{header.item_name}</p>
              <p className="text-xs text-muted-foreground">{header.item_code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              {statusConfig && (
                <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', statusConfig.bgColor, statusConfig.color)}>
                  {header.status}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Deposito</p>
              <p className="font-medium">{header.warehouse}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Observacoes</p>
              <p className="text-sm">{header.remarks || '\u2014'}</p>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Criacao</p>
              <p className="font-medium">{formatDate(header.create_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inicio</p>
              <p className="font-medium">{formatDate(header.start_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencimento</p>
              <p className="font-medium">{formatDate(header.due_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Encerramento</p>
              <p className="font-medium">{formatDate(header.close_date)}</p>
            </div>
          </div>

          {/* Progresso */}
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">
                {formatNumber(header.completed_qty)} / {formatNumber(header.planned_qty)} ({progressPct}%)
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  progressPct >= 100 ? 'bg-green-500' : progressPct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {header.rejected_qty > 0 && (
              <p className="mt-1 text-xs text-red-600">
                Rejeitadas: {formatNumber(header.rejected_qty)}
              </p>
            )}
          </div>

          {/* Tabela de Componentes */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Componentes</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Codigo</th>
                    <th className="px-3 py-2 text-left font-medium">Descricao</th>
                    <th className="px-3 py-2 text-right font-medium">Planejado</th>
                    <th className="px-3 py-2 text-right font-medium">Emitido</th>
                    <th className="px-3 py-2 text-right font-medium">Pendente</th>
                    <th className="px-3 py-2 text-right font-medium">Estoque Disp.</th>
                    <th className="px-3 py-2 text-left font-medium">UM</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((comp) => (
                    <tr
                      key={comp.line_num}
                      className={cn(
                        'border-b border-border last:border-0',
                        comp.stock_available < comp.pending_qty && 'bg-red-50 text-red-900'
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{comp.item_code}</td>
                      <td className="px-3 py-2">{comp.item_name}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(comp.planned_qty)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(comp.issued_qty)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(comp.pending_qty)}</td>
                      <td className={cn(
                        'px-3 py-2 text-right font-medium',
                        comp.stock_available < comp.pending_qty && 'text-red-700'
                      )}>
                        {formatNumber(comp.stock_available)}
                      </td>
                      <td className="px-3 py-2">{comp.uom}</td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        Nenhum componente encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}
