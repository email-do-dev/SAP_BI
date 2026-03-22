import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import {
  X, Camera, Printer, AlertTriangle,
  Upload, CheckCircle2, Loader2, Plus, Trash2, Package,
  Lock, ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber, printContent } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Database, PalletEntry } from '@/types/database'

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

interface SkuLine {
  item_code: string
  descricao: string
  quantidade: number
}

export function RomaneioChecklistDialog({ shipment, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const items = useMemo(() => shipment.items ?? [], [shipment.items])

  // Pallets state — keyed by shipment_item_id
  const [pallets, setPallets] = useState<PalletEntry[]>(() =>
    (shipment.pallets_data && shipment.pallets_data.length > 0)
      ? shipment.pallets_data
      : []
  )

  // Accordion: which NF is expanded
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // Seal state
  const [sealNumber, setSealNumber] = useState(shipment.seal_number ?? '')
  const [sealPhotoPath, setSealPhotoPath] = useState<string | null>(shipment.seal_photo_path)
  const [sealPreview, setSealPreview] = useState<string | null>(null)

  // Door photo
  const [doorPhotoPath, setDoorPhotoPath] = useState<string | null>(shipment.loading_photo_path)
  const [doorPreview, setDoorPreview] = useState<string | null>(null)

  // General state
  const [loadingPhoto, setLoadingPhoto] = useState<string | null>(null)
  const [isExpeding, setIsExpeding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Items sorted by loading_order (LIFO: 1 = load first = deliver last)
  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const aOrder = a.loading_order ?? 9999
      const bOrder = b.loading_order ?? 9999
      return aOrder - bOrder
    })
    // If loading_order is null, assign based on reverse index
    return sorted.map((item, idx) => ({
      ...item,
      _effectiveOrder: item.loading_order ?? (idx + 1),
    }))
  }, [items])

  // Auto-assign loading_order on first access if any items lack it
  useEffect(() => {
    const needsAssign = items.some(i => i.loading_order == null)
    if (!needsAssign || items.length === 0) return

    async function assignLoadingOrder() {
      // Reverse order: last item in array = deliver first = load last
      const reversed = [...items].reverse()
      for (let i = 0; i < reversed.length; i++) {
        if (reversed[i].loading_order != null) continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('shipment_items') as any)
          .update({ loading_order: i + 1 })
          .eq('id', reversed[i].id)
        reversed[i].loading_order = i + 1
      }
    }
    assignLoadingOrder()
  }, [items])

  // Fetch SKU lines per doc_entry+origem
  const { data: skuByItem = new Map<string, SkuLine[]>() } = useQuery({
    queryKey: ['romaneio-sku-by-item', shipment.id],
    queryFn: async () => {
      if (items.length === 0) return new Map<string, SkuLine[]>()

      const docEntries = items.map(i => i.doc_entry)
      const origens = [...new Set(items.map(i => i.origem))]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('sap_cache_pedido_linhas') as any)
        .select('doc_entry, origem, item_code, descricao, quantidade')
        .in('doc_entry', docEntries)
        .in('origem', origens)

      if (error) throw error
      if (!data) return new Map<string, SkuLine[]>()

      // Group by shipment_item (match doc_entry+origem)
      const map = new Map<string, SkuLine[]>()
      for (const row of data as Array<{ doc_entry: number; origem: string; item_code: string; descricao: string; quantidade: number }>) {
        // Find shipment_item matching this doc_entry+origem
        const si = items.find(i => i.doc_entry === row.doc_entry && i.origem === row.origem)
        if (!si) continue
        const key = si.id
        const list = map.get(key) ?? []
        // Aggregate by item_code within this NF
        const existing = list.find(l => l.item_code === row.item_code)
        if (existing) {
          existing.quantidade += row.quantidade
        } else {
          list.push({ item_code: row.item_code, descricao: row.descricao, quantidade: row.quantidade })
        }
        map.set(key, list)
      }
      return map
    },
    staleTime: 5 * 60 * 1000,
  })

  // Aggregate all SKUs across all items (for Section A)
  const allSkuSummary = useMemo(() => {
    const map = new Map<string, SkuLine>()
    for (const [, lines] of skuByItem) {
      for (const line of lines) {
        const existing = map.get(line.item_code)
        if (existing) {
          existing.quantidade += line.quantidade
        } else {
          map.set(line.item_code, { ...line })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.item_code.localeCompare(b.item_code))
  }, [skuByItem])

  // Open dialog
  useEffect(() => {
    const el = dialogRef.current
    if (el && !el.open) el.showModal()
  }, [])

  // Load existing photo previews
  useEffect(() => {
    async function loadPreviews() {
      if (shipment.loading_photo_path) {
        const { data } = await supabase.storage.from('shipment-photos').createSignedUrl(shipment.loading_photo_path, 3600)
        if (data?.signedUrl) setDoorPreview(data.signedUrl)
      }
      if (shipment.seal_photo_path) {
        const { data } = await supabase.storage.from('shipment-photos').createSignedUrl(shipment.seal_photo_path, 3600)
        if (data?.signedUrl) setSealPreview(data.signedUrl)
      }
    }
    loadPreviews()
  }, [shipment.loading_photo_path, shipment.seal_photo_path])

  // Upload photo
  const uploadPhoto = useCallback(async (file: File, type: 'door' | 'seal') => {
    setLoadingPhoto(type)
    setError(null)
    try {
      const timestamp = Date.now()
      const path = `${shipment.id}/${type}_${timestamp}.jpg`

      const { error: uploadErr } = await supabase.storage
        .from('shipment-photos')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const updateField = type === 'door' ? 'loading_photo_path' : 'seal_photo_path'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('shipments') as any)
        .update({ [updateField]: path })
        .eq('id', shipment.id)

      const { data } = await supabase.storage.from('shipment-photos').createSignedUrl(path, 3600)
      const previewUrl = data?.signedUrl ?? URL.createObjectURL(file)

      if (type === 'door') {
        setDoorPhotoPath(path)
        setDoorPreview(previewUrl)
      } else {
        setSealPhotoPath(path)
        setSealPreview(previewUrl)
      }
    } catch (err) {
      setError(`Erro ao enviar foto: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    } finally {
      setLoadingPhoto(null)
    }
  }, [shipment.id])

  // Get pallets for a specific shipment_item
  const palletsForItem = useCallback(
    (itemId: string) => pallets.filter(p => p.shipment_item_id === itemId),
    [pallets]
  )

  // Pallet management (NF-oriented)
  const addPallet = (itemId: string) => {
    const itemPallets = pallets.filter(p => p.shipment_item_id === itemId)
    const skus = skuByItem.get(itemId) ?? []
    setPallets(prev => [
      ...prev,
      {
        number: itemPallets.length + 1,
        shipment_item_id: itemId,
        items: [{ item_code: skus[0]?.item_code ?? '', descricao: skus[0]?.descricao ?? '', quantidade: 0, lote: '' }],
      },
    ])
  }

  const removePallet = (palletIndex: number) => {
    setPallets(prev => {
      const removed = prev[palletIndex]
      const next = prev.filter((_, i) => i !== palletIndex)
      // Renumber pallets for this shipment_item
      let count = 0
      return next.map(p => {
        if (p.shipment_item_id === removed.shipment_item_id) {
          count++
          return { ...p, number: count }
        }
        return p
      })
    })
  }

  const addPalletLine = (palletIndex: number) => {
    setPallets(prev => prev.map((p, i) =>
      i === palletIndex
        ? { ...p, items: [...p.items, { item_code: '', descricao: '', quantidade: 0, lote: '' }] }
        : p
    ))
  }

  const removePalletLine = (palletIndex: number, lineIndex: number) => {
    setPallets(prev => prev.map((p, i) =>
      i === palletIndex
        ? { ...p, items: p.items.filter((_, li) => li !== lineIndex) }
        : p
    ))
  }

  const updatePalletLine = (palletIndex: number, lineIndex: number, field: string, value: string | number) => {
    setPallets(prev => prev.map((p, i) => {
      if (i !== palletIndex) return p
      const skus = skuByItem.get(p.shipment_item_id) ?? allSkuSummary
      const newItems = p.items.map((item, li) => {
        if (li !== lineIndex) return item
        if (field === 'item_code') {
          const sku = skus.find(s => s.item_code === value)
          return { ...item, item_code: value as string, descricao: sku?.descricao ?? '' }
        }
        return { ...item, [field]: value }
      })
      return { ...p, items: newItems }
    }))
  }

  // Move shipment to em_expedicao on first interaction
  const ensureEmExpedicao = useCallback(async () => {
    if (shipment.status === 'programada') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('shipments') as any)
        .update({ status: 'em_expedicao' })
        .eq('id', shipment.id)
      shipment.status = 'em_expedicao' as ShipmentRow['status']
    }
  }, [shipment])

  // Pallet totals per SKU (global)
  const palletSkuTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of pallets) {
      for (const item of p.items) {
        if (!item.item_code) continue
        map.set(item.item_code, (map.get(item.item_code) ?? 0) + item.quantidade)
      }
    }
    return map
  }, [pallets])

  // Pallet totals per SKU per shipment_item
  const palletSkuTotalsPerItem = useCallback((itemId: string) => {
    const map = new Map<string, number>()
    for (const p of pallets) {
      if (p.shipment_item_id !== itemId) continue
      for (const item of p.items) {
        if (!item.item_code) continue
        map.set(item.item_code, (map.get(item.item_code) ?? 0) + item.quantidade)
      }
    }
    return map
  }, [pallets])

  // Validation: every NF has at least 1 pallet
  const allNfsHavePallets = useMemo(() => {
    if (items.length === 0) return false
    return items.every(item =>
      pallets.some(p =>
        p.shipment_item_id === item.id &&
        p.items.some(i => i.item_code && i.quantidade > 0)
      )
    )
  }, [items, pallets])

  const hasDoorPhoto = !!doorPhotoPath
  const hasSealPhoto = !!sealPhotoPath
  const hasSealNumber = sealNumber.trim().length > 0
  const canExpedite = allNfsHavePallets && hasDoorPhoto && hasSealPhoto && hasSealNumber

  // Save pallets draft
  const savePalletsDraft = useCallback(async () => {
    await ensureEmExpedicao()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('shipments') as any)
      .update({ pallets_data: pallets, seal_number: sealNumber.trim() || null })
      .eq('id', shipment.id)
  }, [pallets, sealNumber, shipment.id, ensureEmExpedicao])

  // Expedite
  const handleExpedite = async () => {
    if (!canExpedite || !user) return
    setIsExpeding(true)
    setError(null)
    try {
      await ensureEmExpedicao()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase.from('shipments') as any)
        .update({
          status: 'expedida',
          pallets_data: pallets,
          seal_number: sealNumber.trim(),
          seal_photo_path: sealPhotoPath,
          loading_photo_path: doorPhotoPath,
          expedition_verified_by: user.id,
          expedition_verified_at: new Date().toISOString(),
        })
        .eq('id', shipment.id)
      if (updateErr) throw updateErr

      queryClient.invalidateQueries({ queryKey: ['romaneio-shipments'] })
      queryClient.invalidateQueries({ queryKey: ['romaneio-expedidas-hoje'] })
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      onClose()
    } catch (err) {
      setError(`Erro ao expedir: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    } finally {
      setIsExpeding(false)
    }
  }

  // Print romaneio (grouped by NF)
  const handlePrint = () => {
    const deliveryDate = format(new Date(shipment.delivery_date), "dd/MM/yyyy", { locale: ptBR })
    const sealLine = sealNumber ? `<div><span class="label">Lacre:</span> <span class="value">${sealNumber}</span></div>` : ''

    const nfSections = sortedItems.map(item => {
      const itemPallets = palletsForItem(item.id)
      const palletRows = itemPallets.flatMap(p =>
        p.items.map(line => `
          <tr>
            <td>${p.number}</td>
            <td>${line.item_code}</td>
            <td>${line.descricao}</td>
            <td class="right">${line.quantidade}</td>
            <td>${line.lote}</td>
          </tr>
        `)
      ).join('')

      return `
        <div style="margin-bottom: 16px;">
          <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">
            [${item._effectiveOrder}] ${item.origem} ${item.doc_num ?? item.doc_entry} — ${item.card_name} (${item.uf}) | ${formatNumber(item.weight_kg ?? 0)} kg
          </div>
          <table>
            <thead>
              <tr>
                <th>Palete</th>
                <th>Código</th>
                <th>Descrição</th>
                <th class="right">Qtd</th>
                <th>Lote</th>
              </tr>
            </thead>
            <tbody>
              ${palletRows || '<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum palete registrado</td></tr>'}
            </tbody>
          </table>
        </div>
      `
    }).join('')

    const totalPallets = pallets.length
    const totalWeight = items.reduce((s, i) => s + (i.weight_kg ?? 0), 0)

    const html = `
      <div style="text-align: center; margin-bottom: 16px;">
        <strong style="font-size: 16px;">MATA NORTE ALIMENTOS LTDA</strong><br/>
        <span style="font-size: 13px;">Romaneio de Saída</span>
      </div>
      <div class="header-grid">
        <div><span class="label">Referência:</span> <span class="value">${shipment.reference}</span></div>
        <div><span class="label">Data de Entrega:</span> <span class="value">${deliveryDate}</span></div>
        <div><span class="label">Veículo:</span> <span class="value">${shipment.vehicle?.plate ?? '-'} (${shipment.vehicle?.vehicle_type ?? '-'})</span></div>
        <div><span class="label">Motorista:</span> <span class="value">${shipment.driver?.name ?? '-'}</span></div>
        ${sealLine}
      </div>

      <h2 style="font-size: 13px; margin: 16px 0 8px; border-bottom: 1px solid #333; padding-bottom: 4px;">ORDEM DE CARREGAMENTO</h2>
      ${nfSections}

      <div style="margin-top: 12px; font-size: 12px;">
        <strong>TOTAIS:</strong> ${totalPallets} palete${totalPallets !== 1 ? 's' : ''} | ${formatNumber(totalWeight)} kg | ${formatCurrency(shipment.total_value)}
      </div>

      <div style="margin-top: 40px; display: flex; justify-content: space-between;">
        <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 4px; font-size: 11px;">
          Conferente
        </div>
        <div style="border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 4px; font-size: 11px;">
          Motorista
        </div>
      </div>
    `
    printContent(`Romaneio - ${shipment.reference}`, html)
  }

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

        {/* Section A — SKU Summary (global) */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Package size={20} className="text-primary" />
            Resumo de SKUs a Carregar
          </h3>
          {allSkuSummary.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-blue-200 bg-blue-50">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 text-left">
                      <th className="px-4 py-2 font-medium text-blue-800">Código</th>
                      <th className="px-4 py-2 font-medium text-blue-800">Descrição</th>
                      <th className="px-4 py-2 text-right font-medium text-blue-800">Qtd Total</th>
                      <th className="px-4 py-2 text-right font-medium text-blue-800">Paletizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSkuSummary.map(sku => {
                      const palletQty = palletSkuTotals.get(sku.item_code) ?? 0
                      const diff = palletQty - sku.quantidade
                      return (
                        <tr key={sku.item_code} className="border-b border-blue-100 last:border-0">
                          <td className="px-4 py-2 font-mono text-xs">{sku.item_code}</td>
                          <td className="px-4 py-2">{sku.descricao}</td>
                          <td className="px-4 py-2 text-right">{formatNumber(sku.quantidade)}</td>
                          <td className={cn(
                            'px-4 py-2 text-right font-medium',
                            diff === 0 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-red-700'
                          )}>
                            {formatNumber(palletQty)}
                            {diff !== 0 && (
                              <span className="ml-1 text-xs">
                                ({diff > 0 ? '+' : ''}{formatNumber(diff)})
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {allSkuSummary.some(sku => (palletSkuTotals.get(sku.item_code) ?? 0) > sku.quantidade) && (
                <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-800">
                  <AlertTriangle size={16} />
                  Atenção: quantidade paletizada excede o pedido em um ou mais SKUs
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Carregando resumo de SKUs...
            </div>
          )}
        </section>

        {/* Section B — NFs in Loading Order (accordion) */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 size={20} className="text-primary" />
            NFs em Ordem de Carregamento
            <span className="text-sm font-normal text-muted-foreground">
              ({items.length} {items.length === 1 ? 'NF' : 'NFs'})
            </span>
          </h3>

          <div className="space-y-3">
            {sortedItems.map((item) => {
              const itemId = item.id
              const isExpanded = expandedItemId === itemId
              const itemPallets = palletsForItem(itemId)
              const nfSkus = skuByItem.get(itemId) ?? []
              const itemPalletTotals = palletSkuTotalsPerItem(itemId)
              const registeredPallets = itemPallets.length

              // Progress by item quantity (sum of paletized qty vs expected qty)
              const totalExpected = nfSkus.reduce((s, sku) => s + sku.quantidade, 0)
              const totalPaletizado = [...itemPalletTotals.values()].reduce((s, v) => s + v, 0)
              const progress = totalExpected > 0
                ? Math.min((totalPaletizado / totalExpected) * 100, 100)
                : (totalPaletizado > 0 ? 100 : 0)

              const statusIcon = totalPaletizado === 0 ? '⚪' : totalPaletizado >= totalExpected ? '🟢' : '🟡'

              return (
                <div key={itemId} className="rounded-lg border border-border bg-card shadow-sm">
                  {/* NF Header (always visible) */}
                  <button
                    onClick={() => setExpandedItemId(isExpanded ? null : itemId)}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <div className="flex min-h-[44px] min-w-[44px] items-center justify-center">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                          {item._effectiveOrder}
                        </span>
                        <span className="text-base">{statusIcon}</span>
                        <span className="font-semibold">
                          {item.origem} {item.doc_num ?? item.doc_entry}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          — {item.card_name} ({item.uf})
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{formatNumber(item.weight_kg ?? 0)} kg</span>
                        <span>{formatNumber(totalPaletizado)}/{formatNumber(totalExpected)} un</span>
                        <span>{registeredPallets} palete{registeredPallets !== 1 ? 's' : ''}</span>
                        <span>{formatCurrency(item.doc_total)}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-1.5 rounded-full transition-all',
                            progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-amber-500' : 'bg-muted'
                          )}
                          style={{ width: `${Math.max(progress, 0)}%` }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-4">
                      {/* Excess alert for this NF */}
                      {nfSkus.some(sku => (itemPalletTotals.get(sku.item_code) ?? 0) > sku.quantidade) && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                          <AlertTriangle size={14} />
                          Quantidade paletizada excede o pedido em um ou mais SKUs
                        </div>
                      )}

                      {/* Mini SKU table for this NF */}
                      {nfSkus.length > 0 && (
                        <div className="overflow-x-auto rounded-md border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/40 text-left">
                                <th className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Código</th>
                                <th className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Descrição</th>
                                <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Esperado</th>
                                <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Paletizado</th>
                                <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Diferença</th>
                              </tr>
                            </thead>
                            <tbody>
                              {nfSkus.map(sku => {
                                const paletizado = itemPalletTotals.get(sku.item_code) ?? 0
                                const diff = paletizado - sku.quantidade
                                return (
                                  <tr key={sku.item_code} className="border-b border-border last:border-0">
                                    <td className="px-3 py-1.5 font-mono text-xs">{sku.item_code}</td>
                                    <td className="px-3 py-1.5 text-xs">{sku.descricao}</td>
                                    <td className="px-3 py-1.5 text-right text-xs">{formatNumber(sku.quantidade)}</td>
                                    <td className={cn(
                                      'px-3 py-1.5 text-right text-xs font-medium',
                                      diff === 0 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-red-700'
                                    )}>
                                      {formatNumber(paletizado)}
                                    </td>
                                    <td className={cn(
                                      'px-3 py-1.5 text-right text-xs font-medium',
                                      diff === 0 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-red-700'
                                    )}>
                                      {diff === 0 ? '—' : (diff > 0 ? '+' : '') + formatNumber(diff)}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Pallets registered for this NF */}
                      <div className="space-y-3">
                        {itemPallets.map((pallet) => {
                          const globalIndex = pallets.indexOf(pallet)
                          return (
                            <div key={globalIndex} className="rounded-md border border-border bg-muted/20">
                              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                                <span className="text-sm font-semibold">Palete #{pallet.number}</span>
                                <button
                                  onClick={() => removePallet(globalIndex)}
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                              <div className="space-y-3 p-4">
                                {pallet.items.map((line, li) => (
                                  <div key={li} className="flex flex-wrap items-end gap-2">
                                    <div className="min-w-[140px] flex-1">
                                      {li === 0 && <label className="mb-1 block text-xs text-muted-foreground">SKU</label>}
                                      <select
                                        value={line.item_code}
                                        onChange={e => updatePalletLine(globalIndex, li, 'item_code', e.target.value)}
                                        onFocus={ensureEmExpedicao}
                                        className="w-full rounded-md border border-border bg-white px-3 py-3 text-sm"
                                      >
                                        <option value="">Selecionar...</option>
                                        {(nfSkus.length > 0 ? nfSkus : allSkuSummary).map(sku => (
                                          <option key={sku.item_code} value={sku.item_code}>
                                            {sku.item_code} — {sku.descricao}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="w-24">
                                      {li === 0 && <label className="mb-1 block text-xs text-muted-foreground">Qtd</label>}
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        value={line.quantidade || ''}
                                        onChange={e => updatePalletLine(globalIndex, li, 'quantidade', Number(e.target.value))}
                                        onBlur={savePalletsDraft}
                                        className="w-full rounded-md border border-border bg-white px-3 py-3 text-sm"
                                        placeholder="0"
                                      />
                                    </div>
                                    <div className="min-w-[120px] flex-1">
                                      {li === 0 && <label className="mb-1 block text-xs text-muted-foreground">Lote</label>}
                                      <input
                                        type="text"
                                        value={line.lote}
                                        onChange={e => updatePalletLine(globalIndex, li, 'lote', e.target.value)}
                                        onBlur={savePalletsDraft}
                                        className="w-full rounded-md border border-border bg-white px-3 py-3 text-sm"
                                        placeholder="Ex: L2026-042"
                                      />
                                    </div>
                                    <button
                                      onClick={() => removePalletLine(globalIndex, li)}
                                      disabled={pallet.items.length <= 1}
                                      className={cn(
                                        'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md',
                                        pallet.items.length > 1
                                          ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
                                          : 'cursor-not-allowed text-transparent'
                                      )}
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => addPalletLine(globalIndex)}
                                  className="flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-2 text-sm text-primary hover:bg-blue-50"
                                >
                                  <Plus size={16} />
                                  Adicionar Linha
                                </button>
                              </div>
                            </div>
                          )
                        })}

                        {/* Add pallet for this NF */}
                        <button
                          onClick={() => addPallet(itemId)}
                          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
                        >
                          <Plus size={18} />
                          Adicionar Palete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Section C — Photos & Seal */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Camera size={20} className="text-primary" />
            Fotos e Lacre
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PhotoUpload
              label="Foto Porta Traseira Aberta"
              previewUrl={doorPreview}
              isLoading={loadingPhoto === 'door'}
              onUpload={file => uploadPhoto(file, 'door')}
            />
            <PhotoUpload
              label="Foto do Lacre"
              previewUrl={sealPreview}
              isLoading={loadingPhoto === 'seal'}
              onUpload={file => uploadPhoto(file, 'seal')}
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
              <Lock size={16} className="text-primary" />
              Número do Lacre
            </label>
            <input
              type="text"
              value={sealNumber}
              onChange={e => setSealNumber(e.target.value)}
              onBlur={savePalletsDraft}
              placeholder="Ex: 123456"
              className="w-full rounded-md border border-border bg-white px-4 py-3 text-lg font-mono placeholder:text-muted-foreground/50 sm:w-80"
            />
          </div>
        </section>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {/* Section D — Actions */}
        <section className="border-t border-border pt-4">
          {!canExpedite && (
            <div className="mb-4 space-y-1 text-sm text-muted-foreground">
              {!allNfsHavePallets && (
                <p className="flex items-center gap-1.5">
                  <Package size={14} className="text-amber-500" />
                  Cada NF precisa de pelo menos 1 palete
                </p>
              )}
              {!hasDoorPhoto && (
                <p className="flex items-center gap-1.5">
                  <Camera size={14} className="text-amber-500" />
                  Envie a foto da porta traseira aberta
                </p>
              )}
              {!hasSealPhoto && (
                <p className="flex items-center gap-1.5">
                  <Camera size={14} className="text-amber-500" />
                  Envie a foto do lacre
                </p>
              )}
              {!hasSealNumber && (
                <p className="flex items-center gap-1.5">
                  <Lock size={14} className="text-amber-500" />
                  Preencha o número do lacre
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExpedite}
              disabled={!canExpedite || isExpeding}
              className={cn(
                'flex min-h-[44px] items-center gap-2 rounded-md px-6 py-2.5 text-sm font-medium text-white transition-colors',
                canExpedite && !isExpeding
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'cursor-not-allowed bg-gray-400'
              )}
            >
              {isExpeding ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              Expedir Carga
            </button>

            <button
              onClick={handlePrint}
              className="flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Printer size={18} />
              Imprimir Romaneio
            </button>
          </div>
        </section>
      </div>
    </dialog>
  )
}

// ---------------------------------------------------------------------------
// Photo upload sub-component
// ---------------------------------------------------------------------------
function PhotoUpload({
  label,
  previewUrl,
  isLoading,
  onUpload,
}: {
  label: string
  previewUrl: string | null
  isLoading: boolean
  onUpload: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium">{label}</p>
      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt={label}
            className="h-40 w-full rounded-md object-cover"
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute right-2 top-2 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80"
          >
            <Camera size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
        >
          {isLoading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <>
              <Upload size={24} />
              <span className="text-sm">Tirar foto ou selecionar</span>
            </>
          )}
        </button>
      )}
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
    </div>
  )
}
