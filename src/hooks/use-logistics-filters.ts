import { useState, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns'
import type { LogisticsTab } from '@/lib/logistics-constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DateRange {
  from: string
  to: string
}

interface LogisticsFilters {
  tab: LogisticsTab
  setTab: (tab: LogisticsTab) => void
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  planningDate: string
  setPlanningDate: (date: string) => void
  status: string
  setStatus: (status: string) => void
  vehicleId: string
  setVehicleId: (id: string) => void
  driverId: string
  setDriverId: (id: string) => void
  resetFilters: () => void
}

// ---------------------------------------------------------------------------
// Session storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'logistics_filters'

function getStoredValue<T>(key: string, fallback: T): T {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return fallback
    const parsed = JSON.parse(stored)
    return key in parsed ? parsed[key] : fallback
  } catch {
    return fallback
  }
}

function persistValue(key: string, value: unknown): void {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    const current = stored ? JSON.parse(stored) : {}
    current[key] = value
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // silently fail
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function getDefaultDateRange(): DateRange {
  const now = new Date()
  return {
    from: format(startOfMonth(now), 'yyyy-MM-dd'),
    to: format(endOfMonth(now), 'yyyy-MM-dd'),
  }
}

function getDefaultPlanningDate(): string {
  return format(addDays(new Date(), 1), 'yyyy-MM-dd')
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLogisticsFilters(): LogisticsFilters {
  const [tab, setTabState] = useState<LogisticsTab>(() =>
    getStoredValue('tab', 'programacao')
  )

  const [dateRange, setDateRangeState] = useState<DateRange>(() =>
    getStoredValue('dateRange', getDefaultDateRange())
  )

  const [planningDate, setPlanningDateState] = useState<string>(() =>
    getStoredValue('planningDate', getDefaultPlanningDate())
  )

  const [status, setStatusState] = useState<string>(() =>
    getStoredValue('status', '')
  )

  const [vehicleId, setVehicleIdState] = useState<string>(() =>
    getStoredValue('vehicleId', '')
  )

  const [driverId, setDriverIdState] = useState<string>(() =>
    getStoredValue('driverId', '')
  )

  const setTab = useCallback((t: LogisticsTab) => {
    setTabState(t)
    persistValue('tab', t)
  }, [])

  const setDateRange = useCallback((r: DateRange) => {
    setDateRangeState(r)
    persistValue('dateRange', r)
  }, [])

  const setPlanningDate = useCallback((d: string) => {
    setPlanningDateState(d)
    persistValue('planningDate', d)
  }, [])

  const setStatus = useCallback((s: string) => {
    setStatusState(s)
    persistValue('status', s)
  }, [])

  const setVehicleId = useCallback((id: string) => {
    setVehicleIdState(id)
    persistValue('vehicleId', id)
  }, [])

  const setDriverId = useCallback((id: string) => {
    setDriverIdState(id)
    persistValue('driverId', id)
  }, [])

  const resetFilters = useCallback(() => {
    const defaultRange = getDefaultDateRange()
    const defaultPlanning = getDefaultPlanningDate()

    setDateRangeState(defaultRange)
    setPlanningDateState(defaultPlanning)
    setStatusState('')
    setVehicleIdState('')
    setDriverIdState('')

    persistValue('dateRange', defaultRange)
    persistValue('planningDate', defaultPlanning)
    persistValue('status', '')
    persistValue('vehicleId', '')
    persistValue('driverId', '')
  }, [])

  return {
    tab,
    setTab,
    dateRange,
    setDateRange,
    planningDate,
    setPlanningDate,
    status,
    setStatus,
    vehicleId,
    setVehicleId,
    driverId,
    setDriverId,
    resetFilters,
  }
}
