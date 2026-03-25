import { useState, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePageView } from '@/hooks/use-activity-log'
import {
  DollarSign,
  Truck,
  TrendingUp,
  Percent,
  Calculator,
  FileText,
  Package,
  Settings,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { KpiCard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/shared/data-table'
import { Dialog } from '@/components/shared/dialog'
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from '@/components/shared/loading-skeleton'
import { RefreshIndicator } from '@/components/shared/refresh-indicator'
import { useCacheQuery, useSapQuery } from '@/hooks/use-sap-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { Database } from '@/types/database'

type CustoMensal = Database['public']['Tables']['sap_cache_custo_logistico']['Row']
type LogisticsCost = Database['public']['Tables']['logistics_costs']['Row']
type Entrega = Database['public']['Tables']['sap_cache_entregas']['Row']

interface DeliveryCostSummary {
  doc_entry: number
  doc_num: number
  card_name: string
  doc_total: number
  frete_proprio: number
  frete_terceiro: number
  descarga: number
  total_cost: number
  cost_pct: number
}

interface FornecedorNota {
  DocEntry: number
  DocNum: number
  CardName: string
  DocTotal: number
  DocDate: string
}

const PIE_COLORS = ['#1e40af', '#f59e0b', '#10b981']
const col = createColumnHelper<DeliveryCostSummary>()

export default function CustoLogisticoPage() {
  usePageView('custo-logistico')
  const queryClient = useQueryClient()
  const { user, hasRole } = useAuth()
  const [routeDialog, setRouteDialog] = useState<Entrega | null>(null)
  const [associateDialog, setAssociateDialog] = useState<Entrega | null>(null)
  const [descargaDialog, setDescargaDialog] = useState<Entrega | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [descargaAmount, setDescargaAmount] = useState('')
  const [descargaDesc, setDescargaDesc] = useState('')

  // Cache data
  const { data: custoMensal, isLoading: custoLoading, error: custoError } = useCacheQuery<CustoMensal[]>(
    'sap_cache_custo_logistico',
    { order: 'mes', limit: 12 }
  )

  const { data: entregas } = useCacheQuery<Entrega[]>('sap_cache_entregas', { order: 'doc_date', limit: 500 })

  const { data: costs } = useQuery({
    queryKey: ['logistics_costs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('logistics_costs').select('*')
      if (error) throw error
      return data as LogisticsCost[]
    },
  })

  const { data: settings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*')
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Object.fromEntries((data ?? []).map((s: any) => [s.key, s.value])) as Record<string, string>
    },
  })

  const { data: fornecedorNotas } = useSapQuery<FornecedorNota[]>({
    queryName: 'fornecedor_notas',
    enabled: !!associateDialog,
  })

  // Settings mutation
  const [custoKm, setCustoKm] = useState('')
  const [warehouseAddr, setWarehouseAddr] = useState('')

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase.from('app_settings').upsert({
        key,
        value,
        updated_by: user?.id ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app_settings'] }),
  })

  // Route calculation
  const calcRoute = useMutation({
    mutationFn: async (delivery: Entrega) => {
      const { data, error } = await supabase.functions.invoke('route-calc', {
        body: { delivery_doc_entry: delivery.doc_entry },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics_costs'] })
      setRouteDialog(null)
    },
  })

  // Associate OPCH
  const associateCost = useMutation({
    mutationFn: async ({ deliveryDocEntry, opchDocEntry, amount }: { deliveryDocEntry: number; opchDocEntry: number; amount: number }) => {
      const { error } = await supabase.from('logistics_costs').insert({
        delivery_doc_entry: deliveryDocEntry,
        cost_type: 'frete_terceiro',
        amount,
        source: 'sap',
        opch_doc_entry: opchDocEntry,
        created_by: user?.id ?? '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics_costs'] })
      setAssociateDialog(null)
    },
  })

  // Manual descarga
  const addDescarga = useMutation({
    mutationFn: async ({ deliveryDocEntry, amount, description }: { deliveryDocEntry: number; amount: number; description: string }) => {
      const { error } = await supabase.from('logistics_costs').insert({
        delivery_doc_entry: deliveryDocEntry,
        cost_type: 'descarga',
        amount,
        description: description || null,
        source: 'manual',
        created_by: user?.id ?? '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics_costs'] })
      setDescargaDialog(null)
      setDescargaAmount('')
      setDescargaDesc('')
    },
  })

  // Computed summaries
  const deliverySummaries = useMemo((): DeliveryCostSummary[] => {
    if (!entregas || !costs) return []
    return entregas.map((e) => {
      const eCosts = costs.filter((c) => c.delivery_doc_entry === e.doc_entry)
      const frete_proprio = eCosts.filter((c) => c.cost_type === 'frete_proprio').reduce((s, c) => s + c.amount, 0)
      const frete_terceiro = eCosts.filter((c) => c.cost_type === 'frete_terceiro').reduce((s, c) => s + c.amount, 0)
      const descarga = eCosts.filter((c) => c.cost_type === 'descarga').reduce((s, c) => s + c.amount, 0)
      const total_cost = frete_proprio + frete_terceiro + descarga
      return {
        doc_entry: e.doc_entry,
        doc_num: e.doc_num,
        card_name: e.card_name,
        doc_total: e.doc_total,
        frete_proprio,
        frete_terceiro,
        descarga,
        total_cost,
        cost_pct: e.doc_total > 0 ? (total_cost / e.doc_total) * 100 : 0,
      }
    })
  }, [entregas, costs])

  const kpiData = useMemo(() => {
    const totalCost = deliverySummaries.reduce((s, d) => s + d.total_cost, 0)
    const withCost = deliverySummaries.filter((d) => d.total_cost > 0)
    const avgCost = withCost.length > 0 ? totalCost / withCost.length : 0
    const totalRevenue = deliverySummaries.reduce((s, d) => s + d.doc_total, 0)
    const costPct = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0
    const breakdown = {
      frete_proprio: deliverySummaries.reduce((s, d) => s + d.frete_proprio, 0),
      frete_terceiro: deliverySummaries.reduce((s, d) => s + d.frete_terceiro, 0),
      descarga: deliverySummaries.reduce((s, d) => s + d.descarga, 0),
    }
    return { totalCost, avgCost, costPct, breakdown }
  }, [deliverySummaries])

  const pieData = [
    { name: 'Frete Próprio', value: kpiData.breakdown.frete_proprio },
    { name: 'Frete Terceiro', value: kpiData.breakdown.frete_terceiro },
    { name: 'Descarga', value: kpiData.breakdown.descarga },
  ].filter((d) => d.value > 0)

  const columns = useMemo(
    () => [
      col.accessor('doc_num', { header: 'Nº Entrega', size: 100 }),
      col.accessor('card_name', { header: 'Cliente' }),
      col.accessor('doc_total', { header: 'Valor Entrega', cell: (info) => formatCurrency(info.getValue()), size: 130 }),
      col.accessor('frete_proprio', { header: 'Frete Próprio', cell: (info) => formatCurrency(info.getValue()), size: 120 }),
      col.accessor('frete_terceiro', { header: 'Frete Terceiro', cell: (info) => formatCurrency(info.getValue()), size: 120 }),
      col.accessor('descarga', { header: 'Descarga', cell: (info) => formatCurrency(info.getValue()), size: 100 }),
      col.accessor('total_cost', { header: 'Custo Total', cell: (info) => formatCurrency(info.getValue()), size: 120 }),
      col.accessor('cost_pct', { header: '% Custo', cell: (info) => formatPercent(info.getValue()), size: 80 }),
      col.display({
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => {
          const entrega = entregas?.find((e) => e.doc_entry === row.original.doc_entry)
          if (!entrega) return null
          return (
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setRouteDialog(entrega) }}
                className="rounded p-1 text-primary hover:bg-primary/10"
                title="Calcular Rota"
              >
                <Calculator size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setAssociateDialog(entrega) }}
                className="rounded p-1 text-primary hover:bg-primary/10"
                title="Associar NF"
              >
                <FileText size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDescargaDialog(entrega) }}
                className="rounded p-1 text-primary hover:bg-primary/10"
                title="Adicionar Descarga"
              >
                <Package size={16} />
              </button>
            </div>
          )
        },
        size: 120,
      }),
    ],
    [entregas]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Custo Logístico</h1>
        <div className="flex items-center gap-4">
          <RefreshIndicator refreshedAt={custoMensal?.[0]?.refreshed_at} />
          {hasRole('diretoria') && (
            <button
              onClick={() => {
                setCustoKm(settings?.custo_km ?? '3.50')
                setWarehouseAddr(settings?.warehouse_address ?? '')
                setSettingsOpen(true)
              }}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Settings size={16} />
              Configurações
            </button>
          )}
        </div>
      </div>

      {custoError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Erro ao carregar dados: {custoError.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {custoLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard title="Custo Total (mês)" value={formatCurrency(kpiData.totalCost)} icon={<DollarSign size={20} />} />
            <KpiCard title="Custo Médio/Entrega" value={formatCurrency(kpiData.avgCost)} icon={<Truck size={20} />} />
            <KpiCard
              title="Breakdown"
              value={`P:${formatNumber(kpiData.breakdown.frete_proprio)} T:${formatNumber(kpiData.breakdown.frete_terceiro)} D:${formatNumber(kpiData.breakdown.descarga)}`}
              icon={<TrendingUp size={20} />}
            />
            <KpiCard title="% do Faturamento" value={formatPercent(kpiData.costPct)} icon={<Percent size={20} />} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Breakdown por Tipo</h2>
          {pieData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sem dados de custo</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Custo Mensal</h2>
          {custoLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={custoMensal ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="custo_total" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {!entregas ? (
        <TableSkeleton rows={10} />
      ) : (
        <DataTable
          data={deliverySummaries}
          columns={columns}
          searchPlaceholder="Buscar por cliente..."
          searchColumn="card_name"
        />
      )}

      {/* Route Calculation Dialog */}
      <Dialog open={!!routeDialog} onClose={() => setRouteDialog(null)} title="Calcular Rota">
        {routeDialog && (
          <div className="space-y-4">
            <p className="text-sm">
              Calcular rota para entrega <strong>{routeDialog.doc_num}</strong> — {routeDialog.card_name}
            </p>
            <p className="text-sm text-muted-foreground">
              R$/km: <strong>{settings?.custo_km ?? '3.50'}</strong>
            </p>
            <button
              onClick={() => calcRoute.mutate(routeDialog)}
              disabled={calcRoute.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {calcRoute.isPending ? 'Calculando...' : 'Calcular Rota'}
            </button>
            {calcRoute.isError && (
              <p className="text-sm text-destructive">Erro ao calcular rota. Tente novamente.</p>
            )}
          </div>
        )}
      </Dialog>

      {/* Associate OPCH Dialog */}
      <Dialog open={!!associateDialog} onClose={() => setAssociateDialog(null)} title="Associar Nota Fiscal de Frete">
        {associateDialog && (
          <div className="space-y-4">
            <p className="text-sm">
              Associar NF de fornecedor à entrega <strong>{associateDialog.doc_num}</strong>
            </p>
            <div className="max-h-64 overflow-y-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground">Nº NF</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Fornecedor</th>
                    <th className="px-3 py-2 text-right text-muted-foreground">Valor</th>
                    <th className="px-3 py-2 text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {(fornecedorNotas ?? []).map((nf) => (
                    <tr key={nf.DocEntry} className="border-b last:border-0">
                      <td className="px-3 py-2">{nf.DocNum}</td>
                      <td className="px-3 py-2">{nf.CardName}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(nf.DocTotal)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => associateCost.mutate({
                            deliveryDocEntry: associateDialog.doc_entry,
                            opchDocEntry: nf.DocEntry,
                            amount: nf.DocTotal,
                          })}
                          disabled={associateCost.isPending}
                          className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          Associar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!fornecedorNotas || fornecedorNotas.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhuma NF de fornecedor encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Dialog>

      {/* Descarga Dialog */}
      <Dialog open={!!descargaDialog} onClose={() => setDescargaDialog(null)} title="Adicionar Custo de Descarga">
        {descargaDialog && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addDescarga.mutate({
                deliveryDocEntry: descargaDialog.doc_entry,
                amount: parseFloat(descargaAmount),
                description: descargaDesc,
              })
            }}
            className="space-y-4"
          >
            <p className="text-sm">
              Entrega <strong>{descargaDialog.doc_num}</strong> — {descargaDialog.card_name}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={descargaAmount}
                onChange={(e) => setDescargaAmount(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <input
                type="text"
                value={descargaDesc}
                onChange={(e) => setDescargaDesc(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={addDescarga.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {addDescarga.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        )}
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Configurações de Custo">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await updateSetting.mutateAsync({ key: 'custo_km', value: custoKm })
            await updateSetting.mutateAsync({ key: 'warehouse_address', value: warehouseAddr })
            setSettingsOpen(false)
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Custo por km (R$)</label>
            <input
              type="number"
              step="0.01"
              required
              value={custoKm}
              onChange={(e) => setCustoKm(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Endereço do Armazém</label>
            <input
              type="text"
              required
              value={warehouseAddr}
              onChange={(e) => setWarehouseAddr(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={updateSetting.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateSetting.isPending ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </form>
      </Dialog>
    </div>
  )
}
