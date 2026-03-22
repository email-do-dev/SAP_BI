import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Truck, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOGISTICS_TABS, type LogisticsTab } from '@/lib/logistics-constants'
import { CadastrosLogistica } from '@/components/logistica/cadastros-logistica'
import { TabProgramacao } from '@/components/logistica/tab-programacao'
import { TabRomaneio } from '@/components/logistica/tab-romaneio'
import { TabAcompanhamento } from '@/components/logistica/tab-acompanhamento'
import { TabDescarrego } from '@/components/logistica/tab-descarrego'
import { Dialog } from '@/components/shared/dialog'

// ---------------------------------------------------------------------------
// Tab descriptions for placeholder cards
// ---------------------------------------------------------------------------
const TAB_DESCRIPTIONS: Record<LogisticsTab, string> = {
  programacao: 'Programacao de carregamentos e entregas. Defina rotas, veiculos e motoristas.',
  romaneio: 'Romaneio de saida com detalhamento de notas fiscais, volumes e pesos por veiculo.',
  acompanhamento: 'Acompanhamento em tempo real das entregas em transito.',
  descarrego: 'Registro de descarrego e conferencia de entregas realizadas.',
  devolucoes: 'Gestao de devolucoes, motivos e reentrada no estoque.',
  custo: 'Analise de custo logistico por rota, veiculo e operador.',
}

// ---------------------------------------------------------------------------
// Placeholder card for tabs not yet implemented
// ---------------------------------------------------------------------------
function TabPlaceholder({ tabId, label }: { tabId: LogisticsTab; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{label}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {TAB_DESCRIPTIONS[tabId]}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-16">
        <p className="text-base font-medium text-muted-foreground">
          Em desenvolvimento
        </p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Este modulo sera implementado em breve.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab content resolver
// ---------------------------------------------------------------------------
function TabContent({ tab }: { tab: LogisticsTab }) {
  if (tab === 'programacao') return <TabProgramacao />
  if (tab === 'romaneio') return <TabRomaneio />
  if (tab === 'acompanhamento') return <TabAcompanhamento />
  if (tab === 'descarrego') return <TabDescarrego />

  const tabConfig = LOGISTICS_TABS.find((t) => t.id === tab)
  const label = tabConfig?.label ?? tab
  return <TabPlaceholder tabId={tab} label={label} />
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function LogisticaPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [cadastrosOpen, setCadastrosOpen] = useState(false)

  const rawTab = searchParams.get('tab') ?? 'programacao'
  const activeTab: LogisticsTab = LOGISTICS_TABS.some((t) => t.id === rawTab)
    ? (rawTab as LogisticsTab)
    : 'programacao'

  function setActiveTab(tab: LogisticsTab) {
    setSearchParams({ tab }, { replace: true })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={24} className="text-primary" />
          <h1 className="text-2xl font-bold">Logistica</h1>
        </div>
        <button
          onClick={() => setCadastrosOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings size={16} />
          Cadastros
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {LOGISTICS_TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === t.id
                  ? 'border-b-2 border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      <TabContent tab={activeTab} />

      {/* Cadastros dialog */}
      <Dialog
        open={cadastrosOpen}
        onClose={() => setCadastrosOpen(false)}
        title="Cadastros de Logistica"
        className="max-w-4xl"
      >
        <CadastrosLogistica />
      </Dialog>
    </div>
  )
}
