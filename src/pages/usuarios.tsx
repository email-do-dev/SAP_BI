import { useState, useMemo, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePageView } from '@/hooks/use-activity-log'
import { createColumnHelper } from '@tanstack/react-table'
import { format } from 'date-fns'
import { UserPlus, Shield } from 'lucide-react'
import { DataTable } from '@/components/shared/data-table'
import { Dialog } from '@/components/shared/dialog'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/types/database'

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'diretoria', label: 'Diretoria' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'logistica', label: 'Logística' },
  { value: 'financeiro', label: 'Financeiro' },
]

const ROLE_COLORS: Record<string, string> = {
  diretoria: 'bg-red-100 text-red-800',
  comercial: 'bg-blue-100 text-blue-800',
  logistica: 'bg-green-100 text-green-800',
  financeiro: 'bg-amber-100 text-amber-800',
}

interface UserRow {
  id: string
  email: string
  full_name: string
  created_at: string
  last_sign_in_at: string | null
  roles: string[]
}

async function manageUsers(action: string, params?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-users', {
    body: { action, ...params },
  })
  if (error) throw error
  return data
}

const col = createColumnHelper<UserRow>()

export default function UsuariosPage() {
  usePageView('usuarios')
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)

  // Create form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([])
  const [success, setSuccess] = useState('')

  // Fetch users
  const { data: users, isLoading, error } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => manageUsers('list'),
  })

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (data: { email: string; password: string; full_name: string; roles: AppRole[] }) => {
      const { error } = await supabase.functions.invoke('create-user', { body: data })
      if (error) throw error
    },
    onSuccess: () => {
      setSuccess('Usuário criado com sucesso!')
      setEmail('')
      setPassword('')
      setFullName('')
      setSelectedRoles([])
      setShowCreate(false)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setTimeout(() => setSuccess(''), 3000)
    },
  })

  // Add role mutation
  const addRole = useMutation({
    mutationFn: (params: { user_id: string; role: string }) => manageUsers('add_role', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      // Update selected user locally
      if (selectedUser) {
        const updated = users?.find((u) => u.id === selectedUser.id)
        if (updated) setSelectedUser(updated)
      }
    },
  })

  // Remove role mutation
  const removeRole = useMutation({
    mutationFn: (params: { user_id: string; role: string }) => manageUsers('remove_role', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    createUser.mutate({ email, password, full_name: fullName, roles: selectedRoles })
  }

  const toggleCreateRole = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const columns = useMemo(
    () => [
      col.accessor('full_name', { header: 'Nome', size: 180 }),
      col.accessor('email', { header: 'Email' }),
      col.accessor('roles', {
        header: 'Papéis',
        cell: (info) => (
          <div className="flex flex-wrap gap-1">
            {info.getValue().map((r) => (
              <span key={r} className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r] ?? 'bg-gray-100 text-gray-800'}`}>
                {r}
              </span>
            ))}
            {info.getValue().length === 0 && <span className="text-xs text-muted-foreground">Sem papéis</span>}
          </div>
        ),
      }),
      col.accessor('last_sign_in_at', {
        header: 'Último Login',
        cell: (info) => info.getValue() ? format(new Date(info.getValue()!), 'dd/MM/yyyy HH:mm') : '—',
        size: 150,
      }),
      col.accessor('created_at', {
        header: 'Criado em',
        cell: (info) => format(new Date(info.getValue()), 'dd/MM/yyyy'),
        size: 110,
      }),
    ],
    []
  )

  // Refresh selectedUser data when users list updates
  const currentSelectedUser = useMemo(() => {
    if (!selectedUser || !users) return selectedUser
    return users.find((u) => u.id === selectedUser.id) ?? selectedUser
  }, [users, selectedUser])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus size={16} />
          Novo Usuário
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Erro ao carregar usuários: {error instanceof Error ? error.message : 'Erro desconhecido'}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : (
        <DataTable
          data={users ?? []}
          columns={columns}
          searchPlaceholder="Buscar por nome ou email..."
          searchColumn="email"
          onRowClick={setSelectedUser}
        />
      )}

      {/* Create User Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Criar Novo Usuário">
        <form onSubmit={handleSubmit} className="space-y-4">
          {createUser.isError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {createUser.error instanceof Error ? createUser.error.message : 'Erro ao criar usuário'}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Nome Completo</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Papéis</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleCreateRole(r.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedRoles.includes(r.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={createUser.isPending || selectedRoles.length === 0}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createUser.isPending ? 'Criando...' : 'Criar Usuário'}
          </button>
        </form>
      </Dialog>

      {/* Role Management Dialog */}
      <Dialog
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={`Papéis — ${currentSelectedUser?.full_name || currentSelectedUser?.email || ''}`}
      >
        {currentSelectedUser && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <Shield size={14} className="mr-1 inline" />
              Clique para adicionar ou remover papéis deste usuário.
            </div>

            {(addRole.isError || removeRole.isError) && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Erro ao atualizar papéis
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {ROLES.map((r) => {
                const hasIt = currentSelectedUser.roles.includes(r.value)
                return (
                  <button
                    key={r.value}
                    onClick={() => {
                      if (hasIt) {
                        removeRole.mutate({ user_id: currentSelectedUser.id, role: r.value })
                      } else {
                        addRole.mutate({ user_id: currentSelectedUser.id, role: r.value })
                      }
                    }}
                    disabled={addRole.isPending || removeRole.isPending}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                      hasIt
                        ? `${ROLE_COLORS[r.value]} ring-2 ring-offset-1 ring-current`
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {r.label}
                    {hasIt && ' ✓'}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p><strong>Email:</strong> {currentSelectedUser.email}</p>
              <p><strong>Criado em:</strong> {format(new Date(currentSelectedUser.created_at), 'dd/MM/yyyy HH:mm')}</p>
              <p><strong>Último login:</strong> {currentSelectedUser.last_sign_in_at ? format(new Date(currentSelectedUser.last_sign_in_at), 'dd/MM/yyyy HH:mm') : 'Nunca'}</p>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
