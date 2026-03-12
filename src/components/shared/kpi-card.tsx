import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface KpiCardProps {
  title: string
  value: string
  description?: string
  icon?: ReactNode
  trend?: { value: number; label: string }
  goal?: { current: number; target: number; label?: string }
  sparklineData?: number[]
  className?: string
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 80
  const h = 24
  const padding = 2
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2)
    const y = h - padding - ((v - min) / range) * (h - padding * 2)
    return `${x},${y}`
  }).join(' ')
  const isPositive = data[data.length - 1] >= data[0]
  return (
    <svg width={w} height={h} className="mt-1">
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function KpiCard({ title, value, description, icon, trend, goal, sparklineData, className }: KpiCardProps) {
  const pct = goal ? Math.min((goal.current / goal.target) * 100, 100) : 0

  return (
    <div className={cn('rounded-lg border border-border bg-card p-6 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="flex items-end justify-between">
        <p className="mt-2 text-2xl font-bold text-card-foreground">{value}</p>
        {sparklineData && sparklineData.length >= 2 && <Sparkline data={sparklineData} />}
      </div>
      {trend && (
        <p className={cn('mt-1 text-xs', trend.value >= 0 ? 'text-green-600' : 'text-destructive')}>
          {trend.value >= 0 ? '▲ +' : '▼ '}{trend.value}% {trend.label}
        </p>
      )}
      {goal && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={cn('h-1.5 rounded-full transition-all', pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-primary' : 'bg-amber-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{goal.label ?? `${pct.toFixed(0)}% da meta`}</p>
        </div>
      )}
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}
