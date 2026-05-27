import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { to, type, fullName } = await request.json();

    if (!to || !type) {
      return NextResponse.json({ error: "Missing required fields: to and type" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "FinFlow <onboarding@resend.dev>";

    if (!apiKey) {
      console.warn(`[Resend Mock] Key missing. Email type: ${type} mock sent to: ${to}`);
      return NextResponse.json({ success: true, mock: true });
    }

    let subject = "";
    let html = "";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (type === "verification" || type === "reset-password") {
      if (!supabaseUrl || !serviceRoleKey) {
        console.warn("[Resend Warning] Supabase service role key or URL missing. Falling back to mock link.");
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const dummyLink = `${appUrl}/auth/callback?code=mock-code&next=/dashboard`;
        
        subject = type === "verification" ? "Verify your FinFlow account" : "Reset your FinFlow password";
        html = `
          <h2>FinFlow Verification Fallback</h2>
          <p>Please click the link below (fallback representation):</p>
          <p><a href="${dummyLink}">${type === "verification" ? "Verify Email" : "Reset Password"}</a></p>
        `;
      } else {
        // Initialize admin client to generate links securely
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const redirectUrl = `${appUrl}/auth/callback`;

        if (type === "verification") {
          console.log(`[Resend Admin] Generating signup confirmation link for ${to}...`);
          const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "invite",
            email: to,
            options: { redirectTo: redirectUrl }
          });
          
          if (error) {
            console.error("[Resend Admin] Error generating verification link:", error);
            throw error;
          }
          
          subject = "Confirm your FinFlow Registration";
          html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #4f46e5;">Welcome to FinFlow!</h2>
              <p>Please confirm your registration by clicking the link below:</p>
              <p><a href="${data.properties.action_link}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Verify Email Address</a></p>
              <p>Or copy this link to your browser:</p>
              <p style="word-break: break-all; color: #718096;">${data.properties.action_link}</p>
            </div>
          `;
        } else {
          console.log(`[Resend Admin] Generating password recovery link for ${to}...`);
          const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email: to,
            options: { redirectTo: redirectUrl }
          });
          
          if (error) {
            console.error("[Resend Admin] Error generating recovery link:", error);
            throw error;
          }

          subject = "Reset your FinFlow Password";
          html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #4f46e5;">Password Reset Request</h2>
              <p>We received a request to reset your password. Click the link below to set a new one:</p>
              <p><a href="${data.properties.action_link}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a></p>
              <p>Or copy this link to your browser:</p>
              <p style="word-break: break-all; color: #718096;">${data.properties.action_link}</p>
            </div>
          `;
        }
      }
    } else if (type === "welcome") {
      subject = "Welcome to FinFlow!";
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5;">Welcome to FinFlow, ${fullName || "User"}!</h2>
          <p>Your account has been created successfully.</p>
          <p>Start managing your transactions and forecasting cash flow with intelligence today!</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Go to Dashboard</a></p>
        </div>
      `;
    }

    console.log(`[Resend] Sending email of type ${type} to ${to}...`);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errData = await res.json();
      console.error("[Resend Error] Resend API returned error:", errData);
      throw new Error(errData.message || "Failed to send email");
    }

    const resData = await res.json();
    return NextResponse.json({ success: true, id: resData.id });

  } catch (err) {
    console.error("[Resend Exception] Error handling email send request:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to process email" }, { status: 500 });
  }
}
