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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
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
  console.log(`[Middleware] Checking session for: ${pathname}`)
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
    console.log(`[Middleware] Unauthorized access to ${pathname}. Redirecting to /login`)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPath && session) {
    console.log(`[Middleware] Authorized session detected on auth route ${pathname}. Redirecting to /dashboard`)
    return NextResponse.redirect(new URL('/dashboard', request.url))
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
