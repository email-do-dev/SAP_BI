import { supabase } from '@/lib/supabase'

type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'access_denied'
  | 'session_expired'
  | 'password_reset'

interface LogSecurityEventParams {
  eventType: SecurityEventType
  userId?: string | null
  userEmail?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Log a security event to security_logs.
 * Standalone function (not a hook) so it works inside auth callbacks
 * and class components where hooks aren't available.
 * Fire-and-forget — never blocks the caller.
 */
export function logSecurityEvent({ eventType, userId, userEmail, metadata }: LogSecurityEventParams) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabase.from('security_logs') as any)
    .insert({
      user_id: userId ?? null,
      user_email: userEmail ?? null,
      event_type: eventType,
      user_agent: navigator.userAgent,
      metadata: metadata ?? {},
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error && import.meta.env.DEV) {
        console.warn('[SecurityLog] Failed to log:', error.message)
      }
    })
}
