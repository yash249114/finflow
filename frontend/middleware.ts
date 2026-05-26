import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value || request.cookies.get("access_token_exists")?.value;
  const { pathname } = request.nextUrl;

  const protectedPaths = ["/dashboard", "/transactions", "/forecast", "/settings"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/forecast/:path*",
    "/settings/:path*",
  ],
};
