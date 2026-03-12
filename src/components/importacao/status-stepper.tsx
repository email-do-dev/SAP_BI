import { cn } from '@/lib/utils'
import { IMPORT_STATUSES, STATUS_INDEX, type ImportProcessStatus } from '@/lib/import-constants'
import { Check } from 'lucide-react'

interface StatusStepperProps {
  currentStatus: ImportProcessStatus
  className?: string
}

export function StatusStepper({ currentStatus, className }: StatusStepperProps) {
  const currentIdx = STATUS_INDEX[currentStatus]

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="flex items-center gap-0 min-w-max px-1 py-3">
        {IMPORT_STATUSES.map((step, idx) => {
          const Icon = step.icon
          const isPast = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isFuture = idx > currentIdx

          return (
            <div key={step.value} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                    isPast && 'border-green-500 bg-green-500 text-white',
                    isCurrent && 'border-primary bg-primary text-white animate-pulse',
                    isFuture && 'border-border bg-muted text-muted-foreground'
                  )}
                >
                  {isPast ? <Check size={14} /> : <Icon size={14} />}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium text-center max-w-[70px] leading-tight',
                    isPast && 'text-green-700',
                    isCurrent && 'text-primary font-semibold',
                    isFuture && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < IMPORT_STATUSES.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-6 mx-1 mt-[-18px]',
                    idx < currentIdx ? 'bg-green-500' : 'bg-border'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
