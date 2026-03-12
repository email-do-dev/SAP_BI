import { cn } from '@/lib/utils'

interface CapacityGaugeProps {
  current: number
  max: number
  label: string
  unit: string
  color?: string
}

export function CapacityGauge({ current, max, label, unit }: CapacityGaugeProps) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const rounded = Math.round(pct)

  const barColor =
    pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'
  const textColor =
    pct > 90 ? 'text-red-600' : pct > 70 ? 'text-amber-600' : 'text-green-600'

  const formatValue = (v: number) =>
    label === 'Paletes'
      ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : v.toLocaleString('pt-BR')

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className={cn('font-semibold', textColor)}>
          {formatValue(current)} / {formatValue(max)} {unit} ({rounded}%)
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
