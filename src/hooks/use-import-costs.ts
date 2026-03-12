import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type ImportCost = Database['public']['Tables']['import_costs']['Row']
type ImportCostInsert = Database['public']['Tables']['import_costs']['Insert']

export type { ImportCost }

export function useImportCosts(processId: string | undefined) {
  return useQuery<ImportCost[]>({
    queryKey: ['import-costs', processId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_costs')
        .select('*')
        .eq('process_id', processId)
        .order('created_at')
      if (error) throw error
      return data as ImportCost[]
    },
    enabled: !!processId,
  })
}

export function useUpsertCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cost: ImportCostInsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_costs')
        .upsert(cost, { onConflict: 'process_id,cost_type,cost_label' })
        .select()
        .single()
      if (error) throw error
      return data as ImportCost
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['import-costs', vars.process_id] })
    },
  })
}

export function useDeleteCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, processId }: { id: string; processId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)('import_costs').delete().eq('id', id)
      if (error) throw error
      return processId
    },
    onSuccess: (processId) => {
      qc.invalidateQueries({ queryKey: ['import-costs', processId] })
    },
  })
}

export function useCostSummary(processId: string | undefined) {
  const { data: costs = [] } = useImportCosts(processId)

  const totalPlanned = costs.reduce((s, c) => {
    const rate = c.currency === 'BRL' ? 1 : Number(c.exchange_rate) || 1
    return s + Number(c.planned_value) * rate
  }, 0)

  const totalActual = costs.reduce((s, c) => {
    const rate = c.currency === 'BRL' ? 1 : Number(c.exchange_rate) || 1
    return s + Number(c.actual_value) * rate
  }, 0)

  const deviation = totalPlanned > 0 ? ((totalActual - totalPlanned) / totalPlanned) * 100 : 0

  return { costs, totalPlanned, totalActual, deviation }
}
