'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef
} from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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

  // Use fallback dummy values during next build/static generation
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

  const fetchUser = useCallback(async () => {
    // If using placeholder variables (e.g. at build time), skip fetch
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setLoading(false)
      return
    }

    if (hasFetched.current) return
    hasFetched.current = true

    try {
      console.log("[AuthContext] Fetching Supabase session...")
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        console.log("[AuthContext] Supabase session found:", session.user.email)
        const sbUser = session.user
        const plan = (sbUser.user_metadata?.plan || 'free') as 'free' | 'pro'
        setUser({
          id: sbUser.id,
          email: sbUser.email || '',
          full_name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || 'User',
          plan
        })
      } else {
        console.log("[AuthContext] No Supabase session found")
        setUser(null)
      }
    } catch (error) {
      console.error('[AuthContext] Auth fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const refetch = useCallback(async () => {
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
        console.log("[AuthContext] onAuthStateChange event:", event, session?.user?.email)
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
  }, [fetchUser, supabase])

  const logout = useCallback(async () => {
    try {
      console.log("[AuthContext] Logging out from Supabase...")
      await supabase.auth.signOut()
    } catch (e) {
      console.error("[AuthContext] Supabase signout error:", e)
    } finally {
      setUser(null)
      hasFetched.current = false
      router.push('/login')
    }
  }, [router, supabase])

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
