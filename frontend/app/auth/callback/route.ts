import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect address
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Restrict redirect to relative paths only — blocks open redirect
      const nextPath = next.startsWith("/") ? next : "/dashboard";
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/+$/, '');
      const redirectTarget = `${appUrl}${nextPath}`;
      return NextResponse.redirect(redirectTarget);
    }
  }

  // return the user to login page with an error
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "auth-callback-failed");
  return NextResponse.redirect(loginUrl);
}
