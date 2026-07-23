import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_EMAIL } from './lib/constants'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({
    request,
  })

  // Skip static/public assets to avoid overhead
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return response
  }

  // Check if we have real Supabase credentials (not placeholders)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Skip middleware if no real Supabase config (placeholders or empty)
  const isPlaceholder = supabaseUrl?.includes('placeholder') ?? true
  if (!supabaseUrl || !supabaseAnonKey || isPlaceholder) {
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Retrieve authentic user session
  const { data: { user } } = await supabase.auth.getUser()

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/forecast') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/copilot')

  const isAuthPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')

  if (isProtectedPath) {
    if (!user) {
      const relativeFrom = '/' + pathname.replace(/^\/+/, '')
      const loginUrl = new URL('/login', request.url)
      loginUrl.search = `?from=${relativeFrom}`
      
      const redirectResponse = NextResponse.redirect(loginUrl)
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }

    if (!user.email_confirmed_at) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.search = `?error=email-not-confirmed`
      
      const redirectResponse = NextResponse.redirect(loginUrl)
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }

    // Role verification for /admin path
    if (pathname.startsWith('/admin')) {
      const isAdmin = user.email === ADMIN_EMAIL || user.user_metadata?.role === 'admin'
      if (!isAdmin) {
        const dashboardUrl = new URL('/dashboard', request.url)
        const redirectResponse = NextResponse.redirect(dashboardUrl)
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie)
        })
        return redirectResponse
      }
    }
  }

  if (isAuthPath && user && user.email_confirmed_at) {
    const redirectUrl = new URL('/dashboard', request.url)
    const redirectResponse = NextResponse.redirect(redirectUrl)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/transactions/:path*',
    '/forecast/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/copilot/:path*',
    '/login',
    '/register',
  ],
}
