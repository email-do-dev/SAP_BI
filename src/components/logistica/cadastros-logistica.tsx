import { useState, useMemo, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus, X, Info } from 'lucide-react'
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
import { VEHICLE_TYPE_CONFIG, LICENSE_TYPES, type VehicleType } from '@/lib/logistics-constants'
import type { Database } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

type Vehicle = Database['public']['Tables']['vehicles']['Row']
type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update']

type Driver = Database['public']['Tables']['drivers']['Row']
type DriverInsert = Database['public']['Tables']['drivers']['Insert']
type DriverUpdate = Database['public']['Tables']['drivers']['Update']

type Operator = Database['public']['Tables']['logistics_operators']['Row']
type OperatorInsert = Database['public']['Tables']['logistics_operators']['Insert']
type OperatorUpdate = Database['public']['Tables']['logistics_operators']['Update']

type CacheItemPackaging = Database['public']['Tables']['sap_cache_item_packaging']['Row']

type VehicleWithOperator = Vehicle & { operator_name?: string }

// ─── Constants ───────────────────────────────────────────────────────────────

type CadastroTab = 'veiculos' | 'motoristas' | 'operadores' | 'paletizacao'

const TABS: { id: CadastroTab; label: string }[] = [
  { id: 'veiculos', label: 'Veículos' },
  { id: 'motoristas', label: 'Motoristas' },
  { id: 'operadores', label: 'Operadores Logísticos' },
  { id: 'paletizacao', label: 'Paletização de Itens' },
]

const OWNERSHIP_LABELS: Record<string, string> = {
  own: 'Próprio',
  spot: 'Spot/Terceiro',
}

const OWNERSHIP_OPTIONS = [
  { value: 'own' as const, label: 'Próprio' },
  { value: 'spot' as const, label: 'Spot/Terceiro' },
]

const REGIONS = ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

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

