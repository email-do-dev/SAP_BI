import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

type AuditAction =
  | 'login'
  | 'logout'
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'print'
  | 'navigate'

interface LogActivityParams {
  action: AuditAction
  resource?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

export function useActivityLog() {
  const { user } = useAuth()

  const logActivity = useCallback(
    ({ action, resource, resourceId, metadata }: LogActivityParams) => {
      // Fire-and-forget — never block UX
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(supabase.from('audit_logs') as any)
        .insert({
          user_id: user?.id ?? null,
          user_email: user?.email ?? null,
          action,
          resource: resource ?? null,
          resource_id: resourceId ?? null,
          metadata: metadata ?? {},
          user_agent: navigator.userAgent,
        })
        .then(({ error }: { error: { message: string } | null }) => {
          if (error && import.meta.env.DEV) {
            console.warn('[ActivityLog] Failed to log:', error.message)
          }
        })
    },
    [user],
  )

  return { logActivity }
}
