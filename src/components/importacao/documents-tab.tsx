import { useState, useCallback } from 'react'
import { Upload, FileText, Trash2, Eye, Sparkles, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DOC_TYPE_LABELS, DOC_TYPES, type ImportDocType } from '@/lib/import-constants'
import { useImportDocuments, useUploadDocument, useDeleteDocument, useExtractOcr, useDocumentUrl, type ImportDocument } from '@/hooks/use-import-documents'
import { useAuth } from '@/contexts/auth-context'
import { Dialog } from '@/components/shared/dialog'
import { OcrReviewDialog } from './ocr-review-dialog'

interface DocumentsTabProps {
  processId: string
  readOnly?: boolean
}

const OCR_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  none: { label: '—', color: '' },
  processing: { label: 'Processando...', color: 'text-amber-600' },
  done: { label: 'Extraído', color: 'text-green-600' },
  error: { label: 'Erro', color: 'text-red-600' },
}

export function DocumentsTab({ processId, readOnly }: DocumentsTabProps) {
  const { user } = useAuth()
  const { data: documents = [], isLoading } = useImportDocuments(processId)
  const uploadDoc = useUploadDocument()
  const deleteDoc = useDeleteDocument()
  const extractOcr = useExtractOcr()

  const [docType, setDocType] = useState<ImportDocType>('invoice')
  const [dragOver, setDragOver] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<ImportDocument | null>(null)
  const [ocrDoc, setOcrDoc] = useState<ImportDocument | null>(null)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !user) return
    for (const file of Array.from(files)) {
      await uploadDoc.mutateAsync({ processId, docType, file, userId: user.id })
    }
  }, [processId, docType, user, uploadDoc])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const inputCls = 'rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      {!readOnly && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <select className={inputCls} value={docType} onChange={(e) => setDocType(e.target.value as ImportDocType)}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <Upload size={32} className="mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Arraste arquivos aqui ou</p>
            <label className="mt-2 cursor-pointer rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90">
              Selecionar arquivo
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">PDF, JPG, PNG — max 20MB</p>
            {uploadDoc.isPending && <p className="mt-2 text-xs text-primary">Enviando...</p>}
          </div>
        </div>
      )}

      {/* Document list */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : documents.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Nenhum documento enviado.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Arquivo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">OCR</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const ocrStatus = OCR_STATUS_LABELS[doc.ocr_status] ?? OCR_STATUS_LABELS.none
                return (
                  <tr key={doc.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{doc.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(parseISO(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={ocrStatus.color}>{ocrStatus.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setPreviewDoc(doc)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Visualizar">
                          <Eye size={14} />
                        </button>
                        {!readOnly && doc.ocr_status !== 'processing' && (
                          <button
                            onClick={() => extractOcr.mutate({ documentId: doc.id, processId })}
                            className="rounded p-1 text-muted-foreground hover:text-primary"
                            title="Extrair dados (OCR)"
                            disabled={extractOcr.isPending}
                          >
                            {extractOcr.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          </button>
                        )}
                        {doc.ocr_status === 'done' && doc.extracted_data && (
                          <button onClick={() => setOcrDoc(doc)} className="rounded p-1 text-primary hover:text-primary/80" title="Ver dados extraídos">
                            <FileText size={14} />
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            onClick={() => deleteDoc.mutate({ id: doc.id, storagePath: doc.storage_path, processId })}
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview dialog */}
      {previewDoc && (
        <DocumentPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      {/* OCR review dialog */}
      {ocrDoc && (
        <OcrReviewDialog doc={ocrDoc} processId={processId} onClose={() => setOcrDoc(null)} />
      )}
    </div>
  )
}

function DocumentPreviewDialog({ doc, onClose }: { doc: ImportDocument; onClose: () => void }) {
  const { data: url, isLoading } = useDocumentUrl(doc.storage_path)
  const isPdf = doc.file_name.toLowerCase().endsWith('.pdf')

  return (
    <Dialog open onClose={onClose} title={doc.file_name} className="max-w-4xl">
      {isLoading ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : url ? (
        isPdf ? (
          <iframe src={url} className="h-[70vh] w-full rounded border" title={doc.file_name} />
        ) : (
          <img src={url} alt={doc.file_name} className="max-h-[70vh] w-full object-contain rounded" />
        )
      ) : (
        <p className="py-8 text-center text-muted-foreground">Não foi possível carregar o arquivo.</p>
      )}
    </Dialog>
  )
}
