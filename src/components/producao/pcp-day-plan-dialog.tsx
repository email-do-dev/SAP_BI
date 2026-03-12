import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Dialog } from '@/components/shared/dialog'
import { cn } from '@/lib/utils'
import { PCP_STATUS_CONFIG, type PcpPlanStatus } from '@/lib/production-constants'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'

const toast = {
  success: (msg: string) => console.log('[success]', msg),
  error: (msg: string) => console.error('[error]', msg),
}

interface PlanForm {
  id?: string
  item_code: string
  item_name: string
  planned_qty: number
  sequence_order: number
  sap_wo_doc_entry: number | null
  notes: string
  status: PcpPlanStatus
}

const EMPTY_FORM: PlanForm = {
  item_code: '',
  item_name: '',
  planned_qty: 0,
  sequence_order: 1,
  sap_wo_doc_entry: null,
  notes: '',
  status: 'planejado',
}

interface PcpDayPlanDialogProps {
  open: boolean
  onClose: () => void
  date: Date | null
  lineId: string | null
  lineName: string
  shiftId: string | null
}

export function PcpDayPlanDialog({ open, onClose, date, lineId, lineName, shiftId }: PcpDayPlanDialogProps) {
  const queryClient = useQueryClient()
  const [editingPlan, setEditingPlan] = useState<PlanForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const dateStr = date ? format(date, 'yyyy-MM-dd') : null

  // Buscar planos existentes para esse dia + linha
  const { data: existingPlans = [], isLoading } = useQuery({
    queryKey: ['pcp_day_plans', dateStr, lineId, shiftId],
    queryFn: async () => {
      if (!dateStr || !lineId) return []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from as any)('pcp_daily_plans')
        .select('*')
        .eq('plan_date', dateStr)
        .eq('line_id', lineId)
        .order('sequence_order', { ascending: true })

      if (shiftId) {
        query = query.eq('shift_id', shiftId)
      }

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
    enabled: open && !!dateStr && !!lineId,
  })

  // Resetar form quando fecha
  useEffect(() => {
    if (!open) {
      setEditingPlan(null)
    }
  }, [open])

  async function handleSave() {
    if (!editingPlan || !dateStr || !lineId) return

    setSaving(true)
    try {
      const record = {
        plan_date: dateStr,
        line_id: lineId,
        shift_id: shiftId,
        item_code: editingPlan.item_code,
        item_name: editingPlan.item_name,
        planned_qty: editingPlan.planned_qty,
        sequence_order: editingPlan.sequence_order,
        sap_wo_doc_entry: editingPlan.sap_wo_doc_entry,
        notes: editingPlan.notes || null,
        status: editingPlan.status,
      }

      if (editingPlan.id) {
        // Atualizar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from as any)('pcp_daily_plans')
          .update(record)
          .eq('id', editingPlan.id)
        if (error) throw error
        toast.success('Plano atualizado com sucesso.')
      } else {
        // Inserir
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from as any)('pcp_daily_plans')
          .insert(record)
        if (error) throw error
        toast.success('Plano criado com sucesso.')
      }

      setEditingPlan(null)
      queryClient.invalidateQueries({ queryKey: ['pcp_daily_plans'] })
      queryClient.invalidateQueries({ queryKey: ['pcp_day_plans'] })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar plano.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(planId: string) {
    setDeleting(planId)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)('pcp_daily_plans')
        .delete()
        .eq('id', planId)
      if (error) throw error

      toast.success('Plano removido.')
      queryClient.invalidateQueries({ queryKey: ['pcp_daily_plans'] })
      queryClient.invalidateQueries({ queryKey: ['pcp_day_plans'] })

      if (editingPlan?.id === planId) {
        setEditingPlan(null)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao remover plano.')
    } finally {
      setDeleting(null)
    }
  }

  function handleEditExisting(plan: PlanForm & { id: string }) {
    setEditingPlan({
      id: plan.id,
      item_code: plan.item_code,
      item_name: plan.item_name,
      planned_qty: plan.planned_qty,
      sequence_order: plan.sequence_order,
      sap_wo_doc_entry: plan.sap_wo_doc_entry,
      notes: plan.notes ?? '',
      status: plan.status,
    })
  }

  function handleNewPlan() {
    const nextOrder = existingPlans.length > 0
      ? Math.max(...existingPlans.map((p: { sequence_order: number }) => p.sequence_order)) + 1
      : 1
    setEditingPlan({ ...EMPTY_FORM, sequence_order: nextOrder })
  }

  const dialogTitle = date
    ? `Planos — ${lineName} — ${format(date, "EEEE, dd/MM/yyyy", { locale: ptBR })}`
    : 'Plano de Produção'

  return (
    <Dialog open={open} onClose={onClose} title={dialogTitle} className="max-w-2xl">
      <div className="space-y-4">
        {/* Lista de planos existentes */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : existingPlans.length === 0 && !editingPlan ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum plano cadastrado para este dia e linha.
          </p>
        ) : (
          <div className="space-y-2">
            {existingPlans.map((plan: PlanForm & { id: string }) => {
              const statusCfg = PCP_STATUS_CONFIG[plan.status]
              const isEditing = editingPlan?.id === plan.id

              if (isEditing) return null // Renderizado no formulário abaixo

              return (
                <div
                  key={plan.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.item_name}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusCfg.bgColor, statusCfg.color)}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {plan.item_code} — {plan.planned_qty} un — Seq. {plan.sequence_order}
                      {plan.sap_wo_doc_entry ? ` — OP ${plan.sap_wo_doc_entry}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditExisting(plan)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Editar"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      disabled={deleting === plan.id}
                      className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      title="Remover"
                    >
                      {deleting === plan.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Formulário de edição/criação */}
        {editingPlan && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h4 className="mb-3 text-sm font-medium">
              {editingPlan.id ? 'Editar Plano' : 'Novo Plano'}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Código do Item</label>
                <input
                  type="text"
                  value={editingPlan.item_code}
                  onChange={(e) => setEditingPlan({ ...editingPlan, item_code: e.target.value })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                  placeholder="Ex: MP-001"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Nome do Item</label>
                <input
                  type="text"
                  value={editingPlan.item_name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, item_name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                  placeholder="Ex: Sardinha em Óleo 125g"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Qtd. Planejada</label>
                <input
                  type="number"
                  value={editingPlan.planned_qty}
                  onChange={(e) => setEditingPlan({ ...editingPlan, planned_qty: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                  min={0}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Sequência</label>
                <input
                  type="number"
                  value={editingPlan.sequence_order}
                  onChange={(e) => setEditingPlan({ ...editingPlan, sequence_order: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                  min={1}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">OP SAP (opcional)</label>
                <input
                  type="number"
                  value={editingPlan.sap_wo_doc_entry ?? ''}
                  onChange={(e) => setEditingPlan({
                    ...editingPlan,
                    sap_wo_doc_entry: e.target.value ? Number(e.target.value) : null,
                  })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                  placeholder="DocEntry"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Status</label>
                <select
                  value={editingPlan.status}
                  onChange={(e) => setEditingPlan({ ...editingPlan, status: e.target.value as PcpPlanStatus })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                >
                  {Object.entries(PCP_STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">Observações</label>
                <textarea
                  value={editingPlan.notes}
                  onChange={(e) => setEditingPlan({ ...editingPlan, notes: e.target.value })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                  rows={2}
                  placeholder="Notas opcionais..."
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingPlan(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editingPlan.item_code || !editingPlan.item_name || editingPlan.planned_qty <= 0}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* Botão novo plano */}
        {!editingPlan && (
          <button
            onClick={handleNewPlan}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus size={16} />
            Adicionar plano
          </button>
        )}
      </div>
    </Dialog>
  )
}
