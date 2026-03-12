import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { INCOTERMS, CURRENCIES } from '@/lib/import-constants'
import { formatCurrency } from '@/lib/utils'

interface ItemRow {
  description: string
  ncm: string
  quantity: number
  unit: string
  unit_price: number
  gross_weight: number | null
  net_weight: number | null
}

interface ProcessFormData {
  supplier: string
  incoterm: string
  currency: string
  exchange_rate: number
  container_number: string
  vessel: string
  port_origin: string
  port_destination: string
  free_time_days: number
  daily_demurrage_rate: number
  etd: string
  eta: string
  notes: string
  items: ItemRow[]
}

interface ProcessFormProps {
  onSubmit: (data: ProcessFormData) => void
  isSubmitting?: boolean
}

const emptyItem: ItemRow = { description: '', ncm: '', quantity: 0, unit: 'KG', unit_price: 0, gross_weight: null, net_weight: null }

export function ProcessForm({ onSubmit, isSubmitting }: ProcessFormProps) {
  const [form, setForm] = useState<ProcessFormData>({
    supplier: '',
    incoterm: 'FOB',
    currency: 'USD',
    exchange_rate: 5.0,
    container_number: '',
    vessel: '',
    port_origin: '',
    port_destination: 'Suape',
    free_time_days: 14,
    daily_demurrage_rate: 0,
    etd: '',
    eta: '',
    notes: '',
    items: [{ ...emptyItem }],
  })

  const set = <K extends keyof ProcessFormData>(key: K, val: ProcessFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const setItem = (idx: number, key: keyof ItemRow, val: string | number | null) =>
    setForm((prev) => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [key]: val }
      return { ...prev, items }
    })

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }))
  const removeItem = (idx: number) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const totalFob = form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.supplier.trim()) return
    onSubmit(form)
  }

  const inputCls = 'w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'text-sm font-medium text-muted-foreground'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Supplier & Commercial */}
      <section>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Dados Comerciais</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Fornecedor *</label>
            <input className={inputCls} value={form.supplier} onChange={(e) => set('supplier', e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Incoterm</label>
            <select className={inputCls} value={form.incoterm} onChange={(e) => set('incoterm', e.target.value)}>
              {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Moeda</label>
            <select className={inputCls} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Taxa de Câmbio</label>
            <input type="number" step="0.0001" className={inputCls} value={form.exchange_rate} onChange={(e) => set('exchange_rate', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelCls}>ETD</label>
            <input type="date" className={inputCls} value={form.etd} onChange={(e) => set('etd', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>ETA</label>
            <input type="date" className={inputCls} value={form.eta} onChange={(e) => set('eta', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Logistics */}
      <section>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Dados Logísticos</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Container</label>
            <input className={inputCls} value={form.container_number} onChange={(e) => set('container_number', e.target.value)} placeholder="Ex: MSKU1234567" />
          </div>
          <div>
            <label className={labelCls}>Navio</label>
            <input className={inputCls} value={form.vessel} onChange={(e) => set('vessel', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Porto Origem</label>
            <input className={inputCls} value={form.port_origin} onChange={(e) => set('port_origin', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Porto Destino</label>
            <input className={inputCls} value={form.port_destination} onChange={(e) => set('port_destination', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Free Time (dias)</label>
            <input type="number" className={inputCls} value={form.free_time_days} onChange={(e) => set('free_time_days', parseInt(e.target.value) || 14)} />
          </div>
          <div>
            <label className={labelCls}>Demurrage Diário (USD)</label>
            <input type="number" step="0.01" className={inputCls} value={form.daily_demurrage_rate} onChange={(e) => set('daily_demurrage_rate', parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </section>

      {/* Items */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Itens</h3>
          <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
            <Plus size={14} /> Adicionar
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">NCM</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qtd</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Un</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Preço Unit.</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={idx} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5">
                    <input className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring" value={item.description} onChange={(e) => setItem(idx, 'description', e.target.value)} required />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className="w-24 rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring" value={item.ncm} onChange={(e) => setItem(idx, 'ncm', e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.001" className="w-24 rounded border border-border bg-transparent px-2 py-1 text-right text-sm outline-none focus:ring-1 focus:ring-ring" value={item.quantity || ''} onChange={(e) => setItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className="w-16 rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring" value={item.unit} onChange={(e) => setItem(idx, 'unit', e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.0001" className="w-28 rounded border border-border bg-transparent px-2 py-1 text-right text-sm outline-none focus:ring-1 focus:ring-ring" value={item.unit_price || ''} onChange={(e) => setItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm font-medium">
                    {form.currency} {(item.quantity * item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1.5">
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-muted/30">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold">Total FOB:</td>
                <td className="px-2 py-2 text-right text-sm font-semibold">
                  {form.currency} {totalFob.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={5} className="px-3 py-1 text-right text-xs text-muted-foreground">Estimativa BRL:</td>
                <td className="px-2 py-1 text-right text-xs text-muted-foreground">
                  {formatCurrency(totalFob * form.exchange_rate)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Notes */}
      <section>
        <label className={labelCls}>Observações</label>
        <textarea className={inputCls + ' mt-1 min-h-[80px]'} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting} className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
          {isSubmitting ? 'Criando...' : 'Criar Processo'}
        </button>
      </div>
    </form>
  )
}
