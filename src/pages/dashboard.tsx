import { useCallback } from 'react'
import { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { AreaTabs } from '@/components/dashboard/area-tabs'
import { AreaGeral } from '@/components/dashboard/area-geral'
import { AreaComercial } from '@/components/dashboard/area-comercial'
import { AreaFinanceiro } from '@/components/dashboard/area-financeiro'
import { AreaProducao } from '@/components/dashboard/area-producao'
import { AreaLogistica } from '@/components/dashboard/area-logistica'
import { AreaEstoque } from '@/components/dashboard/area-estoque'
import { AreaCompras } from '@/components/dashboard/area-compras'
import { useCacheQuery } from '@/hooks/use-sap-query'
import { SyncHealthBanner } from '@/components/shared/sync-health-banner'
import { exportToCsv } from '@/lib/utils'

export default function DashboardPage() {
  const filters = useDashboardFilters()

  // refreshed_at from any cache table for the header indicator
  const { data: kpiMensal } = useCacheQuery<Array<{ refreshed_at: string }>>('sap_cache_dashboard_kpis_mensal', { limit: 1 })
  const refreshedAt = kpiMensal?.[0]?.refreshed_at

  // Sync health monitoring
  const { data: syncLogs } = useCacheQuery<Array<{
    status: 'ok' | 'partial' | 'error' | 'running'
    started_at: string
    error_count: number
    synced_count: number
    errors: Array<{ step: string; message: string }>
  }>>('sap_sync_log', { order: 'started_at', ascending: false, limit: 1 })
  const lastSync = syncLogs?.[0]

  const handleExport = useCallback(() => {
    const rows = [
      { secao: filters.area, kpi: 'Período', valor: `${filters.dateRange.from} a ${filters.dateRange.to}` },
    ]
    exportToCsv(rows, [
      { key: 'secao', header: 'Seção' },
      { key: 'kpi', header: 'KPI' },
      { key: 'valor', header: 'Valor' },
    ], `dashboard-${filters.area}-${new Date().toISOString().slice(0, 10)}`)
  }, [filters.area, filters.dateRange])

  return (
    <div className="space-y-6">
      <SyncHealthBanner syncLog={lastSync} />
      <DashboardHeader
        refreshedAt={refreshedAt}
        dateRange={filters.dateRange}
        onDateRangeChange={filters.setDateRange}
        comparison={filters.comparison}
        onComparisonChange={filters.setComparison}
        onExport={handleExport}
      />
      <AreaTabs selected={filters.area} onChange={filters.setArea} />

      {filters.area === 'geral' && <AreaGeral filters={filters} />}
      {filters.area === 'comercial' && <AreaComercial filters={filters} />}
      {filters.area === 'financeiro' && <AreaFinanceiro filters={filters} />}
      {filters.area === 'producao' && <AreaProducao filters={filters} />}
      {filters.area === 'logistica' && <AreaLogistica filters={filters} />}
      {filters.area === 'estoque' && <AreaEstoque />}
      {filters.area === 'compras' && <AreaCompras filters={filters} />}
    </div>
  )
}
