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
import { supabase } from "@/lib/supabase";

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

// Captcha configuration
const CAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

// Hook for reCAPTCHA logic
function useCaptcha(show: boolean, onToken: (token: string) => void, onError: () => void) {
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  React.useEffect(() => {
    if (!CAPTCHA_SITE_KEY) {
      console.warn("[Captcha] NEXT_PUBLIC_RECAPTCHA_SITE_KEY is missing.");
      return;
    }

    if (document.getElementById("recaptcha-script")) {
      setCaptchaLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "recaptcha-script";
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => setCaptchaLoaded(true);

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
    if (!show || !captchaLoaded || isInitializing) return;

    setIsInitializing(true);

    let timer: NodeJS.Timeout;
    const renderWidget = () => {
      if (window.grecaptcha && window.grecaptcha.render) {
        const container = document.getElementById("recaptcha-container");
        if (container && container.innerHTML === "") {
          window.grecaptcha.render("recaptcha-container", {
            sitekey: CAPTCHA_SITE_KEY,
            callback: (token: string) => {
              setCaptchaToken(token);
              onToken(token);
            },
            "expired-callback": () => {
              setCaptchaToken("");
            },
            "error-callback": () => {
              setCaptchaToken("");
              onError();
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
  }, [show, captchaLoaded, onToken, onError]);

  const resetCaptcha = () => {
    if (window.grecaptcha) {
      window.grecaptcha.reset();
    }
    setCaptchaToken("");
  };

  return { captchaToken, resetCaptcha };
}

// Unified error message handlers
const ERROR_MESSAGES = {
  emailNotConfirmed: "Your email address is not verified yet. Please check your inbox for the confirmation link.",
  authCallbackFailed: "Authentication failed during the callback challenge. Please try again.",
  captchaRequired: "Please complete the reCAPTCHA checkbox challenge.",
  captchaError: "Suspicious activity detected. Please try again.",
  generic: "Something went wrong. Please try again.",
  networkError: "Unable to connect to the server. Please check your internet connection.",
};

function FormInput({ label, id, type, value, onChange, placeholder, showPasswordToggle, showPassword, onTogglePassword }: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-400 mb-2 font-mono uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          autoComplete={id}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required
          className="input-premium h-10 w-full rounded-xl placeholder-gray-600 focus:outline-none text-xs pr-10"
        />
        {showPasswordToggle && onTogglePassword && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorDisplay({ error, onResend, showResend = false }: {
  error: string | null;
  onResend?: () => void;
  showResend?: boolean;
}) {
  if (!error) return null;

  const isEmailNotConfirmed = error.toLowerCase().includes("not verified") || error.toLowerCase().includes("confirm your email");

  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 flex flex-col space-y-2 text-xs">
      <div className="flex items-start space-x-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
      {showResend && isEmailNotConfirmed && onResend && (
        <button
          type="button"
          onClick={onResend}
          className="text-left text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline pl-6 transition-colors"
        >
          Resend verification link
        </button>
      )}
    </div>
  );
}

function AuthFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08090A] flex text-gray-100 font-sans select-none">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950/10 via-[#08090A] to-purple-950/10 border-r border-[#1D1E22]/60 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

        <Link href="/" className="flex items-center space-x-2 group w-fit">
          <Logo size={32} glow />
          <span className="text-xl font-extrabold tracking-tight text-white">FinFlow</span>
        </Link>

        <div className="max-w-md space-y-8 z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            {document.title.includes("Login") ? '"Cash flow intelligence for the modern business"' : '"Join businesses already forecasting smarter"'}
          </h1>

          <ul className="space-y-4">
            {[
                "AI-powered transaction categorization",
                "90-day cash flow forecasting", 
                "Real-time anomaly detection",
            ].map((text, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
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

      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8 bg-gray-950/40 relative">
        <div className="absolute top-6 left-6 z-20">
          <BackButton href="/" label="Back to Home" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.03),transparent_60%)] pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
          <div className="flex justify-center lg:hidden mb-6">
            <Link href="/" className="flex items-center space-x-2">
              <Logo size={36} glow />
              <span className="text-2xl font-bold text-white">FinFlow</span>
            </Link>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { refetch } = useAuth();
    
    const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showCaptcha = email.length > 0 && password.length > 0;

  const { captchaToken, resetCaptcha } = useCaptcha(
    showCaptcha,
    () => {},
    () => setError(ERROR_MESSAGES.captchaError)
  );

  React.useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "email-not-confirmed") {
      setError(ERROR_MESSAGES.emailNotConfirmed);
    } else if (errorParam === "auth-callback-failed") {
      setError(ERROR_MESSAGES.authCallbackFailed);
    }
  }, [searchParams]);

  const validateForm = () => {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return false;
    }
    return true;
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${APP_URL}/auth/callback`,
        }
      });
      
      if (oauthError) throw oauthError;
    } catch (err) {
      const message = err instanceof Error ? err.message : ERROR_MESSAGES.generic;
      setError(message);
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
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    
    try {
      const siteKey = CAPTCHA_SITE_KEY;

      if (siteKey) {
        if (!captchaToken) {
          setError(ERROR_MESSAGES.captchaRequired);
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
          setError(verifyData.error || ERROR_MESSAGES.captchaError);
          setLoading(false);
          resetCaptcha();
          return;
        }
      } else {
        console.warn("[Login Captcha] Site key missing, bypassing captcha check in development.");
      }

      const { data, error: apiError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (apiError) {
        if (apiError.message.toLowerCase().includes("email not confirmed") || 
            apiError.message.toLowerCase().includes("confirm your email")) {
          setError(ERROR_MESSAGES.emailNotConfirmed);
        } else {
          setError(apiError.message);
        }
        resetCaptcha();
        return;
      }

      if (data.session) {
        await refetch();
      }

      toast.success("Welcome back to FinFlow!");

      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          type: "welcome",
          fullName: data.session?.user?.user_metadata?.full_name || "User"
        })
      }).catch(() => {});

      await new Promise((resolve) => setTimeout(resolve, 100));
      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : ERROR_MESSAGES.networkError;
      setError(message);
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormLayout>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <h2 className="text-2xl font-bold tracking-tight text-white text-center sm:text-left">
          Welcome back
               </h2>
        <p className="mt-2 text-sm text-gray-400 text-center sm:text-left">
          Sign in to your FinFlow account
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5 glass-card border-[#1D1E22] p-6 rounded-2xl">
          <FormInput
            label="Email Address"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@company.com"
          />

          <FormInput
            label="Password"
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            showPasswordToggle={true}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
          />

          {showCaptcha && (
            <div className="flex justify-center my-2 min-h-[78px]">
              <div id="recaptcha-container" />
            </div>
          )}

          <ErrorDisplay 
            error={error} 
            onResend={handleResendVerification}
            showResend={true}
          />

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
            ) : "Sign In"}
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
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
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
    </AuthFormLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#08090A] flex items-center justify-center text-gray-100 font-sans">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
