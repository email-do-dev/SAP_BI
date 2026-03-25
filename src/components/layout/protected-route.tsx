import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { logSecurityEvent } from '@/lib/security-logger'
import type { AppRole } from '@/types/database'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: AppRole[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, roles, loading } = useAuth()
  const location = useLocation()
  const loggedRef = useRef<string | null>(null)

  const isDenied =
    !loading &&
    !!user &&
    !!requiredRoles &&
    requiredRoles.length > 0 &&
    !requiredRoles.some((r) => roles.includes(r))

  // Log access_denied once per denied route (avoid re-logging on re-renders)
  useEffect(() => {
    if (isDenied && loggedRef.current !== location.pathname) {
      loggedRef.current = location.pathname
      logSecurityEvent({
        eventType: 'access_denied',
        userId: user?.id,
        userEmail: user?.email,
        metadata: {
          path: location.pathname,
          requiredRoles,
          userRoles: roles,
        },
      })
    }
  }, [isDenied, location.pathname, user, roles, requiredRoles])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isDenied) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
