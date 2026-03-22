import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  X, Camera, Upload, CheckCircle2, AlertTriangle,
  Loader2, FileCheck, Truck, Package,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import {
  SHIPMENT_STATUS_CONFIG,
  DELIVERY_TYPE_LABELS,
  type ShipmentStatus,
} from '@/lib/logistics-constants'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Database } from '@/types/database'

type ShipmentRow = Database['public']['Tables']['shipments']['Row']
type ShipmentItemRow = Database['public']['Tables']['shipment_items']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type DriverRow = Database['public']['Tables']['drivers']['Row']

interface ShipmentWithDetails extends ShipmentRow {
  vehicle?: VehicleRow | null
  driver?: DriverRow | null
  items?: ShipmentItemRow[]
}

interface Props {
  shipment: ShipmentWithDetails
  onClose: () => void
}

export function DescarregoDetailDialog({ shipment, onClose }: Props) {
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [error, setError] = useState<string | null>(null)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [uploadingItem, setUploadingItem] = useState<string | null>(null)
  const [canhotoPreviews, setCanhotoPreviews] = useState<Map<string, string>>(new Map())

  // Fetch fresh items
  const { data: freshItems = shipment.items ?? [], refetch: refetchItems } = useQuery<ShipmentItemRow[]>({
    queryKey: ['descarrego-items', shipment.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shipment_items') as any)
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('loading_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ShipmentItemRow[]
    },
    staleTime: 10 * 1000,
  })

  // Open dialog
  useEffect(() => {
    const el = dialogRef.current
    if (el && !el.open) el.showModal()
  }, [])

  // Load existing canhoto previews
  useEffect(() => {
    async function loadPreviews() {
      const previews = new Map<string, string>()
      for (const item of freshItems) {
        if (item.canhoto_storage_path) {
          const { data } = await supabase.storage.from('delivery-proofs').createSignedUrl(item.canhoto_storage_path, 3600)
          if (data?.signedUrl) previews.set(item.id, data.signedUrl)
        }
      }
      if (previews.size > 0) setCanhotoPreviews(previews)
    }
    loadPreviews()
  }, [freshItems])

  // Upload canhoto photo
  const uploadCanhoto = useCallback(async (itemId: string, file: File) => {
    setUploadingItem(itemId)
    setError(null)
    try {
      const timestamp = Date.now()
      const path = `${shipment.id}/${itemId}_canhoto_${timestamp}.jpg`

      const { error: uploadErr } = await supabase.storage
        .from('delivery-proofs')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('shipment_items') as any)
        .update({ canhoto_storage_path: path })
        .eq('id', itemId)

      const { data } = await supabase.storage.from('delivery-proofs').createSignedUrl(path, 3600)
      if (data?.signedUrl) {
        setCanhotoPreviews(prev => new Map(prev).set(itemId, data.signedUrl))
      }

      await refetchItems()
    } catch (err) {
      setError(`Erro ao enviar canhoto: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    } finally {
      setUploadingItem(null)
    }
  }, [shipment.id, refetchItems])

  // Update item field
  const updateItemField = useCallback(async (itemId: string, field: string, value: string | number | null) => {
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('shipment_items') as any)
        .update({ [field]: value })
        .eq('id', itemId)
      await refetchItems()
    } catch (err) {
      setError(`Erro ao atualizar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }, [refetchItems])

  // Finalize shipment
  const handleFinalize = async () => {
    setIsFinalizing(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase.from('shipments') as any)
        .update({
          status: 'finalizada',
          completed_at: new Date().toISOString(),
        })
        .eq('id', shipment.id)
      if (updateErr) throw updateErr

      queryClient.invalidateQueries({ queryKey: ['descarrego-shipments'] })
      queryClient.invalidateQueries({ queryKey: ['descarrego-finalizadas-hoje'] })
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      onClose()
    } catch (err) {
      setError(`Erro ao finalizar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    } finally {
      setIsFinalizing(false)
    }
  }

  const statusConfig = SHIPMENT_STATUS_CONFIG[shipment.status as ShipmentStatus]
  const allCanhotos = freshItems.length > 0 && freshItems.every(i => !!i.canhoto_storage_path)
  const operatorItemsWithoutCte = freshItems.filter(i => i.delivery_type === 'operator' && !i.cte_doc_entry)
  const canFinalize = allCanhotos && operatorItemsWithoutCte.length === 0

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-full max-w-full overflow-y-auto bg-card p-0 backdrop:bg-black/50"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold">{shipment.reference}</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(shipment.delivery_date), "dd/MM/yyyy", { locale: ptBR })}
            {shipment.vehicle && ` — ${shipment.vehicle.plate}`}
            {shipment.driver && ` — ${shipment.driver.name}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X size={20} />
        </button>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">

        {/* Section A — Resumo */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Truck size={20} className="text-primary" />
            Resumo da Carga
          </h3>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={cn('rounded-full px-3 py-1 text-sm font-medium', statusConfig.bgColor, statusConfig.color)}>
                {statusConfig.label}
              </span>
              {shipment.seal_number && (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  Lacre: {shipment.seal_number}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Peso Total</p>
                <p className="font-medium">{formatNumber(shipment.total_weight_kg)} kg</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="font-medium">{formatCurrency(shipment.total_value)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NFs</p>
                <p className="font-medium">{freshItems.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Canhotos</p>
                <p className="font-medium">
                  {freshItems.filter(i => !!i.canhoto_storage_path).length}/{freshItems.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section B — NFs com Confirmação */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Package size={20} className="text-primary" />
            Confirmação por NF
          </h3>
          <div className="space-y-4">
            {freshItems.map(item => {
              const hasCanhoto = !!item.canhoto_storage_path
              const preview = canhotoPreviews.get(item.id)
              const isUploading = uploadingItem === item.id
              const isOperator = item.delivery_type === 'operator'
              const deliveryTypeLabel = DELIVERY_TYPE_LABELS[item.delivery_type as 'direct' | 'operator']

              return (
                <div key={item.id} className={cn(
                  'rounded-lg border bg-card p-4',
                  hasCanhoto ? 'border-green-200' : 'border-border'
                )}>
                  {/* NF Header */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {hasCanhoto ? (
                      <CheckCircle2 size={18} className="text-green-600" />
                    ) : (
                      <FileCheck size={18} className="text-amber-500" />
                    )}
                    <span className="font-semibold text-sm">
                      {item.origem} {item.doc_num ?? item.doc_entry}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      — {item.card_name} ({item.uf})
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{deliveryTypeLabel}</span>
                    <span className="ml-auto text-sm font-medium">{formatCurrency(item.doc_total)}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Canhoto photo */}
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Foto do Canhoto</p>
                      {preview ? (
                        <div className="relative">
                          <img
                            src={preview}
                            alt="Canhoto"
                            className="h-32 w-full rounded-md object-cover"
                          />
                          <CanhotoUploadButton
                            isLoading={isUploading}
                            onUpload={file => uploadCanhoto(item.id, file)}
                            className="absolute right-2 top-2"
                            compact
                          />
                        </div>
                      ) : (
                        <CanhotoUploadButton
                          isLoading={isUploading}
                          onUpload={file => uploadCanhoto(item.id, file)}
                        />
                      )}
                    </div>

                    {/* Fields */}
                    <div className="space-y-3">
                      {isOperator && (
                        <>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nº CTE</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              defaultValue={item.cte_doc_entry ?? ''}
                              onBlur={e => {
                                const val = e.target.value ? Number(e.target.value) : null
                                if (val !== item.cte_doc_entry) updateItemField(item.id, 'cte_doc_entry', val)
                              }}
                              placeholder="Número do CTE"
                              className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor CTE (R$)</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              defaultValue={item.cte_value ?? ''}
                              onBlur={e => {
                                const val = e.target.value ? Number(e.target.value) : null
                                if (val !== item.cte_value) updateItemField(item.id, 'cte_value', val)
                              }}
                              placeholder="0,00"
                              className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Custo Descarrego (R$)</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          defaultValue={item.unloading_cost || ''}
                          onBlur={e => {
                            const val = Number(e.target.value) || 0
                            if (val !== item.unloading_cost) updateItemField(item.id, 'unloading_cost', val)
                          }}
                          placeholder="0,00"
                          className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Observações</label>
                        <input
                          type="text"
                          defaultValue={item.delivery_notes ?? ''}
                          onBlur={e => {
                            const val = e.target.value.trim() || null
                            if (val !== item.delivery_notes) updateItemField(item.id, 'delivery_notes', val)
                          }}
                          placeholder="Opcional"
                          className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {/* Section C — Finalizar */}
        <section className="border-t border-border pt-4">
          {!canFinalize && (
            <div className="mb-4 space-y-1 text-sm text-muted-foreground">
              {!allCanhotos && (
                <p className="flex items-center gap-1.5">
                  <Camera size={14} className="text-amber-500" />
                  Envie o canhoto de todas as NFs
                </p>
              )}
              {operatorItemsWithoutCte.length > 0 && (
                <p className="flex items-center gap-1.5">
                  <FileCheck size={14} className="text-amber-500" />
                  Preencha o CTE de {operatorItemsWithoutCte.length} NF{operatorItemsWithoutCte.length > 1 ? 's' : ''} via operador
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleFinalize}
            disabled={!canFinalize || isFinalizing}
            className={cn(
              'flex min-h-[44px] items-center gap-2 rounded-md px-6 py-2.5 text-sm font-medium text-white transition-colors',
              canFinalize && !isFinalizing
                ? 'bg-green-600 hover:bg-green-700'
                : 'cursor-not-allowed bg-gray-400'
            )}
          >
            {isFinalizing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            Finalizar Carga
          </button>
        </section>
      </div>
    </dialog>
  )
}

// ---------------------------------------------------------------------------
// Canhoto upload sub-component
// ---------------------------------------------------------------------------
function CanhotoUploadButton({
  isLoading,
  onUpload,
  className,
  compact,
}: {
  isLoading: boolean
  onUpload: (file: File) => void
  className?: string
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (compact) {
    return (
      <>
        <button
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80',
            className
          )}
        >
          <Camera size={16} />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
        className="flex min-h-[80px] w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
      >
        {isLoading ? (
          <Loader2 size={24} className="animate-spin" />
        ) : (
          <>
            <Upload size={24} />
            <span className="text-xs">Foto do canhoto</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
    </>
  )
}
