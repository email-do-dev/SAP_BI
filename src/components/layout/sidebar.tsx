import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  RotateCcw,
  DollarSign,
  Users,
  Ship,
  Factory,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import type { AppRole } from '@/types/database'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: AppRole[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard size={20} /> },
  { label: 'Comercial', href: '/comercial', icon: <ShoppingCart size={20} />, roles: ['diretoria', 'comercial'] },
  { label: 'Logística', href: '/logistica', icon: <Truck size={20} />, roles: ['diretoria', 'logistica'] },
  { label: 'Produção', href: '/producao', icon: <Factory size={20} />, roles: ['diretoria', 'producao'] },
  { label: 'Devoluções', href: '/devolucoes', icon: <RotateCcw size={20} />, roles: ['diretoria', 'comercial', 'financeiro'] },
  { label: 'Custo Logístico', href: '/custo-logistico', icon: <DollarSign size={20} />, roles: ['diretoria', 'logistica', 'financeiro'] },
  { label: 'Importações', href: '/importacao', icon: <Ship size={20} />, roles: ['diretoria', 'importacao', 'financeiro'] },
  { label: 'Usuários', href: '/usuarios', icon: <Users size={20} />, roles: ['diretoria'] },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { roles, signOut, user } = useAuth()

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r))
  )

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-card transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed && <span className="text-sm font-bold text-primary">SAP BI</span>}
        <button
          onClick={onToggle}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        {!collapsed && user && (
          <p className="mb-2 truncate px-3 text-xs text-muted-foreground">{user.email}</p>
        )}
        <button
          onClick={async () => {
            try { await signOut() } catch { /* auth state change handles cleanup */ }
          }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOut size={20} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
