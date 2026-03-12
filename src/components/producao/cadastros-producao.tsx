import { useState, useMemo, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
// Simple toast replacement (no sonner)
const toast = {
  success: (msg: string) => console.log('[success]', msg),
  error: (msg: string) => console.error('[error]', msg),
}
import { DataTable } from '@/components/shared/data-table'
import { Dialog } from '@/components/shared/dialog'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { LINE_TYPE_CONFIG, LINE_TYPES, STOP_CATEGORIES, STOP_CATEGORY_LABELS, TEAM_ROLE_LABELS, type LineType, type StopCategory, type TeamRole } from '@/lib/production-constants'
import type { Database } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductionLine = Database['public']['Tables']['production_lines']['Row']
type ProductionLineInsert = Database['public']['Tables']['production_lines']['Insert']
type ProductionLineUpdate = Database['public']['Tables']['production_lines']['Update']

type ProductionStep = Database['public']['Tables']['production_steps']['Row']
type ProductionStepInsert = Database['public']['Tables']['production_steps']['Insert']
type ProductionStepUpdate = Database['public']['Tables']['production_steps']['Update']

type ProductionShift = Database['public']['Tables']['production_shifts']['Row']
type ProductionShiftInsert = Database['public']['Tables']['production_shifts']['Insert']
type ProductionShiftUpdate = Database['public']['Tables']['production_shifts']['Update']

type ProductionLineShift = Database['public']['Tables']['production_line_shifts']['Row']
type ProductionLineShiftInsert = Database['public']['Tables']['production_line_shifts']['Insert']

type StopReason = Database['public']['Tables']['production_stop_reasons']['Row']
type StopReasonInsert = Database['public']['Tables']['production_stop_reasons']['Insert']
type StopReasonUpdate = Database['public']['Tables']['production_stop_reasons']['Update']

type ProductionTeam = Database['public']['Tables']['production_teams']['Row']
type ProductionTeamInsert = Database['public']['Tables']['production_teams']['Insert']
type ProductionTeamUpdate = Database['public']['Tables']['production_teams']['Update']

// ─── Constants ───────────────────────────────────────────────────────────────

type CadastroTab = 'linhas' | 'etapas' | 'turnos' | 'paradas' | 'equipes'

const TABS: { id: CadastroTab; label: string }[] = [
  { id: 'linhas', label: 'Linhas' },
  { id: 'etapas', label: 'Etapas' },
  { id: 'turnos', label: 'Turnos' },
  { id: 'paradas', label: 'Motivos de Parada' },
  { id: 'equipes', label: 'Equipes' },
]

// ─── Shared form field components ────────────────────────────────────────────

const inputClass = 'w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring bg-card'
const labelClass = 'text-sm font-medium'

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

function ActiveBadge({ active, onClick }: { active: boolean; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
        active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600',
        onClick && 'cursor-pointer hover:opacity-80'
      )}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CadastrosProducao() {
  const [activeTab, setActiveTab] = useState<CadastroTab>('linhas')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'linhas' && <LinhasTab />}
      {activeTab === 'etapas' && <EtapasTab />}
      {activeTab === 'turnos' && <TurnosTab />}
      {activeTab === 'paradas' && <ParadasTab />}
      {activeTab === 'equipes' && <EquipesTab />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Linhas Tab
// ═══════════════════════════════════════════════════════════════════════════════

const lCol = createColumnHelper<ProductionLine>()

function LinhasTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductionLine | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cadastros', 'production_lines'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('production_lines') as any)
        .select('*')
        .order('sort_order')
      if (error) throw error
      return data as ProductionLine[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const upsert = useMutation({
    mutationFn: async (values: ProductionLineInsert | (ProductionLineUpdate & { id: string })) => {
      if ('id' in values && values.id) {
        const { id, ...rest } = values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_lines') as any).update(rest).eq('id', id)
        if (error) throw error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_lines') as any).insert(values as ProductionLineInsert)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_lines'] })
      toast.success('Linha salva com sucesso')
      closeDialog()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar linha')
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('production_lines') as any).update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_lines'] })
      toast.success('Status atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar status')
    },
  })

  function openCreate() { setEditing(null); setDialogOpen(true) }
  function openEdit(row: ProductionLine) { setEditing(row); setDialogOpen(true) }
  function closeDialog() { setDialogOpen(false); setEditing(null) }

  const columns = useMemo(() => [
    lCol.accessor('name', { header: 'Nome' }),
    lCol.accessor('line_type', {
      header: 'Tipo',
      cell: (info) => {
        const cfg = LINE_TYPE_CONFIG[info.getValue() as LineType]
        if (!cfg) return info.getValue()
        return (
          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', cfg.bgColor, cfg.color)}>
            {cfg.label}
          </span>
        )
      },
    }),
    lCol.accessor('capacity_per_hour', {
      header: 'Capacidade/h',
      cell: (info) => info.getValue()?.toLocaleString('pt-BR') ?? '—',
      size: 120,
    }),
    lCol.accessor('sort_order', {
      header: 'Ordem',
      size: 80,
    }),
    lCol.accessor('is_active', {
      header: 'Status',
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          onClick={(e) => {
            e.stopPropagation()
            toggleActive.mutate({ id: info.row.original.id, is_active: !info.getValue() })
          }}
        />
      ),
      size: 90,
    }),
  ], [toggleActive])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Linhas de Produção</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={16} /> Nova
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={5} /> : (
        <DataTable data={data ?? []} columns={columns} searchPlaceholder="Buscar linha..." onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? 'Editar Linha' : 'Nova Linha'}>
        <LinhaForm
          initial={editing}
          isPending={upsert.isPending}
          error={upsert.error}
          onSubmit={(v) => upsert.mutate(v)}
        />
      </Dialog>
    </div>
  )
}

