import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Test-only OTP auto-confirmation endpoint.
 *
 * Disabled in production unless E2E_OTP_AUTO=1 is explicitly set. It uses the
 * Supabase service-role admin client to generate a signup confirmation link
 * for the given email and then exchanges the code for a session, returning the
 * redirect target. This lets Playwright complete the Register → OTP → Login
 * flow without a real inbox.
 */
export async function POST(request: Request) {
  if (process.env.E2E_OTP_AUTO !== "1") {
    return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  }

  try {
    const { email, password, redirectTo } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const appUrl =
      redirectTo || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = `${appUrl}/auth/callback`;

    // Generate a signup confirmation link for the new user. If the user was
    // created via the public signUp flow, they already exist; we simply mark
    // their email as confirmed through the admin API so login succeeds.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { redirectTo: callbackUrl },
    });

    if (linkError || !linkData.properties?.action_link) {
      return NextResponse.json(
        { error: linkError?.message || "Failed to generate confirmation link" },
        { status: 500 }
      );
    }

    // Look up the user and force-confirm their email via the admin API.
    const { data: listData, error: listError } = await admin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }
    const target = listData.users.find((u) => u.email === email);
    if (!target) {
      return NextResponse.json({ error: "User not found after signup" }, { status: 404 });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(target.id, {
      email_confirm: true,
    });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, confirmed: email });
  } catch (err) {
    console.error("[E2E OTP] auto-confirm error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "auto-confirm failed" },
      { status: 500 }
    );
  }
}
