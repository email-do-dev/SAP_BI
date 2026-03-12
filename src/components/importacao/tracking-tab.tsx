import { useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useImportTrackingEvents, useAddTrackingEvent } from '@/hooks/use-import-queries'
import { useAuth } from '@/contexts/auth-context'

interface TrackingTabProps {
  processId: string
  readOnly?: boolean
}

export function TrackingTab({ processId, readOnly }: TrackingTabProps) {
  const { data: events = [], isLoading } = useImportTrackingEvents(processId)
  const addEvent = useAddTrackingEvent()
  const { hasRole } = useAuth()
  const canEdit = !readOnly && (hasRole('diretoria') || hasRole('importacao'))

  const [showForm, setShowForm] = useState(false)
  const [desc, setDesc] = useState('')
  const [location, setLocation] = useState('')
  const [vessel, setVessel] = useState('')
  const [eventDate, setEventDate] = useState('')

  const handleAdd = async () => {
    if (!desc.trim()) return
    await addEvent.mutateAsync({
      process_id: processId,
      description: desc.trim(),
      location: location.trim() || undefined,
      vessel: vessel.trim() || undefined,
      event_date: eventDate || undefined,
    })
    setDesc('')
    setLocation('')
    setVessel('')
    setEventDate('')
    setShowForm(false)
  }

  const inputCls = 'w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
            <Plus size={14} /> Adicionar Evento
          </button>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição *</label>
              <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data/Hora</label>
              <input type="datetime-local" className={inputCls} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Local</label>
              <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Navio</label>
              <input className={inputCls} value={vessel} onChange={(e) => setVessel(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">Cancelar</button>
            <button onClick={handleAdd} disabled={addEvent.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {addEvent.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>}

      {!isLoading && events.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">Nenhum evento de rastreamento registrado.</div>
      )}

      {events.length > 0 && (
        <div className="relative ml-4 border-l-2 border-border pl-6 space-y-4">
          {events.map((ev) => (
            <div key={ev.id} className="relative">
              <div className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-card">
                <MapPin size={8} className="text-primary" />
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{ev.description}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {format(parseISO(ev.event_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {(ev.location || ev.vessel) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ev.location && <span>{ev.location}</span>}
                    {ev.location && ev.vessel && <span> • </span>}
                    {ev.vessel && <span>Navio: {ev.vessel}</span>}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