function LinhaForm({
  initial,
  isPending,
  error,
  onSubmit,
}: {
  initial: ProductionLine | null
  isPending: boolean
  error: Error | null
  onSubmit: (v: ProductionLineInsert | (ProductionLineUpdate & { id: string })) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [lineType, setLineType] = useState(initial?.line_type ?? 'conserva')
  const [capacityPerHour, setCapacityPerHour] = useState(initial?.capacity_per_hour?.toString() ?? '')
  const [sortOrder, setSortOrder] = useState(initial?.sort_order?.toString() ?? '0')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const values = {
      name: name.trim(),
      line_type: lineType,
      capacity_per_hour: capacityPerHour ? Number(capacityPerHour) : 0,
      sort_order: sortOrder ? Number(sortOrder) : 0,
      description: description || null,
      is_active: isActive,
    }
    if (initial) {
      onSubmit({ id: initial.id, ...values })
    } else {
      onSubmit(values)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.message || 'Erro ao salvar'}
        </div>
      )}

      <Field label="Nome *">
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tipo">
          <select value={lineType} onChange={(e) => setLineType(e.target.value)} className={inputClass}>
            {LINE_TYPES.map((t) => (
              <option key={t} value={t}>{LINE_TYPE_CONFIG[t].label}</option>
            ))}
          </select>
        </Field>
        <Field label="Capacidade/h">
          <input type="number" value={capacityPerHour} onChange={(e) => setCapacityPerHour(e.target.value)} className={inputClass} min={0} />
        </Field>
      </div>

      <Field label="Ordem de Exibição">
        <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputClass} min={0} />
      </Field>

      <Field label="Descrição">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={2} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border" />
        Ativo
      </label>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Etapas Tab
// ═══════════════════════════════════════════════════════════════════════════════

const sCol = createColumnHelper<ProductionStep>()

function EtapasTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductionStep | null>(null)
  const [selectedLineId, setSelectedLineId] = useState<string>('')

  // Fetch lines for the filter dropdown
  const { data: lines } = useQuery({
    queryKey: ['cadastros', 'production_lines'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('production_lines') as any)
        .select('id, name, is_active')
        .order('sort_order')
      if (error) throw error
      return data as Pick<ProductionLine, 'id' | 'name' | 'is_active'>[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['cadastros', 'production_steps', selectedLineId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from('production_steps') as any).select('*').order('sequence')
      if (selectedLineId) {
        query = query.eq('line_id', selectedLineId)
      }
      const { data, error } = await query
      if (error) throw error
      return data as ProductionStep[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const lineMap = useMemo(() => {
    const map = new Map<string, string>()
    lines?.forEach((l) => map.set(l.id, l.name))
    return map
  }, [lines])

  const upsert = useMutation({
    mutationFn: async (values: ProductionStepInsert | (ProductionStepUpdate & { id: string })) => {
      if ('id' in values && values.id) {
        const { id, ...rest } = values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_steps') as any).update(rest).eq('id', id)
        if (error) throw error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_steps') as any).insert(values as ProductionStepInsert)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_steps'] })
      toast.success('Etapa salva com sucesso')
      closeDialog()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar etapa')
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('production_steps') as any).update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_steps'] })
      toast.success('Status atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar status')
    },
  })

  function openCreate() { setEditing(null); setDialogOpen(true) }
  function openEdit(row: ProductionStep) { setEditing(row); setDialogOpen(true) }
  function closeDialog() { setDialogOpen(false); setEditing(null) }

  const columns = useMemo(() => [
    sCol.accessor('sequence', { header: 'Sequência', size: 100 }),
    sCol.accessor('name', { header: 'Nome' }),
    sCol.accessor('line_id', {
      header: 'Linha',
      cell: (info) => lineMap.get(info.getValue()) ?? '—',
    }),
    sCol.accessor('is_checkpoint', {
      header: 'Checkpoint',
      cell: (info) => (
        <span className={cn(
          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
          info.getValue() ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
        )}>
          {info.getValue() ? 'Sim' : 'Não'}
        </span>
      ),
      size: 110,
    }),
    sCol.accessor('estimated_duration_min', {
      header: 'Duração Est. (min)',
      cell: (info) => info.getValue()?.toLocaleString('pt-BR') ?? '—',
      size: 140,
    }),
    sCol.accessor('is_active', {
      header: 'Status',
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          onClick={(e) => {
            e.stopPropagation()
            toggleActive.mutate({ id: info.row.original.id, is_active: !info.getValue() })
          }}
        />
      ),
      size: 90,
    }),
  ], [toggleActive, lineMap])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Etapas de Produção</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={16} /> Nova
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground">Filtrar por linha:</label>
        <select
          value={selectedLineId}
          onChange={(e) => setSelectedLineId(e.target.value)}
          className={cn(inputClass, 'w-64')}
        >
          <option value="">Todas as linhas</option>
          {lines?.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? <TableSkeleton rows={5} /> : (
        <DataTable data={data ?? []} columns={columns} searchPlaceholder="Buscar etapa..." onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? 'Editar Etapa' : 'Nova Etapa'}>
        <EtapaForm
          initial={editing}
          lines={lines ?? []}
          defaultLineId={selectedLineId}
          isPending={upsert.isPending}
          error={upsert.error}
          onSubmit={(v) => upsert.mutate(v)}
        />
      </Dialog>
    </div>
  )
}

function EtapaForm({
  initial,
  lines,
  defaultLineId,
  isPending,
  error,
  onSubmit,
}: {
  initial: ProductionStep | null
  lines: Pick<ProductionLine, 'id' | 'name' | 'is_active'>[]
  defaultLineId: string
  isPending: boolean
  error: Error | null
  onSubmit: (v: ProductionStepInsert | (ProductionStepUpdate & { id: string })) => void
}) {
  const [lineId, setLineId] = useState(initial?.line_id ?? defaultLineId ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [sequence, setSequence] = useState(initial?.sequence?.toString() ?? '1')
  const [isCheckpoint, setIsCheckpoint] = useState(initial?.is_checkpoint ?? false)
  const [estimatedDuration, setEstimatedDuration] = useState(initial?.estimated_duration_min?.toString() ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const values: ProductionStepInsert = {
      line_id: lineId,
      name: name.trim(),
      sequence: Number(sequence),
      is_checkpoint: isCheckpoint,
      estimated_duration_min: estimatedDuration ? Number(estimatedDuration) : 0,
    }
    if (initial) {
      onSubmit({ id: initial.id, ...values, is_active: isActive })
    } else {
      onSubmit(values)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.message || 'Erro ao salvar'}
        </div>
      )}

      <Field label="Linha *">
        <select value={lineId} onChange={(e) => setLineId(e.target.value)} className={inputClass} required>
          <option value="">Selecione...</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Nome *">
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Sequência *">
          <input type="number" required value={sequence} onChange={(e) => setSequence(e.target.value)} className={inputClass} min={1} />
        </Field>
        <Field label="Duração Estimada (min)">
          <input type="number" value={estimatedDuration} onChange={(e) => setEstimatedDuration(e.target.value)} className={inputClass} min={0} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isCheckpoint} onChange={(e) => setIsCheckpoint(e.target.checked)} className="rounded border-border" />
        Ponto de verificação (checkpoint)
      </label>

      {initial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border" />
          Ativo
        </label>
      )}

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Turnos Tab
// ═══════════════════════════════════════════════════════════════════════════════

