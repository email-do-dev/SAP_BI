import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Package } from 'lucide-react'
import { DataTable } from '@/components/shared/data-table'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PcpPlan {
  item_code: string
  item_name?: string
  planned_qty: number
}

interface MaterialSummary {
  item_code: string
  item_name: string
  total_qty: number
}

interface PcpMaterialNeedsProps {
  plans: PcpPlan[]
  visible: boolean
}

// ─── Column Helper ───────────────────────────────────────────────────────────

const mCol = createColumnHelper<MaterialSummary>()

const columns = [
  mCol.accessor('item_code', {
    header: 'Item',
    size: 140,
  }),
  mCol.accessor('item_name', {
    header: 'Descrição',
    cell: (info) => info.getValue() || '—',
  }),
  mCol.accessor('total_qty', {
    header: 'Qtd Planejada',
    cell: (info) => info.getValue().toLocaleString('pt-BR'),
    size: 130,
  }),
]

// ─── Component ───────────────────────────────────────────────────────────────

export function PcpMaterialNeeds({ plans, visible }: PcpMaterialNeedsProps) {
  if (!visible) return null

  // Aggregate planned quantities by item_code
  const summary = useMemo<MaterialSummary[]>(() => {
    const map = new Map<string, MaterialSummary>()

    for (const plan of plans) {
      const existing = map.get(plan.item_code)
      if (existing) {
        existing.total_qty += plan.planned_qty
      } else {
        map.set(plan.item_code, {
          item_code: plan.item_code,
          item_name: plan.item_name ?? '',
          total_qty: plan.planned_qty,
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total_qty - a.total_qty)
  }, [plans])

  const totalItems = summary.length
  const totalQty = summary.reduce((acc, s) => acc + s.total_qty, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package size={18} className="text-primary" />
        <h3 className="text-lg font-semibold">Necessidade de Materiais</h3>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">Itens Distintos</p>
          <p className="text-xl font-bold">{totalItems.toLocaleString('pt-BR')}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">Qtd Total Planejada</p>
          <p className="text-xl font-bold">{totalQty.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {summary.length === 0 ? (
        <div className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center'
        )}>
          <Package size={32} className="mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum item planejado para o período selecionado</p>
        </div>
      ) : (
        <DataTable
          data={summary}
          columns={columns}
          searchPlaceholder="Buscar item..."
        />
      )}
    </div>
  )
}
