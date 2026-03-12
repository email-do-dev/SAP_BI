import { startOfDay, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, format } from 'date-fns'

interface DateRange {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const today = () => format(new Date(), 'yyyy-MM-dd')

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: 'Hoje', range: () => ({ from: today(), to: today() }) },
  { label: 'Últimos 7d', range: () => ({ from: format(subDays(startOfDay(new Date()), 6), 'yyyy-MM-dd'), to: today() }) },
  { label: 'Últimos 30d', range: () => ({ from: format(subDays(startOfDay(new Date()), 29), 'yyyy-MM-dd'), to: today() }) },
  { label: 'Este mês', range: () => ({ from: format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: today() }) },
  { label: 'Mês passado', range: () => ({ from: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), to: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') }) },
  { label: 'Últimos 3m', range: () => ({ from: format(subMonths(startOfDay(new Date()), 3), 'yyyy-MM-dd'), to: today() }) },
  { label: 'YTD', range: () => ({ from: format(startOfYear(new Date()), 'yyyy-MM-dd'), to: today() }) },
]

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <span className="text-sm text-muted-foreground">até</span>
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.range())}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
        {(value.from || value.to) && (
          <button
            onClick={() => onChange({ from: '', to: '' })}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}
