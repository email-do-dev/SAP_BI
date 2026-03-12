import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { ImportProcessStatus } from '@/lib/import-constants'

type ImportProcess = Database['public']['Tables']['import_processes']['Row']
type ImportProcessInsert = Database['public']['Tables']['import_processes']['Insert']
type ImportProcessUpdate = Database['public']['Tables']['import_processes']['Update']
type ImportItem = Database['public']['Tables']['import_items']['Row']
type ImportItemInsert = Database['public']['Tables']['import_items']['Insert']
type ImportTimeline = Database['public']['Tables']['import_timeline']['Row']
type ImportTrackingEvent = Database['public']['Tables']['import_tracking_events']['Row']

export type { ImportProcess, ImportItem, ImportTimeline, ImportTrackingEvent }

// === Processes ===

export function useImportProcesses() {
  return useQuery<ImportProcess[]>({
    queryKey: ['import-processes'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_processes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ImportProcess[]
    },
  })
}

export function useImportProcess(id: string | undefined) {
  return useQuery<ImportProcess>({
    queryKey: ['import-process', id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_processes')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as ImportProcess
    },
    enabled: !!id,
  })
}

export function useCreateProcess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { process: ImportProcessInsert; items: Omit<ImportItemInsert, 'process_id'>[] }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: proc, error: procErr } = await (supabase.from as any)('import_processes')
        .insert(input.process)
        .select()
        .single()
      if (procErr) throw procErr

      if (input.items.length > 0) {
        const rows = input.items.map((item) => ({ ...item, process_id: (proc as ImportProcess).id }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: itemsErr } = await (supabase.from as any)('import_items').insert(rows)
        if (itemsErr) throw itemsErr
      }

      return proc as ImportProcess
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-processes'] })
    },
  })
}

export function useUpdateProcess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...update }: ImportProcessUpdate & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_processes')
        .update(update)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ImportProcess
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['import-processes'] })
      qc.invalidateQueries({ queryKey: ['import-process', vars.id] })
    },
  })
}

// === Items ===

export function useImportItems(processId: string | undefined) {
  return useQuery<ImportItem[]>({
    queryKey: ['import-items', processId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_items')
        .select('*')
        .eq('process_id', processId)
        .order('created_at')
      if (error) throw error
      return data as ImportItem[]
    },
    enabled: !!processId,
  })
}

export function useAddItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: ImportItemInsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_items')
        .insert(item)
        .select()
        .single()
      if (error) throw error
      return data as ImportItem
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['import-items', vars.process_id] })
    },
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, processId }: { id: string; processId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)('import_items').delete().eq('id', id)
      if (error) throw error
      return processId
    },
    onSuccess: (processId) => {
      qc.invalidateQueries({ queryKey: ['import-items', processId] })
    },
  })
}

// === Status advance ===

export function useAdvanceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ processId, fromStatus, toStatus, userId, notes }: {
      processId: string
      fromStatus: ImportProcessStatus
      toStatus: ImportProcessStatus
      userId: string
      notes?: string
    }) => {
      // Update status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase.from as any)('import_processes')
        .update({ status: toStatus, updated_by: userId })
        .eq('id', processId)
      if (updateErr) throw updateErr

      // Insert timeline entry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: tlErr } = await (supabase.from as any)('import_timeline')
        .insert({ process_id: processId, from_status: fromStatus, to_status: toStatus, changed_by: userId, notes })
      if (tlErr) throw tlErr
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['import-processes'] })
      qc.invalidateQueries({ queryKey: ['import-process', vars.processId] })
      qc.invalidateQueries({ queryKey: ['import-timeline', vars.processId] })
    },
  })
}

// === Timeline ===

export function useImportTimeline(processId: string | undefined) {
  return useQuery<ImportTimeline[]>({
    queryKey: ['import-timeline', processId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_timeline')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ImportTimeline[]
    },
    enabled: !!processId,
  })
}

// === Tracking events ===

export function useImportTrackingEvents(processId: string | undefined) {
  return useQuery<ImportTrackingEvent[]>({
    queryKey: ['import-tracking', processId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_tracking_events')
        .select('*')
        .eq('process_id', processId)
        .order('event_date', { ascending: false })
      if (error) throw error
      return data as ImportTrackingEvent[]
    },
    enabled: !!processId,
  })
}

export function useAddTrackingEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (event: Database['public']['Tables']['import_tracking_events']['Insert']) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_tracking_events')
        .insert(event)
        .select()
        .single()
      if (error) throw error
      return data as ImportTrackingEvent
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['import-tracking', vars.process_id] })
    },
  })
}
