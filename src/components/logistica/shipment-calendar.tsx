import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, isToday, isSameMonth, addWeeks, subWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn, formatCurrency } from '@/lib/utils'
import { SHIPMENT_STATUS_CONFIG, type ShipmentStatus } from '@/lib/logistics-constants'
import type { ShipmentWithRelations } from './tab-programacao'

interface ShipmentCalendarProps {
  shipments: ShipmentWithRelations[]
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  onSelectShipment: (shipment: ShipmentWithRelations) => void
  currentMonth: Date
  onMonthChange: (date: Date) => void
  calView: 'month' | 'week'
  onCalViewChange: (view: 'month' | 'week') => void
  weekAnchor: Date
  onWeekAnchorChange: (date: Date) => void
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const STATUS_DOT_COLORS: Record<ShipmentStatus, string> = {
  programada: 'bg-blue-500',
  em_expedicao: 'bg-amber-500',
  expedida: 'bg-green-500',
  em_transito: 'bg-orange-500',
  entregue_parcial: 'bg-cyan-500',
  entregue: 'bg-emerald-500',
  finalizada: 'bg-gray-400',
  cancelada: 'bg-red-500',
}

function formatPallets(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function ShipmentCalendar({
  shipments,
  selectedDate,
  onSelectDate,
  currentMonth,
  onMonthChange,
  calView,
  onCalViewChange,
  weekAnchor,
  onWeekAnchorChange,
}: ShipmentCalendarProps) {
  // Build calendar grid days
  const calendarDays = useMemo(() => {
    if (calView === 'week') {
      const wStart = startOfWeek(weekAnchor, { weekStartsOn: 1 })
      const wEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 })
      return eachDayOfInterval({ start: wStart, end: wEnd })
    }
    const mStart = startOfMonth(currentMonth)
    const mEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentMonth, calView, weekAnchor])

  // Group shipments by date string
  const shipmentsByDate = useMemo(() => {
    const map = new Map<string, ShipmentWithRelations[]>()
    for (const s of shipments) {
      const key = s.delivery_date?.slice(0, 10) ?? ''
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(s)
      map.set(key, arr)
    }
    return map
  }, [shipments])

