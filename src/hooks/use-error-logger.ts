import { supabase } from '@/lib/supabase'

type FrontendErrorType =
  | 'unhandled_error'
  | 'unhandled_rejection'
  | 'error_boundary'
  | 'lazy_retry_fail'
  | 'chunk_load_error'

interface LogErrorParams {
  errorType: FrontendErrorType
  message: string
  stack?: string | null
  componentStack?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Log a frontend error to frontend_error_logs.
 * Standalone function (not a hook) so it can be called from anywhere —
 * including ErrorBoundary class components, window.onerror, and
 * onunhandledrejection where hooks aren't available.
 */
export function logFrontendError({ errorType, message, stack, componentStack, metadata }: LogErrorParams) {
  // Get current user from Supabase session (best-effort, no await)
  supabase.auth.getSession().then(({ data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from('frontend_error_logs') as any)
      .insert({
        user_id: data.session?.user?.id ?? null,
        error_type: errorType,
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 5000) ?? null,
        component_stack: componentStack?.slice(0, 5000) ?? null,
        url: window.location.href,
        metadata: {
          ...metadata,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error && import.meta.env.DEV) {
          console.warn('[ErrorLogger] Failed to log:', error.message)
        }
      })
  })
}
