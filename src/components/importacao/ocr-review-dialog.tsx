import { useState } from 'react'
import { Dialog } from '@/components/shared/dialog'
import { useDocumentUrl, type ImportDocument } from '@/hooks/use-import-documents'
import { useUpdateProcess } from '@/hooks/use-import-queries'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'

interface OcrReviewDialogProps {
  doc: ImportDocument
  processId: string
  onClose: () => void
}

interface ExtractedFields {
  supplier_name?: string
  invoice_number?: string
  invoice_date?: string
  currency?: string
  total_value?: number
  container_number?: string
  vessel_name?: string
  bl_number?: string
  net_weight?: number
  gross_weight?: number
  items?: Array<{ description: string; quantity: number; unit_price: number; total: number }>
}

export function OcrReviewDialog({ doc, processId, onClose }: OcrReviewDialogProps) {
  const { user } = useAuth()
  const { data: url } = useDocumentUrl(doc.storage_path)
  const updateProcess = useUpdateProcess()
  const isPdf = doc.file_name.toLowerCase().endsWith('.pdf')

  const extracted = (doc.extracted_data ?? {}) as ExtractedFields
  const [fields, setFields] = useState<ExtractedFields>({ ...extracted })

  const set = (key: keyof ExtractedFields, val: string | number) =>
    setFields((prev) => ({ ...prev, [key]: val }))

  const handleApply = async () => {
    // Apply extracted fields to the process
    const update: Record<string, unknown> = { updated_by: user?.id }
    if (fields.container_number) update.container_number = fields.container_number
    if (fields.vessel_name) update.vessel = fields.vessel_name
    if (fields.currency) update.currency = fields.currency
    if (fields.total_value) update.total_fob = fields.total_value

    await updateProcess.mutateAsync({ id: processId, ...update })
    onClose()
  }

  const inputCls = 'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <Dialog open onClose={onClose} title="Dados Extraídos (OCR)" className="max-w-5xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Preview */}
        <div className="overflow-hidden rounded-lg border border-border">
          {url ? (
            isPdf ? (
              <iframe src={url} className="h-[60vh] w-full" title="Preview" />
            ) : (
              <img src={url} alt="Preview" className="max-h-[60vh] w-full object-contain" />
            )
          ) : (
            <div className="flex h-60 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Extracted fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fornecedor</label>
              <input className={inputCls} value={fields.supplier_name ?? ''} onChange={(e) => set('supplier_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nº Invoice</label>
              <input className={inputCls} value={fields.invoice_number ?? ''} onChange={(e) => set('invoice_number', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data Invoice</label>
              <input className={inputCls} value={fields.invoice_date ?? ''} onChange={(e) => set('invoice_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Moeda</label>
              <input className={inputCls} value={fields.currency ?? ''} onChange={(e) => set('currency', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Valor Total</label>
              <input type="number" step="0.01" className={inputCls} value={fields.total_value ?? ''} onChange={(e) => set('total_value', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Container</label>
              <input className={inputCls} value={fields.container_number ?? ''} onChange={(e) => set('container_number', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Navio</label>
              <input className={inputCls} value={fields.vessel_name ?? ''} onChange={(e) => set('vessel_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">BL Number</label>
              <input className={inputCls} value={fields.bl_number ?? ''} onChange={(e) => set('bl_number', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Peso Bruto (kg)</label>
              <input type="number" step="0.001" className={inputCls} value={fields.gross_weight ?? ''} onChange={(e) => set('gross_weight', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Peso Líquido (kg)</label>
              <input type="number" step="0.001" className={inputCls} value={fields.net_weight ?? ''} onChange={(e) => set('net_weight', parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {/* Items preview */}
          {fields.items && fields.items.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">Itens extraídos</h4>
              <div className="max-h-40 overflow-y-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-1 text-left">Descrição</th>
                      <th className="px-2 py-1 text-right">Qtd</th>
                      <th className="px-2 py-1 text-right">Preço</th>
                      <th className="px-2 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.items.map((item, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1">{item.description}</td>
                        <td className="px-2 py-1 text-right">{item.quantity}</td>
                        <td className="px-2 py-1 text-right">{item.unit_price}</td>
                        <td className="px-2 py-1 text-right">{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">
              Fechar
            </button>
            <button
              onClick={handleApply}
              disabled={updateProcess.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {updateProcess.isPending ? 'Aplicando...' : 'Aplicar ao Processo'}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
