import { useState, useCallback, useMemo } from 'react'
import { format, subMonths, startOfMonth, startOfYear, startOfQuarter } from 'date-fns'
import { filterByDateRange, computeComparison } from '@/lib/utils'

export type DashboardArea = 'geral' | 'comercial' | 'financeiro' | 'producao' | 'logistica' | 'estoque' | 'compras'
export type ComparisonMode = 'none' | 'prev_period' | 'prev_year'

interface DateRange {
  from: string
  to: string
}

interface DashboardFilters {
  area: DashboardArea
  setArea: (area: DashboardArea) => void
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  comparison: ComparisonMode
  setComparison: (mode: ComparisonMode) => void
  comparisonRange: DateRange
  filterData: <T extends Record<string, unknown>>(data: T[], dateField: string) => T[]
  filterComparisonData: <T extends Record<string, unknown>>(data: T[], dateField: string) => T[]
  compareValues: (current: number, previous: number) => { delta: number; pct: number; direction: 'up' | 'down' | 'flat' }
}

function getStoredValue<T>(key: string, fallback: T): T {
  try {
    const stored = sessionStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function getDefaultDateRange(): DateRange {
  const today = format(new Date(), 'yyyy-MM-dd')
  const ytdStart = format(startOfYear(new Date()), 'yyyy-MM-dd')
  return { from: ytdStart, to: today }
}

function getComparisonRange(range: DateRange, mode: ComparisonMode): DateRange {
  if (mode === 'none' || !range.from || !range.to) return { from: '', to: '' }

  const from = new Date(range.from)
  const to = new Date(range.to)
  const durationMs = to.getTime() - from.getTime()

  if (mode === 'prev_year') {
    const prevFrom = new Date(from)
    prevFrom.setFullYear(prevFrom.getFullYear() - 1)
    const prevTo = new Date(to)
    prevTo.setFullYear(prevTo.getFullYear() - 1)
    return { from: format(prevFrom, 'yyyy-MM-dd'), to: format(prevTo, 'yyyy-MM-dd') }
  }

  // prev_period: shift back by the same duration
  const prevTo = new Date(from.getTime() - 86400000) // day before from
  const prevFrom = new Date(prevTo.getTime() - durationMs)
  return { from: format(prevFrom, 'yyyy-MM-dd'), to: format(prevTo, 'yyyy-MM-dd') }
}

export function useDashboardFilters(): DashboardFilters {
  const [area, setAreaState] = useState<DashboardArea>(() => getStoredValue('dash_area', 'geral'))
  const [dateRange, setDateRangeState] = useState<DateRange>(() => getStoredValue('dash_range', getDefaultDateRange()))
  const [comparison, setComparisonState] = useState<ComparisonMode>(() => getStoredValue('dash_comparison', 'none'))

  const setArea = useCallback((a: DashboardArea) => {
    setAreaState(a)
    sessionStorage.setItem('dash_area', JSON.stringify(a))
  }, [])

  const setDateRange = useCallback((r: DateRange) => {
    setDateRangeState(r)
    sessionStorage.setItem('dash_range', JSON.stringify(r))
  }, [])

  const setComparison = useCallback((m: ComparisonMode) => {
    setComparisonState(m)
    sessionStorage.setItem('dash_comparison', JSON.stringify(m))
  }, [])

  const comparisonRange = useMemo(() => getComparisonRange(dateRange, comparison), [dateRange, comparison])

  const filterData = useCallback(<T extends Record<string, unknown>>(data: T[], dateField: string) => {
    return filterByDateRange(data, dateField, dateRange.from, dateRange.to)
  }, [dateRange])

  const filterComparisonData = useCallback(<T extends Record<string, unknown>>(data: T[], dateField: string) => {
    if (comparison === 'none') return []
    return filterByDateRange(data, dateField, comparisonRange.from, comparisonRange.to)
  }, [comparison, comparisonRange])

  const compareValues = useCallback((current: number, previous: number) => {
    return computeComparison(current, previous)
  }, [])

  return {
    area, setArea,
    dateRange, setDateRange,
    comparison, setComparison,
    comparisonRange,
    filterData, filterComparisonData,
    compareValues,
  }
}

/** Presets for the date range picker */
export const DATE_PRESETS: { label: string; range: () => DateRange }[] = [
  { label: 'Este mês', range: () => ({ from: format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'Mês passado', range: () => {
    const prev = subMonths(new Date(), 1)
    return { from: format(startOfMonth(prev), 'yyyy-MM-dd'), to: format(new Date(prev.getFullYear(), prev.getMonth() + 1, 0), 'yyyy-MM-dd') }
  }},
  { label: 'Trimestre', range: () => ({ from: format(startOfQuarter(new Date()), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'YTD', range: () => ({ from: format(startOfYear(new Date()), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'Últimos 12m', range: () => ({ from: format(subMonths(new Date(), 12), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'Últimos 24m', range: () => ({ from: format(subMonths(new Date(), 24), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'Todo histórico', range: () => ({ from: '', to: '' }) },
]
