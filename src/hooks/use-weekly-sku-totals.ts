import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

export interface WeeklySkuRow {
  item_code: string
  descricao: string
  grupo_expedicao: string
  qty_dom: number
  qty_seg: number
  qty_ter: number
  qty_qua: number
  qty_qui: number
  qty_sex: number
  qty_sab: number
  total_semana: number
}

export function useWeeklySkuTotals(weekStart: Date, weekEnd: Date) {
  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endStr = format(weekEnd, 'yyyy-MM-dd')

  return useQuery<WeeklySkuRow[]>({
    queryKey: ['weekly-sku-totals', startStr, endStr],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_weekly_sku_totals', {
        p_week_start: startStr,
        p_week_end: endStr,
      })
      if (error) throw error
      return (data ?? []) as WeeklySkuRow[]
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