const tCol = createColumnHelper<ProductionShift>()

function TurnosTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductionShift | null>(null)

  // Fetch lines for shift assignment
  const { data: lines } = useQuery({
    queryKey: ['cadastros', 'production_lines'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('production_lines') as any)
        .select('id, name, is_active')
        .order('sort_order')
      if (error) throw error
      return data as Pick<ProductionLine, 'id' | 'name' | 'is_active'>[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['cadastros', 'production_shifts'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('production_shifts') as any).select('*').order('start_time')
      if (error) throw error
      return data as ProductionShift[]
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch line-shift assignments
  const { data: lineShifts } = useQuery({
    queryKey: ['cadastros', 'production_line_shifts'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('production_line_shifts') as any).select('*')
      if (error) throw error
      return data as ProductionLineShift[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const upsert = useMutation({
    mutationFn: async (values: ProductionShiftInsert | (ProductionShiftUpdate & { id: string })) => {
      if ('id' in values && values.id) {
        const { id, ...rest } = values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_shifts') as any).update(rest).eq('id', id)
        if (error) throw error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_shifts') as any).insert(values as ProductionShiftInsert)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_shifts'] })
      toast.success('Turno salvo com sucesso')
      closeDialog()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar turno')
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('production_shifts') as any).update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_shifts'] })
      toast.success('Status atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar status')
    },
  })

  const toggleLineShift = useMutation({
    mutationFn: async ({ shiftId, lineId, assigned }: { shiftId: string; lineId: string; assigned: boolean }) => {
      if (assigned) {
        // Remove assignment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_line_shifts') as any)
          .delete()
          .eq('shift_id', shiftId)
          .eq('line_id', lineId)
        if (error) throw error
      } else {
        // Add assignment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_line_shifts') as any)
          .insert({ shift_id: shiftId, line_id: lineId } as ProductionLineShiftInsert)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_line_shifts'] })
      toast.success('Vínculo atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar vínculo')
    },
  })

  function openCreate() { setEditing(null); setDialogOpen(true) }
  function openEdit(row: ProductionShift) { setEditing(row); setDialogOpen(true) }
  function closeDialog() { setDialogOpen(false); setEditing(null) }

  const columns = useMemo(() => [
    tCol.accessor('name', { header: 'Nome' }),
    tCol.accessor('start_time', {
      header: 'Início',
      cell: (info) => info.getValue()?.slice(0, 5) ?? '—',
      size: 90,
    }),
    tCol.accessor('end_time', {
      header: 'Fim',
      cell: (info) => info.getValue()?.slice(0, 5) ?? '—',
      size: 90,
    }),
    tCol.accessor('is_active', {
      header: 'Status',
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          onClick={(e) => {
            e.stopPropagation()
            toggleActive.mutate({ id: info.row.original.id, is_active: !info.getValue() })
          }}
        />
      ),
      size: 90,
    }),
  ], [toggleActive])

  // Helper to check if a line is assigned to a shift
  function isLineAssigned(shiftId: string, lineId: string): boolean {
    return lineShifts?.some((ls) => ls.shift_id === shiftId && ls.line_id === lineId) ?? false
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Turnos de Produção</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={16} /> Novo
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={5} /> : (
        <DataTable data={data ?? []} columns={columns} searchPlaceholder="Buscar turno..." onRowClick={openEdit} />
      )}

      {/* Line-Shift assignment matrix */}
      {data && data.length > 0 && lines && lines.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Linhas por Turno</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">Turno</th>
                  {lines.filter((l) => l.is_active).map((line) => (
                    <th key={line.id} className="px-3 py-2 text-center font-medium">{line.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.filter((s) => s.is_active).map((shift) => (
                  <tr key={shift.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{shift.name}</td>
                    {lines.filter((l) => l.is_active).map((line) => {
                      const assigned = isLineAssigned(shift.id, line.id)
                      return (
                        <td key={line.id} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={assigned}
                            onChange={() => toggleLineShift.mutate({ shiftId: shift.id, lineId: line.id, assigned })}
                            className="rounded border-border"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? 'Editar Turno' : 'Novo Turno'}>
        <TurnoForm
          initial={editing}
          isPending={upsert.isPending}
          error={upsert.error}
          onSubmit={(v) => upsert.mutate(v)}
        />
      </Dialog>
    </div>
  )
}

function TurnoForm({
  initial,
  isPending,
  error,
  onSubmit,
}: {
  initial: ProductionShift | null
  isPending: boolean
  error: Error | null
  onSubmit: (v: ProductionShiftInsert | (ProductionShiftUpdate & { id: string })) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [startTime, setStartTime] = useState(initial?.start_time?.slice(0, 5) ?? '')
  const [endTime, setEndTime] = useState(initial?.end_time?.slice(0, 5) ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const values = {
      name: name.trim(),
      start_time: startTime,
      end_time: endTime,
      is_active: isActive,
    }
    if (initial) {
      onSubmit({ id: initial.id, ...values })
    } else {
      onSubmit(values)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.message || 'Erro ao salvar'}
        </div>
      )}

      <Field label="Nome *">
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Início *">
          <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Fim *">
          <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border" />
        Ativo
      </label>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Motivos de Parada Tab
// ═══════════════════════════════════════════════════════════════════════════════

const rCol = createColumnHelper<StopReason>()

function ParadasTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StopReason | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cadastros', 'production_stop_reasons'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('production_stop_reasons') as any).select('*').order('name')
      if (error) throw error
      return data as StopReason[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const upsert = useMutation({
    mutationFn: async (values: StopReasonInsert | (StopReasonUpdate & { id: string })) => {
      if ('id' in values && values.id) {
        const { id, ...rest } = values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_stop_reasons') as any).update(rest).eq('id', id)
        if (error) throw error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_stop_reasons') as any).insert(values as StopReasonInsert)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_stop_reasons'] })
      toast.success('Motivo de parada salvo com sucesso')
      closeDialog()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar motivo de parada')
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('production_stop_reasons') as any).update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_stop_reasons'] })
      toast.success('Status atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar status')
    },
  })

  function openCreate() { setEditing(null); setDialogOpen(true) }
  function openEdit(row: StopReason) { setEditing(row); setDialogOpen(true) }
  function closeDialog() { setDialogOpen(false); setEditing(null) }

  const CATEGORY_COLORS: Record<string, { color: string; bgColor: string }> = {
    mecanica:  { color: 'text-red-700',    bgColor: 'bg-red-100' },
    eletrica:  { color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
    falta_mp:  { color: 'text-orange-700', bgColor: 'bg-orange-100' },
    setup:     { color: 'text-blue-700',   bgColor: 'bg-blue-100' },
    limpeza:   { color: 'text-cyan-700',   bgColor: 'bg-cyan-100' },
    qualidade: { color: 'text-purple-700', bgColor: 'bg-purple-100' },
    outros:    { color: 'text-gray-700',   bgColor: 'bg-gray-100' },
  }

  const columns = useMemo(() => [
    rCol.accessor('name', { header: 'Nome' }),
    rCol.accessor('category', {
      header: 'Categoria',
      cell: (info) => {
        const cat = info.getValue() as StopCategory
        const label = STOP_CATEGORY_LABELS[cat] ?? cat
        const colors = CATEGORY_COLORS[cat]
        return (
          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', colors?.bgColor ?? 'bg-gray-100', colors?.color ?? 'text-gray-700')}>
            {label}
          </span>
        )
      },
    }),
    rCol.accessor('is_active', {
      header: 'Status',
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          onClick={(e) => {
            e.stopPropagation()
            toggleActive.mutate({ id: info.row.original.id, is_active: !info.getValue() })
          }}
        />
      ),
      size: 90,
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [toggleActive])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Motivos de Parada</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={16} /> Novo
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={5} /> : (
        <DataTable data={data ?? []} columns={columns} searchPlaceholder="Buscar motivo..." onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? 'Editar Motivo de Parada' : 'Novo Motivo de Parada'}>
        <ParadaForm
          initial={editing}
          isPending={upsert.isPending}
          error={upsert.error}
          onSubmit={(v) => upsert.mutate(v)}
        />
      </Dialog>
    </div>
  )
}

function ParadaForm({
  initial,
  isPending,
  error,
  onSubmit,
}: {
  initial: StopReason | null
  isPending: boolean
  error: Error | null
  onSubmit: (v: StopReasonInsert | (StopReasonUpdate & { id: string })) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'outros')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const values = {
      name: name.trim(),
      category,
      is_active: isActive,
    }
    if (initial) {
      onSubmit({ id: initial.id, ...values })
    } else {
      onSubmit(values)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.message || 'Erro ao salvar'}
        </div>
      )}

      <Field label="Nome *">
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Categoria *">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          {STOP_CATEGORIES.map((c) => (
            <option key={c} value={c}>{STOP_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border" />
        Ativo
      </label>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Equipes Tab
// ═══════════════════════════════════════════════════════════════════════════════

const eCol = createColumnHelper<ProductionTeam>()

function EquipesTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductionTeam | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cadastros', 'production_teams'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('production_teams') as any).select('*').order('name')
      if (error) throw error
      return data as ProductionTeam[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const upsert = useMutation({
    mutationFn: async (values: ProductionTeamInsert | (ProductionTeamUpdate & { id: string })) => {
      if ('id' in values && values.id) {
        const { id, ...rest } = values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_teams') as any).update(rest).eq('id', id)
        if (error) throw error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('production_teams') as any).insert(values as ProductionTeamInsert)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_teams'] })
      toast.success('Equipe salva com sucesso')
      closeDialog()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar equipe')
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('production_teams') as any).update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'production_teams'] })
      toast.success('Status atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar status')
    },
  })

  function openCreate() { setEditing(null); setDialogOpen(true) }
  function openEdit(row: ProductionTeam) { setEditing(row); setDialogOpen(true) }
  function closeDialog() { setDialogOpen(false); setEditing(null) }

  const ROLE_COLORS: Record<string, { color: string; bgColor: string }> = {
    lider:    { color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
    operador: { color: 'text-blue-700',   bgColor: 'bg-blue-100' },
    auxiliar: { color: 'text-teal-700',   bgColor: 'bg-teal-100' },
  }

  const columns = useMemo(() => [
    eCol.accessor('name', { header: 'Nome' }),
    eCol.accessor('role', {
      header: 'Função',
      cell: (info) => {
        const role = info.getValue() as TeamRole
        const label = TEAM_ROLE_LABELS[role] ?? role
        const colors = ROLE_COLORS[role]
        return (
          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', colors?.bgColor ?? 'bg-gray-100', colors?.color ?? 'text-gray-700')}>
            {label}
          </span>
        )
      },
    }),
    eCol.accessor('is_active', {
      header: 'Status',
      cell: (info) => (
        <ActiveBadge
          active={info.getValue()}
          onClick={(e) => {
            e.stopPropagation()
            toggleActive.mutate({ id: info.row.original.id, is_active: !info.getValue() })
          }}
        />
      ),
      size: 90,
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [toggleActive])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Equipes de Produção</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={16} /> Nova
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={5} /> : (
        <DataTable data={data ?? []} columns={columns} searchPlaceholder="Buscar equipe..." onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? 'Editar Equipe' : 'Nova Equipe'}>
        <EquipeForm
          initial={editing}
          isPending={upsert.isPending}
          error={upsert.error}
          onSubmit={(v) => upsert.mutate(v)}
        />
      </Dialog>
    </div>
  )
}

function EquipeForm({
  initial,
  isPending,
  error,
  onSubmit,
}: {
  initial: ProductionTeam | null
  isPending: boolean
  error: Error | null
  onSubmit: (v: ProductionTeamInsert | (ProductionTeamUpdate & { id: string })) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? 'operador')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const values = {
      name: name.trim(),
      role,
      is_active: isActive,
    }
    if (initial) {
      onSubmit({ id: initial.id, ...values })
    } else {
      onSubmit(values)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.message || 'Erro ao salvar'}
        </div>
      )}

      <Field label="Nome *">
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Função *">
        <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
          {(Object.entries(TEAM_ROLE_LABELS) as [TeamRole, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border" />
        Ativo
      </label>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
