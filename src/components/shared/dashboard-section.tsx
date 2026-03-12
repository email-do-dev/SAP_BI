import type { ReactNode } from 'react'

interface DashboardSectionProps {
  title: string
  icon?: ReactNode
  children: ReactNode
}

export function DashboardSection({ title, icon, children }: DashboardSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}
