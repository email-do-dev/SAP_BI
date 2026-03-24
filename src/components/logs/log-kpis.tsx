import { Activity, AlertTriangle, RefreshCw, Cpu, Shield } from 'lucide-react'

interface LogKpisProps {
  auditCount: number
  errorCount: number
  syncCount: number
  edgeCount: number
  securityCount: number
  syncErrors: number
  edgeErrors: number
}

function KpiMini({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: number; alert?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${alert ? 'text-red-600' : ''}`}>{value.toLocaleString('pt-BR')}</p>
      </div>
    </div>
  )
}

export function LogKpis({ auditCount, errorCount, syncCount, edgeCount, securityCount, syncErrors, edgeErrors }: LogKpisProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiMini icon={<Activity size={20} />} label="Atividades" value={auditCount} />
      <KpiMini icon={<AlertTriangle size={20} />} label="Erros Frontend" value={errorCount} alert={errorCount > 0} />
      <KpiMini icon={<RefreshCw size={20} />} label={`Syncs (${syncErrors} erros)`} value={syncCount} alert={syncErrors > 0} />
      <KpiMini icon={<Cpu size={20} />} label={`Edge Fn (${edgeErrors} erros)`} value={edgeCount} alert={edgeErrors > 0} />
      <KpiMini icon={<Shield size={20} />} label="Segurança" value={securityCount} />
    </div>
  )
}
