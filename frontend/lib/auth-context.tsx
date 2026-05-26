'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef
} from 'react'
import { useRouter } from 'next/navigation'

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
    // Prevent duplicate fetches
    if (hasFetched.current) return
    hasFetched.current = true

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/me`,
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          // No cache — must always be fresh
          cache: 'no-store',
        }
      )

      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        // 401 = not authenticated, clear user
        setUser(null)
      }
    } catch (error) {
      // Network error — do NOT clear user
      // Keep existing state, just stop loading
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
    fetchUser()
  }, [fetchUser])

  const logout = useCallback(async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/logout`,
        { method: 'POST', credentials: 'include' }
      )
    } catch {
      // ignore logout errors
    } finally {
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
