import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { COST_TYPES, COST_TYPE_LABELS, type ImportCostType } from '@/lib/import-constants'
import { useImportCosts, useUpsertCost, useDeleteCost, type ImportCost } from '@/hooks/use-import-costs'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'

interface CostsTabProps {
  processId: string
  currency: string
  exchangeRate: number
  readOnly?: boolean
}

interface EditingRow {
  cost_type: ImportCostType
  cost_label: string
  planned_value: number
  actual_value: number
  currency: string
  exchange_rate: number
  payment_status: string
}

export function CostsTab({ processId, currency, exchangeRate, readOnly }: CostsTabProps) {
  const { hasRole } = useAuth()
  const canEdit = !readOnly && (hasRole('diretoria') || hasRole('importacao'))
  const { data: costs = [], isLoading } = useImportCosts(processId)
  const upsertCost = useUpsertCost()
  const deleteCost = useDeleteCost()

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<EditingRow | null>(null)
  const [extraCosts, setExtraCosts] = useState<EditingRow[]>([])

  // Build rows: 13 predefined types + any existing 'outros' entries + new extras
  const predefinedTypes = COST_TYPES.filter((t) => t !== 'outros')
  const existingOutros = costs.filter((c) => c.cost_type === 'outros')

  const getCostForType = (costType: ImportCostType, label: string): ImportCost | undefined =>
    costs.find((c) => c.cost_type === costType && c.cost_label === label)

  const startEdit = (costType: ImportCostType, label: string) => {
    const existing = getCostForType(costType, label)
    setEditingKey(`${costType}:${label}`)
    setEditRow({
      cost_type: costType,
      cost_label: label,
      planned_value: existing ? Number(existing.planned_value) : 0,
      actual_value: existing ? Number(existing.actual_value) : 0,
      currency: existing?.currency ?? (costType === 'frete_internacional' || costType === 'seguro' ? currency : 'BRL'),
      exchange_rate: existing ? Number(existing.exchange_rate) : (costType === 'frete_internacional' || costType === 'seguro' ? exchangeRate : 1),
      payment_status: existing?.payment_status ?? 'pendente',
    })
  }

  const saveRow = async () => {
    if (!editRow) return
    await upsertCost.mutateAsync({
      process_id: processId,
      cost_type: editRow.cost_type,
      cost_label: editRow.cost_label,
      planned_value: editRow.planned_value,
      actual_value: editRow.actual_value,
      currency: editRow.currency,
      exchange_rate: editRow.exchange_rate,
      payment_status: editRow.payment_status,
    })
    setEditingKey(null)
    setEditRow(null)
  }

  const addExtra = () => {
    setExtraCosts((prev) => [
      ...prev,
      {
        cost_type: 'outros' as ImportCostType,
        cost_label: `extra_${Date.now()}`,
        planned_value: 0,
        actual_value: 0,
        currency: 'BRL',
        exchange_rate: 1,
        payment_status: 'pendente',
      },
    ])
  }

  const saveExtra = async (extra: EditingRow, index: number) => {
    await upsertCost.mutateAsync({
      process_id: processId,
      cost_type: extra.cost_type,
      cost_label: extra.cost_label,
      planned_value: extra.planned_value,
      actual_value: extra.actual_value,
      currency: extra.currency,
      exchange_rate: extra.exchange_rate,
      payment_status: extra.payment_status,
    })
    setExtraCosts((prev) => prev.filter((_, i) => i !== index))
  }

  // Totals in BRL
  const toBRL = (val: number, cur: string, rate: number) =>
    cur === 'BRL' ? val : val * rate

  const totalPlanned = costs.reduce((s, c) => s + toBRL(Number(c.planned_value), c.currency, Number(c.exchange_rate)), 0)
  const totalActual = costs.reduce((s, c) => s + toBRL(Number(c.actual_value), c.currency, Number(c.exchange_rate)), 0)
  const deviation = totalPlanned > 0 ? ((totalActual - totalPlanned) / totalPlanned) * 100 : 0

  const paymentStatusLabels: Record<string, { label: string; color: string }> = {
    pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
    pago: { label: 'Pago', color: 'bg-green-100 text-green-800' },
    parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800' },
  }

  const cellCls = 'px-3 py-2'
  const inputCls = 'w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring'

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Planejado (BRL)</p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(totalPlanned)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Real (BRL)</p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(totalActual)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Desvio</p>
          <p className={`mt-1 text-lg font-bold ${deviation > 5 ? 'text-destructive' : deviation < -5 ? 'text-green-600' : ''}`}>
            {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Costs table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className={`${cellCls} text-left font-medium text-muted-foreground`}>Tipo de Custo</th>
              <th className={`${cellCls} text-right font-medium text-muted-foreground`}>Planejado</th>
              <th className={`${cellCls} text-right font-medium text-muted-foreground`}>Real</th>
              <th className={`${cellCls} text-center font-medium text-muted-foreground`}>Moeda</th>
              <th className={`${cellCls} text-right font-medium text-muted-foreground`}>Câmbio</th>
              <th className={`${cellCls} text-center font-medium text-muted-foreground`}>Pagamento</th>
              {canEdit && <th className={`${cellCls} w-16`}></th>}
            </tr>
          </thead>
          <tbody>
            {/* Predefined cost types */}
            {predefinedTypes.map((costType) => {
              const existing = getCostForType(costType, '')
              const key = `${costType}:`
              const isEditing = editingKey === key

              if (isEditing && editRow) {
                return (
                  <tr key={key} className="border-b border-border bg-primary/5">
                    <td className={cellCls}>
                      <span className="font-medium">{COST_TYPE_LABELS[costType]}</span>
                    </td>
                    <td className={cellCls}>
                      <input type="number" step="0.01" className={`${inputCls} text-right`} value={editRow.planned_value || ''} onChange={(e) => setEditRow({ ...editRow, planned_value: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className={cellCls}>
                      <input type="number" step="0.01" className={`${inputCls} text-right`} value={editRow.actual_value || ''} onChange={(e) => setEditRow({ ...editRow, actual_value: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className={cellCls}>
                      <select className={inputCls} value={editRow.currency} onChange={(e) => setEditRow({ ...editRow, currency: e.target.value })}>
                        <option value="BRL">BRL</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </td>
                    <td className={cellCls}>
                      <input type="number" step="0.0001" className={`${inputCls} text-right`} value={editRow.exchange_rate || ''} onChange={(e) => setEditRow({ ...editRow, exchange_rate: parseFloat(e.target.value) || 1 })} />
                    </td>
                    <td className={cellCls}>
                      <select className={inputCls} value={editRow.payment_status} onChange={(e) => setEditRow({ ...editRow, payment_status: e.target.value })}>
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="parcial">Parcial</option>
                      </select>
                    </td>
                    <td className={cellCls}>
                      <button onClick={saveRow} disabled={upsertCost.isPending} className="rounded p-1 text-primary hover:text-primary/80">
                        <Save size={14} />
                      </button>
                    </td>
                  </tr>
                )
              }

              return (
                <tr
                  key={key}
                  className={`border-b border-border last:border-0 ${canEdit ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                  onClick={canEdit ? () => startEdit(costType, '') : undefined}
                >
                  <td className={cellCls}>
                    <span className="font-medium">{COST_TYPE_LABELS[costType]}</span>
                  </td>
                  <td className={`${cellCls} text-right`}>
                    {existing ? Number(existing.planned_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className={`${cellCls} text-right`}>
                    {existing ? Number(existing.actual_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className={`${cellCls} text-center`}>{existing?.currency ?? '—'}</td>
                  <td className={`${cellCls} text-right`}>{existing ? Number(existing.exchange_rate).toFixed(4) : '—'}</td>
                  <td className={`${cellCls} text-center`}>
                    {existing ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusLabels[existing.payment_status]?.color ?? ''}`}>
                        {paymentStatusLabels[existing.payment_status]?.label ?? existing.payment_status}
                      </span>
                    ) : '—'}
                  </td>
                  {canEdit && <td className={cellCls}></td>}
                </tr>
              )
            })}

            {/* Existing outros */}
            {existingOutros.map((cost) => {
              const key = `outros:${cost.cost_label}`
              const isEditing = editingKey === key

              if (isEditing && editRow) {
                return (
                  <tr key={cost.id} className="border-b border-border bg-primary/5">
                    <td className={cellCls}>
                      <input className={inputCls} value={editRow.cost_label} onChange={(e) => setEditRow({ ...editRow, cost_label: e.target.value })} placeholder="Descrição do custo" />
                    </td>
                    <td className={cellCls}>
                      <input type="number" step="0.01" className={`${inputCls} text-right`} value={editRow.planned_value || ''} onChange={(e) => setEditRow({ ...editRow, planned_value: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className={cellCls}>
                      <input type="number" step="0.01" className={`${inputCls} text-right`} value={editRow.actual_value || ''} onChange={(e) => setEditRow({ ...editRow, actual_value: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className={cellCls}>
                      <select className={inputCls} value={editRow.currency} onChange={(e) => setEditRow({ ...editRow, currency: e.target.value })}>
                        <option value="BRL">BRL</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </td>
                    <td className={cellCls}>
                      <input type="number" step="0.0001" className={`${inputCls} text-right`} value={editRow.exchange_rate || ''} onChange={(e) => setEditRow({ ...editRow, exchange_rate: parseFloat(e.target.value) || 1 })} />
                    </td>
                    <td className={cellCls}>
                      <select className={inputCls} value={editRow.payment_status} onChange={(e) => setEditRow({ ...editRow, payment_status: e.target.value })}>
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="parcial">Parcial</option>
                      </select>
                    </td>
                    <td className={cellCls}>
                      <button onClick={saveRow} disabled={upsertCost.isPending} className="rounded p-1 text-primary hover:text-primary/80">
                        <Save size={14} />
                      </button>
                    </td>
                  </tr>
                )
              }

              return (
                <tr
                  key={cost.id}
                  className={`border-b border-border last:border-0 ${canEdit ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                  onClick={canEdit ? () => startEdit('outros', cost.cost_label) : undefined}
                >
                  <td className={cellCls}>
                    <span className="font-medium">{cost.cost_label || 'Outros'}</span>
                  </td>
                  <td className={`${cellCls} text-right`}>{Number(cost.planned_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className={`${cellCls} text-right`}>{Number(cost.actual_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className={`${cellCls} text-center`}>{cost.currency}</td>
                  <td className={`${cellCls} text-right`}>{Number(cost.exchange_rate).toFixed(4)}</td>
                  <td className={`${cellCls} text-center`}>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusLabels[cost.payment_status]?.color ?? ''}`}>
                      {paymentStatusLabels[cost.payment_status]?.label ?? cost.payment_status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className={cellCls}>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCost.mutate({ id: cost.id, processId }) }}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}

            {/* New extras (unsaved) */}
            {extraCosts.map((extra, idx) => (
              <tr key={`extra-${idx}`} className="border-b border-border bg-muted/20">
                <td className={cellCls}>
                  <input
                    className={inputCls}
                    value={extra.cost_label}
                    onChange={(e) => setExtraCosts((prev) => prev.map((ex, i) => i === idx ? { ...ex, cost_label: e.target.value } : ex))}
                    placeholder="Descrição do custo"
                  />
                </td>
                <td className={cellCls}>
                  <input type="number" step="0.01" className={`${inputCls} text-right`} value={extra.planned_value || ''} onChange={(e) => setExtraCosts((prev) => prev.map((ex, i) => i === idx ? { ...ex, planned_value: parseFloat(e.target.value) || 0 } : ex))} />
                </td>
                <td className={cellCls}>
                  <input type="number" step="0.01" className={`${inputCls} text-right`} value={extra.actual_value || ''} onChange={(e) => setExtraCosts((prev) => prev.map((ex, i) => i === idx ? { ...ex, actual_value: parseFloat(e.target.value) || 0 } : ex))} />
                </td>
                <td className={cellCls}>
                  <select className={inputCls} value={extra.currency} onChange={(e) => setExtraCosts((prev) => prev.map((ex, i) => i === idx ? { ...ex, currency: e.target.value } : ex))}>
                    <option value="BRL">BRL</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </td>
                <td className={cellCls}>
                  <input type="number" step="0.0001" className={`${inputCls} text-right`} value={extra.exchange_rate || ''} onChange={(e) => setExtraCosts((prev) => prev.map((ex, i) => i === idx ? { ...ex, exchange_rate: parseFloat(e.target.value) || 1 } : ex))} />
                </td>
                <td className={cellCls}>
                  <select className={inputCls} value={extra.payment_status} onChange={(e) => setExtraCosts((prev) => prev.map((ex, i) => i === idx ? { ...ex, payment_status: e.target.value } : ex))}>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="parcial">Parcial</option>
                  </select>
                </td>
                <td className={cellCls}>
                  <button onClick={() => saveExtra(extra, idx)} disabled={upsertCost.isPending} className="rounded p-1 text-primary hover:text-primary/80">
                    <Save size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Summary footer */}
          <tfoot className="border-t-2 border-border bg-muted/30">
            <tr>
              <td className={`${cellCls} font-semibold`}>Total (BRL)</td>
              <td className={`${cellCls} text-right font-semibold`}>{formatCurrency(totalPlanned)}</td>
              <td className={`${cellCls} text-right font-semibold`}>{formatCurrency(totalActual)}</td>
              <td colSpan={canEdit ? 4 : 3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add extra cost button */}
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={addExtra} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
            <Plus size={14} /> Adicionar custo extra
          </button>
        </div>
      )}
    </div>
  )
}
