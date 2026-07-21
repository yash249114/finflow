'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'
import type { UserRole } from './constants'
import { ADMIN_EMAIL } from './constants'

interface User {
  id: string
  email: string
  full_name: string
  plan: 'free' | 'pro' | 'max'
  role: UserRole
  avatar_url?: string
  company_name?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
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
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const sbUser = session.user
        const plan = (sbUser.user_metadata?.plan || 'free') as 'free' | 'pro' | 'max'
        const email = sbUser.email || ''

        // Determine role: check metadata first, then fallback to admin email check
        let role: UserRole = 'user'
        if (sbUser.user_metadata?.role === 'admin' || email === ADMIN_EMAIL) {
          role = 'admin'
        }

        setUser({
          id: sbUser.id,
          email,
          full_name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || 'User',
          plan,
          role,
          avatar_url: sbUser.user_metadata?.avatar_url,
          company_name: sbUser.user_metadata?.company_name,
        })
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Auth fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

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
        if (session) {
          const sbUser = session.user
          const plan = (sbUser.user_metadata?.plan || 'free') as 'free' | 'pro' | 'max'
          const email = sbUser.email || ''

          let role: UserRole = 'user'
          if (sbUser.user_metadata?.role === 'admin' || email === ADMIN_EMAIL) {
            role = 'admin'
          }

          setUser({
            id: sbUser.id,
            email,
            full_name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || 'User',
            plan,
            role,
            avatar_url: sbUser.user_metadata?.avatar_url,
            company_name: sbUser.user_metadata?.company_name,
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
      await supabase.auth.signOut()
    } catch (e) {
      console.error("Signout error:", e)
    } finally {
      setUser(null)
      hasFetched.current = false
      router.push('/login')
    }
  }, [router])

  return (
    <AuthContext.Provider value={{
      user, loading, logout, refetch
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
