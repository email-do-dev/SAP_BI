import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface SapQueryOptions {
  queryName: string
  params?: Record<string, string | number>
  enabled?: boolean
}

async function sapQuery<T>(queryName: string, params?: Record<string, string | number>): Promise<T> {
  // supabase.functions.invoke() automatically sends the Bearer token
  const { data, error } = await supabase.functions.invoke('sap-query', {
    body: { query: queryName, params },
  })

  if (error) throw error
  return data as T
}

export function useSapQuery<T>(options: SapQueryOptions) {
  return useQuery<T>({
    queryKey: ['sap', options.queryName, options.params],
    queryFn: () => sapQuery<T>(options.queryName, options.params),
    enabled: options.enabled ?? true,
    staleTime: 0,
  })
}

export function useCacheQuery<T>(table: string, options?: { select?: string; order?: string; ascending?: boolean; limit?: number }) {
  return useQuery<T>({
    queryKey: ['cache', table, options],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from as any)(table).select(options?.select ?? '*')
      if (options?.order) query = query.order(options.order, { ascending: options.ascending ?? true })
      if (options?.limit) query = query.limit(options.limit)
      const { data, error } = await query
      if (error) {
        if (import.meta.env.DEV) console.error(`Cache query error [${table}]:`, error)
        throw error
      }
      return data as T
    },
  })
}
