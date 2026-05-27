import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ error: "Missing captcha token" }, { status: 400 });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Captcha API] RECAPTCHA_SECRET_KEY is missing. Bypassing captcha verification in development mode.");
        return NextResponse.json({ success: true });
      }
      console.error("[Captcha API] RECAPTCHA_SECRET_KEY environment variable is not set");
      return NextResponse.json({ error: "Server captcha configuration missing" }, { status: 500 });
    }

    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
    
    const response = await fetch(verifyUrl, { method: "POST" });
    const data = await response.json();

    console.log("[Captcha API] Google verification response:", data);

    if (data.success && (data.score === undefined || data.score >= 0.5)) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({
      success: false,
      error: "Suspicious activity detected. Please try again.",
      score: data.score
    }, { status: 400 });

  } catch (err) {
    console.error("[Captcha API] Error during captcha verification:", err);
    return NextResponse.json({ error: "Failed to verify captcha" }, { status: 500 });
  }
}
