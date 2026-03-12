import { isSameDay, addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { PCP_STATUS_CONFIG, type PcpPlanStatus } from '@/lib/production-constants'
import { Plus } from 'lucide-react'

export interface PcpPlan {
  id: string
  plan_date: string
  line_id: string
  shift_id: string | null
  item_code: string
  item_name: string
  planned_qty: number
  actual_qty: number | null
  sequence_order: number
  status: PcpPlanStatus
  sap_wo_doc_entry: number | null
  notes: string | null
}

export interface ProductionLine {
  id: string
  name: string
  line_type: string
  sort_order: number
  is_active: boolean
}

interface PcpGanttChartProps {
  plans: PcpPlan[]
  lines: ProductionLine[]
  weekStart: Date
  onCellClick: (date: Date, lineId: string) => void
}

function getDaysOfWeek(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function PcpGanttChart({ plans, lines, weekStart, onCellClick }: PcpGanttChartProps) {
  const days = getDaysOfWeek(weekStart)
  const today = new Date()

  function getPlansForCell(lineId: string, date: Date): PcpPlan[] {
    return plans
      .filter((p) => p.line_id === lineId && isSameDay(new Date(p.plan_date), date))
      .sort((a, b) => a.sequence_order - b.sequence_order)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <div
        className="grid min-w-[800px]"
        style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
      >
        {/* Cabeçalho: célula vazia + 7 dias */}
        <div className="border-b border-r border-border bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground">
          Linha
        </div>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              'border-b border-r border-border px-2 py-2 text-center text-sm font-medium last:border-r-0',
              isSameDay(day, today) && 'bg-primary/5'
            )}
          >
            <div className="capitalize">{format(day, 'EEE', { locale: ptBR })}</div>
            <div className="text-xs text-muted-foreground">{format(day, 'dd/MM', { locale: ptBR })}</div>
          </div>
        ))}

        {/* Linhas de produção */}
        {lines.map((line) => (
          <>
            {/* Nome da linha */}
            <div
              key={`line-${line.id}`}
              className="flex items-center border-b border-r border-border px-3 py-2 text-sm font-medium last:border-b-0"
            >
              {line.name}
            </div>

            {/* 7 células por linha */}
            {days.map((day) => {
              const cellPlans = getPlansForCell(line.id, day)
              const isToday = isSameDay(day, today)

              return (
                <div
                  key={`${line.id}-${day.toISOString()}`}
                  onClick={() => onCellClick(day, line.id)}
                  className={cn(
                    'group relative min-h-[72px] cursor-pointer border-b border-r border-border p-1 transition-colors last:border-r-0 hover:bg-accent/50',
                    isToday && 'bg-primary/5'
                  )}
                >
                  {cellPlans.length > 0 ? (
                    <div className="space-y-1">
                      {cellPlans.map((plan) => {
                        const statusCfg = PCP_STATUS_CONFIG[plan.status]
                        return (
                          <div
                            key={plan.id}
                            className={cn(
                              'rounded px-1.5 py-1 text-xs leading-tight',
                              statusCfg.bgColor,
                              statusCfg.color
                            )}
                            title={`${plan.item_name} — ${plan.planned_qty} un`}
                          >
                            <div className="truncate font-medium">
                              {plan.item_name.length > 20
                                ? `${plan.item_name.slice(0, 20)}...`
                                : plan.item_name}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>{plan.planned_qty} un</span>
                              <span
                                className={cn(
                                  'inline-block rounded-full px-1 text-[10px] font-medium',
                                  statusCfg.bgColor,
                                  statusCfg.color
                                )}
                              >
                                {statusCfg.label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <Plus size={16} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
              )
            })}
          </>
        ))}

        {/* Sem linhas cadastradas */}
        {lines.length === 0 && (
          <div
            className="col-span-8 py-12 text-center text-sm text-muted-foreground"
          >
            Nenhuma linha de produção cadastrada.
          </div>
        )}
      </div>
    </div>
  )
}
