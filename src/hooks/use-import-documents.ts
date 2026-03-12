import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type ImportDocument = Database['public']['Tables']['import_documents']['Row']

export type { ImportDocument }

export function useImportDocuments(processId: string | undefined) {
  return useQuery<ImportDocument[]>({
    queryKey: ['import-documents', processId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('import_documents')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ImportDocument[]
    },
    enabled: !!processId,
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      processId,
      docType,
      file,
      userId,
    }: {
      processId: string
      docType: string
      file: File
      userId: string
    }) => {
      // Upload to storage
      const path = `${processId}/${Date.now()}_${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('import-documents')
        .upload(path, file)
      if (uploadErr) throw uploadErr

      // Insert metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: insertErr } = await (supabase.from as any)('import_documents')
        .insert({
          process_id: processId,
          doc_type: docType,
          file_name: file.name,
          storage_path: path,
          file_size: file.size,
          uploaded_by: userId,
        })
        .select()
        .single()
      if (insertErr) throw insertErr
      return data as ImportDocument
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['import-documents', vars.processId] })
    },
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, storagePath, processId }: { id: string; storagePath: string; processId: string }) => {
      // Delete from storage
      await supabase.storage.from('import-documents').remove([storagePath])
      // Delete metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)('import_documents').delete().eq('id', id)
      if (error) throw error
      return processId
    },
    onSuccess: (processId) => {
      qc.invalidateQueries({ queryKey: ['import-documents', processId] })
    },
  })
}

export function useExtractOcr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ documentId, processId }: { documentId: string; processId: string }) => {
      // Set status to processing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from as any)('import_documents')
        .update({ ocr_status: 'processing' })
        .eq('id', documentId)

      const { data, error } = await supabase.functions.invoke('import-ocr', {
        body: { document_id: documentId },
      })
      if (error) throw error
      return { ...data, processId }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['import-documents', vars.processId] })
    },
  })
}

export function useDocumentUrl(storagePath: string | undefined) {
  return useQuery({
    queryKey: ['import-doc-url', storagePath],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('import-documents')
        .createSignedUrl(storagePath!, 3600)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!storagePath,
    staleTime: 30 * 60 * 1000, // 30 min
  })
}
