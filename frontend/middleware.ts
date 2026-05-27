import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  // Use fallback dummy values during next build/static generation
  const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
  const supabaseUrl = rawSupabaseUrl.replace(/\/+$/, '')
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  // If using placeholder variables (e.g. at build time), skip middleware execution
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
  console.log(`[Middleware Debug] Checking user session for pathname: ${pathname}`)
  const { data: { user } } = await supabase.auth.getUser()

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/forecast') ||
    pathname.startsWith('/settings')

  const isAuthPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')

  if (isProtectedPath) {
    if (!user) {
      console.log(`[Middleware Debug] Protected path access denied. No user found.`);
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
      console.log(`[Middleware Debug] Protected path access denied. Email not confirmed. user=[${user.email}]`);
      const loginUrl = new URL('/login', request.url)
      loginUrl.search = `?error=email-not-confirmed`
      
      const redirectResponse = NextResponse.redirect(loginUrl)
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }
  }

  if (isAuthPath && user && user.email_confirmed_at) {
    console.log(`[Middleware Debug] Auth path access with active verified user session. Redirecting to dashboard.`);
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
    '/login',
    '/register',
  ],
}