export function CadastrosLogistica() {
  const [activeTab, setActiveTab] = useState<CadastroTab>('veiculos')

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

      {activeTab === 'veiculos' && <VeiculosTab />}
      {activeTab === 'motoristas' && <MotoristasTab />}
      {activeTab === 'operadores' && <OperadoresTab />}
      {activeTab === 'paletizacao' && <PaletizacaoTab />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Veículos Tab
// ═══════════════════════════════════════════════════════════════════════════════

const vCol = createColumnHelper<VehicleWithOperator>()

function VeiculosTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleWithOperator | null>(null)

  // Fetch operators for the lookup and form dropdown
  const { data: operators } = useQuery({
    queryKey: ['cadastros', 'logistics_operators'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('logistics_operators') as any)
        .select('id, name, is_active')
        .order('name')
      if (error) throw error
      return data as Pick<Operator, 'id' | 'name' | 'is_active'>[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const operatorMap = useMemo(() => {
    const map = new Map<string, string>()
    operators?.forEach((op) => map.set(op.id, op.name))
    return map
  }, [operators])

  const { data, isLoading } = useQuery({
    queryKey: ['cadastros', 'vehicles'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('vehicles') as any)
        .select('*')
        .order('plate')
      if (error) throw error
      return data as Vehicle[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const vehiclesWithOperator = useMemo<VehicleWithOperator[]>(() => {
    return (data ?? []).map((v) => ({
      ...v,
      operator_name: v.operator_id ? operatorMap.get(v.operator_id) ?? '—' : undefined,
    }))
  }, [data, operatorMap])

  const upsert = useMutation({
    mutationFn: async (values: VehicleInsert | (VehicleUpdate & { id: string })) => {
      if ('id' in values && values.id) {
        const { id, ...rest } = values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('vehicles') as any).update(rest).eq('id', id)
        if (error) throw error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('vehicles') as any).insert(values as VehicleInsert)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'vehicles'] })
      toast.success('Veículo salvo com sucesso')
      closeDialog()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar veículo')
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('vehicles') as any).update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'vehicles'] })
      toast.success('Status atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar status')
    },
  })

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(row: VehicleWithOperator) {
    setEditing(row)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
  }

  const columns = useMemo(() => [
    vCol.accessor('plate', { header: 'Placa', size: 100 }),
    vCol.accessor('vehicle_type', {
      header: 'Tipo',
      cell: (info) => VEHICLE_TYPE_CONFIG[info.getValue() as VehicleType]?.label ?? info.getValue(),
    }),
    vCol.accessor('ownership', {
      header: 'Propriedade',
      cell: (info) => OWNERSHIP_LABELS[info.getValue()] ?? info.getValue(),
    }),
    vCol.accessor('operator_name', {
      header: 'Operador',
      cell: (info) => info.getValue() ?? '—',
    }),
    vCol.accessor('max_weight_kg', {
      header: 'Peso Máx (kg)',
      cell: (info) => info.getValue()?.toLocaleString('pt-BR') ?? '—',
    }),
    vCol.accessor('max_pallets', {
      header: 'Pallets Máx',
      cell: (info) => info.getValue() ?? '—',
    }),
    vCol.accessor('is_active', {
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
        <h2 className="text-lg font-semibold">Veículos</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={16} /> Novo
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={5} /> : (
        <DataTable data={vehiclesWithOperator} columns={columns} searchPlaceholder="Buscar placa..." onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? 'Editar Veículo' : 'Novo Veículo'}>
        <VeiculoForm
          initial={editing}
          operators={operators?.filter((o) => o.is_active) ?? []}
          isPending={upsert.isPending}
          error={upsert.error}
          onSubmit={(v) => upsert.mutate(v)}
        />
      </Dialog>
    </div>
  )
}

function VeiculoForm({
  initial,
  operators,
  isPending,
  error,
  onSubmit,
}: {
  initial: VehicleWithOperator | null
  operators: Pick<Operator, 'id' | 'name' | 'is_active'>[]
  isPending: boolean
  error: Error | null
  onSubmit: (v: VehicleInsert | (VehicleUpdate & { id: string })) => void
}) {
  const [plate, setPlate] = useState(initial?.plate ?? '')
  const [vehicleType, setVehicleType] = useState(initial?.vehicle_type ?? 'carreta')
  const [ownership, setOwnership] = useState<'own' | 'spot'>(initial?.ownership ?? 'own')
  const [operatorId, setOperatorId] = useState(initial?.operator_id ?? '')
  const [maxWeight, setMaxWeight] = useState(initial?.max_weight_kg?.toString() ?? '')
  const [maxPallets, setMaxPallets] = useState(initial?.max_pallets?.toString() ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const values = {
      plate: plate.toUpperCase().trim(),
      vehicle_type: vehicleType,
      ownership,
      operator_id: operatorId || null,
      max_weight_kg: maxWeight ? Number(maxWeight) : null,
      max_volume_m3: null,
      max_pallets: maxPallets ? Number(maxPallets) : null,
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Placa *">
          <input
            type="text"
            required
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="ABC1D23"
          />
        </Field>
        <Field label="Tipo">
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputClass}>
            {Object.entries(VEHICLE_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Propriedade">
          <select value={ownership} onChange={(e) => setOwnership(e.target.value as 'own' | 'spot')} className={inputClass}>
            {OWNERSHIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Operador Logístico">
          <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)} className={inputClass}>
            <option value="">Nenhum</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Peso Máximo (kg)">
          <input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} className={inputClass} min={0} />
        </Field>
        <Field label="Pallets Máximo">
          <input type="number" value={maxPallets} onChange={(e) => setMaxPallets(e.target.value)} className={inputClass} min={0} />
        </Field>
      </div>

      <Field label="Descrição">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
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
// Motoristas Tab
// ═══════════════════════════════════════════════════════════════════════════════

const dCol = createColumnHelper<Driver>()

function MotoristasTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Driver | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cadastros', 'drivers'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('drivers') as any).select('*').order('name')
      if (error) throw error
      return data as Driver[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const upsert = useMutation({
    mutationFn: async (values: DriverInsert | (DriverUpdate & { id: string })) => {
      if ('id' in values && values.id) {
        const { id, ...rest } = values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('drivers') as any).update(rest).eq('id', id)
        if (error) throw error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('drivers') as any).insert(values as DriverInsert)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'drivers'] })
      toast.success('Motorista salvo com sucesso')
      closeDialog()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar motorista')
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('drivers') as any).update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'drivers'] })
      toast.success('Status atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar status')
    },
  })

  function openCreate() { setEditing(null); setDialogOpen(true) }
  function openEdit(row: Driver) { setEditing(row); setDialogOpen(true) }
  function closeDialog() { setDialogOpen(false); setEditing(null) }

  const columns = useMemo(() => [
    dCol.accessor('name', { header: 'Nome' }),
    dCol.accessor('cpf', { header: 'CPF', cell: (info) => info.getValue() ? formatCpf(info.getValue()!) : '—', size: 140 }),
    dCol.accessor('phone', { header: 'Telefone', cell: (info) => info.getValue() ?? '—', size: 130 }),
    dCol.accessor('license_type', { header: 'CNH', cell: (info) => info.getValue() ?? '—', size: 60 }),
    dCol.accessor('is_active', {
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
        <h2 className="text-lg font-semibold">Motoristas</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={16} /> Novo
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={5} /> : (
        <DataTable data={data ?? []} columns={columns} searchPlaceholder="Buscar motorista..." onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? 'Editar Motorista' : 'Novo Motorista'}>
        <MotoristaForm
          initial={editing}
          isPending={upsert.isPending}
          error={upsert.error}
          onSubmit={(v) => upsert.mutate(v)}
        />
      </Dialog>
    </div>
  )
}

function MotoristaForm({
  initial,
  isPending,
  error,
  onSubmit,
}: {
  initial: Driver | null
  isPending: boolean
  error: Error | null
  onSubmit: (v: DriverInsert | (DriverUpdate & { id: string })) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [cpf, setCpf] = useState(initial?.cpf ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [licenseType, setLicenseType] = useState(initial?.license_type ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const values = {
      name: name.trim(),
      cpf: cpf ? cpf.replace(/\D/g, '') : null,
      phone: phone || null,
      license_type: licenseType || null,
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
        <Field label="CPF">
          <input
            type="text"
            value={formatCpf(cpf)}
            onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
            className={inputClass}
            placeholder="000.000.000-00"
            maxLength={14}
          />
        </Field>
        <Field label="Telefone">
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
        </Field>
      </div>

      <Field label="Tipo de CNH">
        <select value={licenseType} onChange={(e) => setLicenseType(e.target.value)} className={inputClass}>
          <option value="">Selecione...</option>
          {LICENSE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
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
// Operadores Logísticos Tab
// ═══════════════════════════════════════════════════════════════════════════════

const oCol = createColumnHelper<Operator>()

function OperadoresTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Operator | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cadastros', 'logistics_operators'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('logistics_operators') as any).select('*').order('name')
      if (error) throw error
      return data as Operator[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const upsert = useMutation({
    mutationFn: async (values: OperatorInsert | (OperatorUpdate & { id: string })) => {
      if ('id' in values && values.id) {
        const { id, ...rest } = values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('logistics_operators') as any).update(rest).eq('id', id)
        if (error) throw error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('logistics_operators') as any).insert(values as OperatorInsert)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'logistics_operators'] })
      toast.success('Operador salvo com sucesso')
      closeDialog()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar operador')
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('logistics_operators') as any).update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadastros', 'logistics_operators'] })
      toast.success('Status atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar status')
    },
  })

  function openCreate() { setEditing(null); setDialogOpen(true) }
  function openEdit(row: Operator) { setEditing(row); setDialogOpen(true) }
  function closeDialog() { setDialogOpen(false); setEditing(null) }

  const columns = useMemo(() => [
    oCol.accessor('name', { header: 'Nome' }),
    oCol.accessor('cnpj', { header: 'CNPJ', cell: (info) => info.getValue() ?? '—', size: 160 }),
    oCol.accessor('contact_name', { header: 'Contato', cell: (info) => info.getValue() ?? '—' }),
    oCol.accessor('regions', {
      header: 'Regiões',
      cell: (info) => {
        const regions = info.getValue()
        if (!regions || regions.length === 0) return '—'
        return (
          <div className="flex flex-wrap gap-1">
            {regions.map((r) => (
              <span key={r} className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                {r}
              </span>
            ))}
          </div>
        )
      },
    }),
    oCol.accessor('is_active', {
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
        <h2 className="text-lg font-semibold">Operadores Logísticos</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={16} /> Novo
        </button>
      </div>

      {isLoading ? <TableSkeleton rows={5} /> : (
        <DataTable data={data ?? []} columns={columns} searchPlaceholder="Buscar operador..." onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? 'Editar Operador' : 'Novo Operador'}>
        <OperadorForm
          initial={editing}
          isPending={upsert.isPending}
          error={upsert.error}
          onSubmit={(v) => upsert.mutate(v)}
        />
      </Dialog>
    </div>
  )
}

function OperadorForm({
  initial,
  isPending,
  error,
  onSubmit,
}: {
  initial: Operator | null
  isPending: boolean
  error: Error | null
  onSubmit: (v: OperatorInsert | (OperatorUpdate & { id: string })) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [cnpj, setCnpj] = useState(initial?.cnpj ?? '')
  const [contactName, setContactName] = useState(initial?.contact_name ?? '')
  const [contactPhone, setContactPhone] = useState(initial?.contact_phone ?? '')
  const [regions, setRegions] = useState<string[]>(initial?.regions ?? [])
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  function toggleRegion(r: string) {
    setRegions((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const values = {
      name: name.trim(),
      cnpj: cnpj || null,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      regions,
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

      <Field label="CNPJ">
        <input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className={inputClass} placeholder="00.000.000/0000-00" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome do Contato">
          <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Telefone do Contato">
          <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
        </Field>
      </div>

      <Field label="Regiões de Atuação">
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRegion(r)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                regions.includes(r)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {r}
              {regions.includes(r) && <X size={12} className="ml-1 inline" />}
            </button>
          ))}
        </div>
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
// Paletização de Itens Tab (read-only, from SAP OITM cache)
// ═══════════════════════════════════════════════════════════════════════════════

const pCol = createColumnHelper<CacheItemPackaging>()

function PaletizacaoTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['cadastros', 'sap_cache_item_packaging'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('sap_cache_item_packaging') as any).select('*').order('item_code')
      if (error) throw error
      return data as CacheItemPackaging[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const columns = useMemo(() => [
    pCol.accessor('item_code', { header: 'Código', size: 120 }),
    pCol.accessor('item_name', { header: 'Item' }),
    pCol.accessor('boxes_per_pallet', { header: 'Cx/Pallet', size: 90 }),
    pCol.accessor('box_weight_kg', {
      header: 'Peso Cx (kg)',
      cell: (info) => Number(info.getValue()).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      size: 110,
    }),
    pCol.accessor('pallet_weight_kg', {
      header: 'Peso Pallet (kg)',
      cell: (info) => Number(info.getValue()).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      size: 130,
    }),
  ], [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Paletização de Itens</h2>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
        <Info size={16} className="shrink-0" />
        Dados importados do SAP (OITM) — somente consulta
      </div>

      {isLoading ? <TableSkeleton rows={5} /> : (
        <DataTable data={data ?? []} columns={columns} searchPlaceholder="Buscar item..." />
      )}
    </div>
  )
}
