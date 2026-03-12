import { ResponsiveContainer } from 'recharts'
import { ChartSkeleton } from '@/components/shared/loading-skeleton'
import { EmptyState } from '@/components/shared/empty-state'

interface ChartCardProps {
  title: string
  loading: boolean
  children: React.ReactNode
  height?: number
  isEmpty?: boolean
  emptyMessage?: string
}

export function ChartCard({ title, loading, children, height = 280, isEmpty, emptyMessage }: ChartCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      {loading ? <ChartSkeleton /> : isEmpty ? (
        <EmptyState message={emptyMessage} className="py-6" />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      )}
    </div>
  )
}
