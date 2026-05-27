'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

interface User {
  id: string
  email: string
  full_name: string
  plan: 'free' | 'pro'
}

interface AuthContextType {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  logout: () => Promise<void>
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const hasFetched = useRef(false)

  const fetchUser = useCallback(async () => {
    // If using placeholder variables (e.g. at build time), skip fetch
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setLoading(false)
      return
    }

    if (hasFetched.current) return
    hasFetched.current = true

    try {
      console.log("[AuthContext Debug] Fetching Supabase session...")
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        console.log("[AuthContext Debug] Supabase session successfully verified and confirmed:", session.user.email)
        const sbUser = session.user
        const plan = (sbUser.user_metadata?.plan || 'free') as 'free' | 'pro'
        setUser({
          id: sbUser.id,
          email: sbUser.email || '',
          full_name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || 'User',
          plan
        })
      } else {
        console.log("[AuthContext Debug] No active session retrieved from getSession()")
        setUser(null)
      }
    } catch (error) {
      console.error('[AuthContext Debug] Auth fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    console.log("[AuthContext Debug] Requesting manual context refetch...")
    hasFetched.current = false
    setLoading(true)
    await fetchUser()
  }, [fetchUser])

  useEffect(() => {
    // If using placeholder variables, skip registration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return
    }

    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AuthContext Debug] onAuthStateChange event received [${event}]:`, session?.user?.email)
        if (session) {
          const sbUser = session.user
          const plan = (sbUser.user_metadata?.plan || 'free') as 'free' | 'pro'
          setUser({
            id: sbUser.id,
            email: sbUser.email || '',
            full_name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || 'User',
            plan
          })
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUser])

  const logout = useCallback(async () => {
    try {
      console.log("[AuthContext] Signing out from Supabase Auth service...")
      await supabase.auth.signOut()
    } catch (e) {
      console.error("[AuthContext] Supabase signout error:", e)
    } finally {
      console.log("[AuthContext] Clearing session state locally and redirecting to /login")
      setUser(null)
      hasFetched.current = false
      router.push('/login')
    }
  }, [router])

  return (
    <AuthContext.Provider value={{
      user, loading, setUser, logout, refetch
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
