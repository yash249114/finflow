"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import Logo from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BackButton from "@/components/ui/back-button";
import { useAuth } from "@/lib/auth-context";
import { createBrowserClient } from "@supabase/ssr";

interface ReCaptchaInstance {
  ready: (callback: () => void) => void;
  render: (containerId: string, options: {
    sitekey?: string;
    callback?: (token: string) => void;
    "expired-callback"?: () => void;
    "error-callback"?: () => void;
    theme?: string;
    size?: string;
  }) => number;
  reset: (opt_widget_id?: number) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

declare global {
  interface Window {
    grecaptcha?: ReCaptchaInstance;
  }
}

// Removed getSafeRedirectPath function to ensure no malformed URL objects are created client-side.
// The login flow will now redirect authenticated sessions exclusively to "/dashboard".

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");

  const showCaptcha = email.length > 0 && password.length > 0;

  React.useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "email-not-confirmed") {
      setError("Your email address is not verified yet. Please check your inbox for the confirmation link.");
    } else if (errorParam === "auth-callback-failed") {
      setError("Authentication failed during the callback challenge. Please try again.");
    }
  }, [searchParams]);

  React.useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) {
      console.warn("[Login Captcha] NEXT_PUBLIC_RECAPTCHA_SITE_KEY is missing.");
      return;
    }

    if (document.getElementById("recaptcha-script")) return;

    const script = document.createElement("script");
    script.id = "recaptcha-script";
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      const loadedScript = document.getElementById("recaptcha-script");
      if (loadedScript) {
        document.body.removeChild(loadedScript);
      }
      const badge = document.querySelector(".grecaptcha-badge");
      if (badge) {
        badge.remove();
      }
    };
  }, []);

  React.useEffect(() => {
    if (!showCaptcha) return;

    let timer: NodeJS.Timeout;
    const renderWidget = () => {
      if (window.grecaptcha && window.grecaptcha.render) {
        const container = document.getElementById("recaptcha-container");
        if (container && container.innerHTML === "") {
          window.grecaptcha.render("recaptcha-container", {
            sitekey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
            callback: (token: string) => {
              setCaptchaToken(token);
            },
            "expired-callback": () => {
              setCaptchaToken("");
            },
            "error-callback": () => {
              setCaptchaToken("");
              toast.error("reCAPTCHA encountered an error. Please try again.");
            }
          });
        }
      } else {
        timer = setTimeout(renderWidget, 100);
      }
    };

    renderWidget();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showCaptcha]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
      const supabaseUrl = rawSupabaseUrl.replace(/\/+$/, '');
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        }
      });
      
      if (oauthError) throw oauthError;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google OAuth sign-in failed. Please try again.";
      setError(message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address first in the email field.");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, type: "reset-password" }),
      });
      
      if (res.ok) {
        toast.success("Password recovery link has been sent to your email!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send password recovery email.");
      }
    } catch {
      toast.error("Failed to send password recovery email.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, type: "verification" }),
      });
      if (res.ok) {
        toast.success("A fresh verification link has been sent to your email!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send verification link.");
      }
    } catch {
      toast.error("Failed to send verification link.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);
    try {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

      if (siteKey) {
        if (!captchaToken) {
          setError("Please complete the reCAPTCHA checkbox challenge.");
          setLoading(false);
          return;
        }

        const verifyRes = await fetch("/api/verify-captcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: captchaToken }),
        });

        if (!verifyRes.ok) {
          const verifyData = await verifyRes.json();
          setError(verifyData.error || "Suspicious activity detected. Please try again.");
          setLoading(false);
          if (window.grecaptcha) {
            window.grecaptcha.reset();
            setCaptchaToken("");
          }
          return;
        }
      } else {
        console.warn("[Login Captcha] Site key missing, bypassing captcha check in development.");
      }

      const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
      const supabaseUrl = rawSupabaseUrl.replace(/\/+$/, '');
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

      const { data, error: apiError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (apiError) {
        if (apiError.message.toLowerCase().includes("email not confirmed") || apiError.message.toLowerCase().includes("confirm your email")) {
          setError("Your email address is not verified yet. Please check your inbox for the confirmation link.");
        } else {
          setError(apiError.message);
        }
        if (window.grecaptcha) {
          window.grecaptcha.reset();
          setCaptchaToken("");
        }
        return;
      }

      if (data.session) {
        // Let onAuthStateChange in AuthProvider handle user state
        await refetch();
      }

      toast.success("Welcome back to FinFlow!");

      // Fire-and-forget onboarding/welcome email via Resend
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          type: "welcome",
          fullName: data.session?.user?.user_metadata?.full_name || "User"
        })
      }).catch(() => {
        // Silently ignore email dispatch errors
      });

      // Wait a short duration (100ms) to ensure Supabase state propagation, cookie commit, and React context update complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      if (window.grecaptcha) {
        window.grecaptcha.reset();
        setCaptchaToken("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090A] flex text-gray-100 font-sans select-none">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950/10 via-[#08090A] to-purple-950/10 border-r border-[#1D1E22]/60 p-12 flex-col justify-between relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

        <Link href="/" className="flex items-center space-x-2 group w-fit">
          <Logo size={32} glow />
          <span className="text-xl font-extrabold tracking-tight text-white">FinFlow</span>
        </Link>

        <div className="max-w-md space-y-8 z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            &ldquo;Cash flow intelligence for the modern business&rdquo;
          </h1>

          <ul className="space-y-4">
            {[
              "AI-powered transaction categorization",
              "90-day cash flow forecasting",
              "Real-time anomaly detection",
            ].map((text, i) => (
              <motion.li
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i}
                className="flex items-center space-x-3 text-sm text-gray-300 font-medium"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Check className="h-3 w-3" />
                </div>
                <span>{text}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-gray-500">
          © 2026 FinFlow. All rights reserved.
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8 bg-gray-950/40 relative">
        <div className="absolute top-6 left-6 z-20">
          <BackButton href="/" label="Back to Home" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.03),transparent_60%)] pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
          {/* Logo on mobile only */}
          <div className="flex justify-center lg:hidden mb-6">
            <Link href="/" className="flex items-center space-x-2">
              <Logo size={36} glow />
              <span className="text-2xl font-bold text-white">FinFlow</span>
            </Link>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white text-center sm:text-left">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-400 text-center sm:text-left">
            Sign in to your FinFlow account
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <form onSubmit={handleSubmit} className="space-y-5 glass-card border-[#1D1E22] p-6 rounded-2xl">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-400 mb-2 font-mono uppercase tracking-wider">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-premium h-10 w-full rounded-xl placeholder-gray-600 focus:outline-none text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-semibold text-gray-400 font-mono uppercase tracking-wider">
                  Password
                </label>
                <Link
                  href="#"
                  onClick={handleForgotPassword}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-premium h-10 w-full rounded-xl pr-10 placeholder-gray-600 focus:outline-none text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {showCaptcha && (
              <div className="flex justify-center my-2 min-h-[78px]">
                <div id="recaptcha-container" />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 flex flex-col space-y-2 text-xs">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {error.toLowerCase().includes("not verified yet") && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="text-left text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline pl-6 transition-colors"
                  >
                    Resend verification link
                  </button>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-premium h-10 rounded-xl font-semibold transition-[background-color,border-color,box-shadow,color,opacity] border border-indigo-500/30 text-white flex items-center justify-center"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-800" />
              <span className="flex-shrink mx-4 text-[10px] uppercase font-bold text-gray-600">or</span>
              <div className="flex-grow border-t border-gray-800" />
            </div>

            <Button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full bg-[#1e2022] hover:bg-[#2a2c2e] text-white h-10 rounded-xl font-semibold border border-gray-800 transition-[background-color,border-color,box-shadow,color,opacity] flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <p className="text-center text-xs text-gray-400 mt-2">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                Create one free →
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#08090A] flex items-center justify-center text-gray-100 font-sans">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
