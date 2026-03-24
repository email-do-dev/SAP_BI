import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ProcessForm } from '@/components/importacao/process-form'
import { useCreateProcess } from '@/hooks/use-import-queries'
import { useAuth } from '@/contexts/auth-context'
import { usePageView } from '@/hooks/use-activity-log'

export default function ImportacaoNovoPage() {
  usePageView('importacao/novo')
  const navigate = useNavigate()
  const { user } = useAuth()
  const createProcess = useCreateProcess()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/importacao')} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Novo Processo de Importação</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <ProcessForm
          isSubmitting={createProcess.isPending}
          onSubmit={async (data) => {
            const proc = await createProcess.mutateAsync({
              process: {
                supplier: data.supplier,
                incoterm: data.incoterm,
                currency: data.currency,
                exchange_rate: data.exchange_rate,
                container_number: data.container_number || undefined,
                vessel: data.vessel || undefined,
                port_origin: data.port_origin || undefined,
                port_destination: data.port_destination || undefined,
                free_time_days: data.free_time_days,
                daily_demurrage_rate: data.daily_demurrage_rate,
                etd: data.etd || undefined,
                eta: data.eta || undefined,
                notes: data.notes || undefined,
                created_by: user?.id,
              },
              items: data.items.filter((i) => i.description.trim()).map((i) => ({
                description: i.description,
                ncm: i.ncm || undefined,
                quantity: i.quantity,
                unit: i.unit,
                unit_price: i.unit_price,
                gross_weight: i.gross_weight,
                net_weight: i.net_weight,
              })),
            })
            navigate(`/importacao/${proc.id}`)
          }}
        />
      </div>
    </div>
  )
}
