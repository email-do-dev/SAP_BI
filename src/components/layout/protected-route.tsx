import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import type { AppRole } from '@/types/database'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: AppRole[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, roles, loading } = useAuth()

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

  if (requiredRoles && requiredRoles.length > 0) {
    const hasAccess = requiredRoles.some((r) => roles.includes(r))
    if (!hasAccess) {
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}