  // Week summary (only in week view)
  const weekSummary = useMemo(() => {
    if (calView !== 'week') return null
    const wStart = startOfWeek(weekAnchor, { weekStartsOn: 1 })
    const wEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 })
    let totalCargas = 0
    let totalWeight = 0
    let totalPallets = 0
    let totalValue = 0
    for (const [dateKey, dayShipments] of shipmentsByDate) {
      const d = new Date(dateKey + 'T12:00:00')
      if (d >= wStart && d <= wEnd) {
        totalCargas += dayShipments.length
        for (const s of dayShipments) {
          totalWeight += s.total_weight_kg ?? 0
          totalPallets += s.total_pallets ?? 0
          totalValue += s.total_value ?? 0
        }
      }
    }
    return { totalCargas, totalWeight, totalPallets, totalValue }
  }, [calView, weekAnchor, shipmentsByDate])

  function prevPeriod() {
    if (calView === 'week') {
      onWeekAnchorChange(subWeeks(weekAnchor, 1))
    } else {
      const d = new Date(currentMonth)
      d.setMonth(d.getMonth() - 1)
      onMonthChange(d)
    }
  }

  function nextPeriod() {
    if (calView === 'week') {
      onWeekAnchorChange(addWeeks(weekAnchor, 1))
    } else {
      const d = new Date(currentMonth)
      d.setMonth(d.getMonth() + 1)
      onMonthChange(d)
    }
  }

  function goToday() {
    onWeekAnchorChange(new Date())
    onSelectDate(new Date())
    if (calView === 'month') {
      onMonthChange(new Date())
    }
  }

  const headerLabel = calView === 'week'
    ? (() => {
        const wStart = startOfWeek(weekAnchor, { weekStartsOn: 1 })
        const wEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 })
        return `${format(wStart, 'dd/MM')} – ${format(wEnd, 'dd/MM/yyyy')}`
      })()
    : format(currentMonth, 'MMMM yyyy', { locale: ptBR })

  return (
    <div>
      {/* Header: view toggle + navigation */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevPeriod}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToday}
            className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Hoje
          </button>
          <h3 className="text-sm font-semibold capitalize min-w-[180px] text-center">
            {headerLabel}
          </h3>
          <button
            onClick={nextPeriod}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          <button
            onClick={() => onCalViewChange('week')}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              calView === 'week' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            Semana
          </button>
          <button
            onClick={() => onCalViewChange('month')}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              calView === 'month' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            Mês
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px bg-border text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-muted/50 py-2">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-border">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const dayShipments = shipmentsByDate.get(dateKey) ?? []
          const inMonth = calView === 'week' || isSameMonth(day, currentMonth)
          const today = isToday(day)
          const selected = selectedDate && isSameDay(day, selectedDate)
          const totalWeight = dayShipments.reduce((s, sh) => s + (sh.total_weight_kg ?? 0), 0)
          const totalValue = dayShipments.reduce((s, sh) => s + (sh.total_value ?? 0), 0)
          const totalPallets = dayShipments.reduce((s, sh) => s + (sh.total_pallets ?? 0), 0)
          const minH = calView === 'week' ? 'min-h-[120px]' : 'min-h-[80px]'

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                minH, 'bg-card p-1.5 text-left transition-colors hover:bg-muted/50',
                !inMonth && 'bg-muted/20 text-muted-foreground/40',
                selected && 'ring-2 ring-primary ring-inset',
                today && !selected && 'ring-1 ring-blue-400 ring-inset'
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  today && 'bg-primary text-white'
                )}
              >
                {format(day, 'd')}
              </span>

              {dayShipments.length > 0 && inMonth && (
                <div className="mt-0.5 space-y-0.5">
                  {/* Shipment pills (up to 3, then +N) */}
                  {calView === 'week' && dayShipments.slice(0, 3).map((sh) => {
                    const cfg = SHIPMENT_STATUS_CONFIG[sh.status as ShipmentStatus] ?? SHIPMENT_STATUS_CONFIG.programada
                    const plate = (sh as ShipmentWithRelations).vehicle?.plate ?? ''
                    return (
                      <div
                        key={sh.id}
                        className={cn('flex items-center gap-1 rounded px-1 py-0.5 text-[9px] leading-tight', cfg.bgColor, cfg.color)}
                        title={`${sh.reference} - ${cfg.label}`}
                      >
                        <span className="font-semibold">{sh.reference}</span>
                        {plate && <span className="opacity-70">{plate}</span>}
                      </div>
                    )
                  })}
                  {calView === 'week' && dayShipments.length > 3 && (
                    <div className="text-[9px] text-muted-foreground pl-1">
                      +{dayShipments.length - 3} mais
                    </div>
                  )}

                  {/* Month view: compact summary */}
                  {calView === 'month' && (
                    <>
                      <div className="text-[10px] font-semibold text-foreground">
                        {dayShipments.length} carga{dayShipments.length !== 1 ? 's' : ''}
                      </div>
                      <div className="flex gap-0.5">
                        {[...new Set(dayShipments.map((s) => s.status as ShipmentStatus))].slice(0, 4).map((st) => (
                          <span
                            key={st}
                            className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_COLORS[st] ?? 'bg-gray-300')}
                            title={SHIPMENT_STATUS_CONFIG[st]?.label ?? st}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Weight + value summary */}
                  {totalWeight > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      {(totalWeight / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}t
                      {calView === 'week' && totalPallets > 0 && ` | ${formatPallets(totalPallets)} plt`}
                      {calView === 'week' && totalValue > 0 && (
                        <span className="ml-1">
                          | {totalValue >= 1000 ? `R$ ${(totalValue / 1000).toFixed(0)}k` : formatCurrency(totalValue)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Week summary bar */}
      {weekSummary && weekSummary.totalCargas > 0 && (
        <div className="mt-2 flex items-center gap-4 rounded-lg bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{weekSummary.totalCargas}</strong> carga{weekSummary.totalCargas !== 1 ? 's' : ''}</span>
          <span><strong className="text-foreground">{(weekSummary.totalWeight / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}t</strong> peso</span>
          <span><strong className="text-foreground">{formatPallets(weekSummary.totalPallets)}</strong> pallets</span>
          <span><strong className="text-foreground">{formatCurrency(weekSummary.totalValue)}</strong></span>
        </div>
      )}
    </div>
  )
}
