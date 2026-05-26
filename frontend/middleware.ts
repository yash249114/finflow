import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for access_token or access_token_exists indicator cookie
  const token = request.cookies.get('access_token')?.value || request.cookies.get('access_token_exists')?.value

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/forecast') ||
    pathname.startsWith('/settings')

  const isAuthPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')

  // No token + protected route → redirect to login
  if (isProtectedPath && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Has token + auth page → redirect to dashboard
  if (isAuthPath && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
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
