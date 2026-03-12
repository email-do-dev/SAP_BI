import { useState, useCallback, useMemo } from 'react'
import { format, startOfYear } from 'date-fns'
import { filterByDateRange, computeComparison } from '@/lib/utils'
import type { ComparisonMode } from '@/hooks/use-dashboard-filters'

interface DateRange {
  from: string
  to: string
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
  const prevTo = new Date(from.getTime() - 86400000)
  const prevFrom = new Date(prevTo.getTime() - durationMs)
  return { from: format(prevFrom, 'yyyy-MM-dd'), to: format(prevTo, 'yyyy-MM-dd') }
}

export function useComercialFilters() {
  const [dateRange, setDateRangeState] = useState<DateRange>(getDefaultDateRange)
  const [comparison, setComparisonState] = useState<ComparisonMode>(() =>
    getStoredValue('comercial_comparison', 'none')
  )

  const setDateRange = useCallback((r: DateRange) => {
    setDateRangeState(r)
  }, [])

  const setComparison = useCallback((m: ComparisonMode) => {
    setComparisonState(m)
    sessionStorage.setItem('comercial_comparison', JSON.stringify(m))
  }, [])

  const comparisonRange = useMemo(
    () => getComparisonRange(dateRange, comparison),
    [dateRange, comparison]
  )

  const filterData = useCallback(
    <T extends Record<string, unknown>>(data: T[], dateField: string) => {
      return filterByDateRange(data, dateField, dateRange.from, dateRange.to)
    },
    [dateRange]
  )

  const filterComparisonData = useCallback(
    <T extends Record<string, unknown>>(data: T[], dateField: string) => {
      if (comparison === 'none') return []
      return filterByDateRange(data, dateField, comparisonRange.from, comparisonRange.to)
    },
    [comparison, comparisonRange]
  )

  const compareValues = useCallback((current: number, previous: number) => {
    return computeComparison(current, previous)
  }, [])

  return {
    dateRange,
    setDateRange,
    comparison,
    setComparison,
    comparisonRange,
    filterData,
    filterComparisonData,
    compareValues,
  }
}
