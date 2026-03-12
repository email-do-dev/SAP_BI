import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { startOfWeek, endOfWeek, addWeeks, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PcpGanttChart } from '@/components/producao/pcp-gantt-chart'
import { PcpDayPlanDialog } from '@/components/producao/pcp-day-plan-dialog'

interface ProductionShift {
  id: string
  name: string
  start_time: string
  end_time: string
}

export function TabPcp() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedShift, setSelectedShift] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogDate, setDialogDate] = useState<Date | null>(null)
  const [dialogLineId, setDialogLineId] = useState<string | null>(null)
  const [dialogLineName, setDialogLineName] = useState('')

  const today = new Date()
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 })

  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  // Buscar planos da semana
  const { data: plans = [] } = useQuery({
    queryKey: ['pcp_daily_plans', weekStartStr, weekEndStr, selectedShift],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from as any)('pcp_daily_plans')
        .select('*')
        .gte('plan_date', weekStartStr)
        .lte('plan_date', weekEndStr)

      if (selectedShift) {
        query = query.eq('shift_id', selectedShift)
      }

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })

  // Buscar linhas de producao
  const { data: lines = [] } = useQuery({
    queryKey: ['production_lines'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('production_lines')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  // Buscar turnos
  const { data: shifts = [] } = useQuery<ProductionShift[]>({
    queryKey: ['production_shifts'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('production_shifts')
        .select('*')
        .order('start_time', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  function handleCellClick(date: Date, lineId: string) {
    const line = lines.find((l: { id: string }) => l.id === lineId)
    setDialogDate(date)
    setDialogLineId(lineId)
    setDialogLineName(line?.name ?? '')
    setDialogOpen(true)
  }

  function handleDialogClose() {
    setDialogOpen(false)
    setDialogDate(null)
    setDialogLineId(null)
    setDialogLineName('')
  }

  return (
    <div className="space-y-4">
      {/* Controles do topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="rounded-lg border border-border p-2 hover:bg-accent"
            title="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[180px] text-center text-sm font-medium">
            Semana de {format(weekStart, 'dd/MM', { locale: ptBR })} a {format(weekEnd, 'dd/MM', { locale: ptBR })}
          </span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="rounded-lg border border-border p-2 hover:bg-accent"
            title="Proxima semana"
          >
            <ChevronRight size={18} />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              Hoje
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Filtro de turno */}
          <select
            value={selectedShift ?? ''}
            onChange={(e) => setSelectedShift(e.target.value || null)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="">Todos os turnos</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg border border-border p-2 hover:bg-accent"
            title={sidebarOpen ? 'Ocultar necessidades' : 'Mostrar necessidades'}
          >
            {sidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>
      </div>

      {/* Conteudo principal */}
      <div className="flex gap-4">
        {/* Gantt */}
        <div className={cn('min-w-0 flex-1', sidebarOpen && 'max-w-[calc(100%-320px)]')}>
          <PcpGanttChart
            plans={plans}
            lines={lines}
            weekStart={weekStart}
            onCellClick={handleCellClick}
          />
        </div>

        {/* Sidebar de necessidades de material */}
        {sidebarOpen && (
          <div className="w-[300px] shrink-0 rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Necessidades de Material</h3>
            {plans.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum plano na semana selecionada.</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  // Agrupar por item
                  const itemMap = new Map<string, { item_name: string; total_qty: number }>()
                  for (const p of plans as Array<{ item_code: string; item_name: string; planned_qty: number; status: string }>) {
                    if (p.status === 'cancelado') continue
                    const existing = itemMap.get(p.item_code)
                    if (existing) {
                      existing.total_qty += p.planned_qty
                    } else {
                      itemMap.set(p.item_code, { item_name: p.item_name, total_qty: p.planned_qty })
                    }
                  }
                  return Array.from(itemMap.entries()).map(([code, info]) => (
                    <div key={code} className="flex items-center justify-between rounded border border-border px-3 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{info.item_name}</p>
                        <p className="text-muted-foreground">{code}</p>
                      </div>
                      <span className="ml-2 font-semibold">{info.total_qty}</span>
                    </div>
                  ))
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog de plano diario */}
      <PcpDayPlanDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        date={dialogDate}
        lineId={dialogLineId}
        lineName={dialogLineName}
        shiftId={selectedShift}
      />
    </div>
  )
}
