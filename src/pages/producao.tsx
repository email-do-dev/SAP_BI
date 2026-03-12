import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Factory, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRODUCTION_TABS, type ProductionTab } from '@/lib/production-constants'
import { CadastrosProducao } from '@/components/producao/cadastros-producao'
import { TabDashboard } from '@/components/producao/tab-dashboard'
import { TabOrdens } from '@/components/producao/tab-ordens'
import { TabPcp } from '@/components/producao/tab-pcp'
import { Dialog } from '@/components/shared/dialog'

// ---------------------------------------------------------------------------
// Tab content resolver
// ---------------------------------------------------------------------------
function TabContent({ tab }: { tab: ProductionTab }) {
  if (tab === 'dashboard') return <TabDashboard />
  if (tab === 'ordens') return <TabOrdens />
  if (tab === 'pcp') return <TabPcp />

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-16">
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
// Main page
// ---------------------------------------------------------------------------
export default function ProducaoPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [cadastrosOpen, setCadastrosOpen] = useState(false)

  const rawTab = searchParams.get('tab') ?? 'dashboard'
  const activeTab: ProductionTab = PRODUCTION_TABS.some((t) => t.id === rawTab)
    ? (rawTab as ProductionTab)
    : 'dashboard'

  function setActiveTab(tab: ProductionTab) {
    setSearchParams({ tab }, { replace: true })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory size={24} className="text-primary" />
          <h1 className="text-2xl font-bold">Producao</h1>
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
        {PRODUCTION_TABS.map((t) => {
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
        title="Cadastros de Producao"
        className="max-w-4xl"
      >
        <CadastrosProducao />
      </Dialog>
    </div>
  )
}
