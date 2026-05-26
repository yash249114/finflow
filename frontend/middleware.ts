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

  // Refresh session if expired
  console.log(`[Middleware Debug] Checking session for pathname: ${pathname}`)
  const { data: { session } } = await supabase.auth.getSession()

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/forecast') ||
    pathname.startsWith('/settings')

  const isAuthPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')

  if (isProtectedPath && !session) {
    console.log(`[Middleware Debug] Protected path access denied. pathname=[${pathname}], session=[${!!session}]`);
    
    // Safely assign relative redirect path to prevent absolute URL injection
    const relativeFrom = '/' + pathname.replace(/^\/+/, '')
    
    // Construct a clean, valid absolute URL for /login with unencoded / in the query param
    // to strictly satisfy: "/login?from=/dashboard" and never malformed encoded paths.
    const loginUrl = new URL('/login', request.url)
    loginUrl.search = `?from=${relativeFrom}`
    
    console.log(`[Middleware Debug] Redirecting unauthorized user to login. Generated URL values: pathname=[${loginUrl.pathname}], search=[${loginUrl.search}], absolute=[${loginUrl.toString()}]`);
    
    const redirectResponse = NextResponse.redirect(loginUrl)
    
    // Copy updated cookies (including all attributes like path, domain, secure, httpOnly) so refreshed session is not lost
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    
    return redirectResponse
  }

  if (isAuthPath && session) {
    console.log(`[Middleware Debug] Auth path access with active session. pathname=[${pathname}], session=[${!!session}]`);
    const redirectUrl = new URL('/dashboard', request.url)
    
    console.log(`[Middleware Debug] Redirecting authorized user to dashboard. Generated URL values: pathname=[${redirectUrl.pathname}], search=[${redirectUrl.search}], absolute=[${redirectUrl.toString()}]`);
    
    const redirectResponse = NextResponse.redirect(redirectUrl)
    
    // Copy updated cookies (including all attributes like path, domain, secure, httpOnly) so refreshed session is not lost
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
