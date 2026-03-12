import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { WeeklySkuRow } from '@/hooks/use-weekly-sku-totals'

interface SkuWeeklyTableProps {
  data: WeeklySkuRow[]
  isLoading: boolean
  weekStart: Date
  weekEnd: Date
}

// Monday-first order
const DAY_KEYS: (keyof WeeklySkuRow)[] = ['qty_seg', 'qty_ter', 'qty_qua', 'qty_qui', 'qty_sex', 'qty_sab', 'qty_dom']
const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
// Map JS getDay() (0=Sun) to our Monday-first index
const DOW_TO_INDEX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }

const GROUP_ORDER = ['SARDINHA 125g', 'ATUM 140g', 'ATUM 400g', 'OUTROS']
const GROUP_COLORS: Record<string, string> = {
  'SARDINHA 125g': 'bg-blue-50 text-blue-800',
  'ATUM 140g': 'bg-amber-50 text-amber-800',
  'ATUM 400g': 'bg-emerald-50 text-emerald-800',
  'OUTROS': 'bg-gray-50 text-gray-700',
}

interface GroupData {
  grupo: string
  rows: WeeklySkuRow[]
  totals: Record<string, number>
}

function sumDays(rows: WeeklySkuRow[]): Record<string, number> {
  const t: Record<string, number> = { qty_dom: 0, qty_seg: 0, qty_ter: 0, qty_qua: 0, qty_qui: 0, qty_sex: 0, qty_sab: 0, total_semana: 0 }
  for (const row of rows) {
    t.qty_dom += row.qty_dom
    t.qty_seg += row.qty_seg
    t.qty_ter += row.qty_ter
    t.qty_qua += row.qty_qua
    t.qty_qui += row.qty_qui
    t.qty_sex += row.qty_sex
    t.qty_sab += row.qty_sab
    t.total_semana += row.total_semana
  }
  return t
}

function formatQty(v: number): string {
  if (v === 0) return '-'
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export function SkuWeeklyTable({ data, isLoading, weekStart, weekEnd }: SkuWeeklyTableProps) {
  const [collapsed, setCollapsed] = useState(false)
  const todayIdx = DOW_TO_INDEX[new Date().getDay()]

  const groups = useMemo<GroupData[]>(() => {
    const map = new Map<string, WeeklySkuRow[]>()
    for (const row of data) {
      const g = row.grupo_expedicao || 'OUTROS'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(row)
    }
    return GROUP_ORDER
      .filter((g) => map.has(g))
      .map((g) => ({
        grupo: g,
        rows: map.get(g)!,
        totals: sumDays(map.get(g)!),
      }))
  }, [data])

  const grandTotals = useMemo(() => sumDays(data), [data])

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
      >
        <h3 className="text-sm font-semibold">
          Saída por SKU — Semana {format(weekStart, 'dd/MM')} a {format(weekEnd, 'dd/MM')}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{data.length} SKUs</span>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : data.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma carga programada para esta semana
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr className="text-left font-medium text-muted-foreground">
                    <th className="px-3 py-2">SKU</th>
                    <th className="max-w-[200px] px-3 py-2">Descrição</th>
                    {DAY_LABELS.map((label, i) => (
                      <th
                        key={label}
                        className={cn(
                          'px-3 py-2 text-right',
                          i === todayIdx && 'bg-blue-50 text-blue-700'
                        )}
                      >
                        {label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <GroupSection key={group.grupo} group={group} todayIdx={todayIdx} />
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/50">
                  <tr className="text-xs font-bold">
                    <td className="px-3 py-2" colSpan={2}>Total Geral</td>
                    {DAY_KEYS.map((key, i) => (
                      <td
                        key={key}
                        className={cn(
                          'px-3 py-2 text-right',
                          i === todayIdx && 'bg-blue-100 text-blue-700'
                        )}
                      >
                        {formatQty(grandTotals[key])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      {formatQty(grandTotals.total_semana)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GroupSection({ group, todayIdx }: { group: GroupData; todayIdx: number }) {
  const colorClass = GROUP_COLORS[group.grupo] || GROUP_COLORS['OUTROS']

  return (
    <>
      {/* Group header */}
      <tr className="border-t border-border">
        <td colSpan={10} className={cn('px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide', colorClass)}>
          {group.grupo}
          <span className="ml-2 font-normal normal-case tracking-normal opacity-70">
            ({group.rows.length} {group.rows.length === 1 ? 'item' : 'itens'})
          </span>
        </td>
      </tr>
      {/* Item rows */}
      {group.rows.map((row) => (
        <tr key={row.item_code} className="hover:bg-muted/30">
          <td className="whitespace-nowrap px-3 py-1.5 pl-5 font-medium">{row.item_code}</td>
          <td className="max-w-[200px] truncate px-3 py-1.5" title={row.descricao}>
            {row.descricao}
          </td>
          {DAY_KEYS.map((key, i) => (
            <td
              key={key}
              className={cn(
                'px-3 py-1.5 text-right',
                i === todayIdx && 'bg-blue-50 font-medium text-blue-700'
              )}
            >
              {formatQty(row[key] as number)}
            </td>
          ))}
          <td className="px-3 py-1.5 text-right font-semibold">
            {formatQty(row.total_semana)}
          </td>
        </tr>
      ))}
      {/* Group subtotal */}
      <tr className={cn('border-b border-border', colorClass, 'bg-opacity-50')}>
        <td className="px-3 py-1.5 pl-5 font-semibold italic" colSpan={2}>
          Subtotal {group.grupo}
        </td>
        {DAY_KEYS.map((key, i) => (
          <td
            key={key}
            className={cn(
              'px-3 py-1.5 text-right font-semibold',
              i === todayIdx && 'bg-blue-100 text-blue-700'
            )}
          >
            {formatQty(group.totals[key])}
          </td>
        ))}
        <td className="px-3 py-1.5 text-right font-bold">
          {formatQty(group.totals.total_semana)}
        </td>
      </tr>
    </>
  )
}
