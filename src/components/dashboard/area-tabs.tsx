import { TrendingUp, ShoppingCart, Landmark, Factory, Truck, Package, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import type { DashboardArea } from '@/hooks/use-dashboard-filters'
import type { AppRole } from '@/types/database'

interface AreaTabsProps {
  selected: DashboardArea
  onChange: (area: DashboardArea) => void
}

const TABS: { id: DashboardArea; label: string; icon: React.ReactNode; roles: AppRole[] }[] = [
  { id: 'geral', label: 'Visão Geral', icon: <TrendingUp size={16} />, roles: ['diretoria', 'comercial', 'logistica', 'financeiro'] },
  { id: 'comercial', label: 'Comercial', icon: <ShoppingCart size={16} />, roles: ['diretoria', 'comercial'] },
  { id: 'financeiro', label: 'Financeiro', icon: <Landmark size={16} />, roles: ['diretoria', 'financeiro'] },
  { id: 'producao', label: 'Produção', icon: <Factory size={16} />, roles: ['diretoria', 'producao'] },
  { id: 'logistica', label: 'Logística', icon: <Truck size={16} />, roles: ['diretoria', 'logistica'] },
  { id: 'estoque', label: 'Estoque', icon: <Package size={16} />, roles: ['diretoria'] },
  { id: 'compras', label: 'Compras', icon: <ShoppingBag size={16} />, roles: ['diretoria', 'financeiro'] },
]

export function AreaTabs({ selected, onChange }: AreaTabsProps) {
  const { roles } = useAuth()

  const visibleTabs = TABS.filter((t) => t.roles.some((r) => roles.includes(r)))

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
            selected === tab.id
              ? 'border-b-2 border-primary bg-card text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
