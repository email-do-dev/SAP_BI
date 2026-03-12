import { cn } from '@/lib/utils'
import { Clock, AlertTriangle } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'

interface FreeTimeBadgeProps {
  arrivalDate: string | null
  freeTimeDays: number
  className?: string
}

export function FreeTimeBadge({ arrivalDate, freeTimeDays, className }: FreeTimeBadgeProps) {
  if (!arrivalDate) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600', className)}>
        <Clock size={12} />
        Sem data
      </span>
    )
  }

  const arrival = parseISO(arrivalDate)
  const freeTimeEnd = new Date(arrival)
  freeTimeEnd.setDate(freeTimeEnd.getDate() + freeTimeDays)
  const today = new Date()
  const remaining = differenceInDays(freeTimeEnd, today)

  if (remaining < 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800', className)}>
        <AlertTriangle size={12} />
        {Math.abs(remaining)}d demurrage
      </span>
    )
  }

  if (remaining <= 5) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800', className)}>
        <Clock size={12} />
        {remaining}d restantes
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800', className)}>
      <Clock size={12} />
      {remaining}d restantes
    </span>
  )
}

