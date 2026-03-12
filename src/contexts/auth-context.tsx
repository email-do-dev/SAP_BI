import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { env } from '@/config/env'
import type { AppRole } from '@/types/database'

interface AuthState {
  user: User | null
  session: Session | null
  roles: AppRole[]
  loading: boolean
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (role: AppRole) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Fetch user roles via direct fetch() instead of supabase.rpc().
 *
 * supabase.rpc() internally calls auth.getSession() which uses the Web Locks
 * API. When called from within an onAuthStateChange callback, this creates a
 * deadlock: the callback runs inside the auth lock, and getSession() tries to
 * acquire the same lock, queuing behind the current operation — which is
 * waiting for the callback to finish. Direct fetch() with the access token
 * from the session parameter bypasses this entirely.
 */
async function fetchRolesDirectly(userId: string, accessToken: string): Promise<AppRole[]> {
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_user_roles`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ _user_id: userId }),
    })
    if (!resp.ok) {
      if (import.meta.env.DEV) console.error('[Auth] Failed to fetch roles:', resp.status, await resp.text())
      return []
    }
    const data = await resp.json()
    return (data as AppRole[]) ?? []
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Auth] Failed to fetch roles:', err)
    return []
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    loading: true,
  })

  const resolveSession = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState({ user: null, session: null, roles: [], loading: false })
      return
    }
    // Set user immediately so layout renders while roles load
    setState(prev => ({ ...prev, user: session.user, session }))
    const roles = await fetchRolesDirectly(session.user.id, session.access_token)
    setState({ user: session.user, session, roles, loading: false })
  }, [])

  useEffect(() => {
    let mounted = true

    // Single source of truth: onAuthStateChange handles all auth events.
    // We do NOT call getSession() — it also deadlocks on the auth lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await resolveSession(session)
        // Invalidate queries on auth changes (not on initial load)
        if (event !== 'INITIAL_SESSION') {
          queryClient.invalidateQueries()
        }
      } else if (event === 'SIGNED_OUT') {
        setState({ user: null, session: null, roles: [], loading: false })
        queryClient.clear()
      }
    })

    // Safety net — if INITIAL_SESSION never fires, stop loading after 5s
    const timeout = setTimeout(() => {
      if (mounted) {
        setState(prev => prev.loading ? { ...prev, loading: false } : prev)
      }
    }, 5000)

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [resolveSession, queryClient])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const hasRole = (role: AppRole) => state.roles.includes(role)

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
