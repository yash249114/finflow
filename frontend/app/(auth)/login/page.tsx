"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import Logo from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BackButton from "@/components/ui/back-button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("ff_user", JSON.stringify(data.user || { email, plan: "free", full_name: "User" }));
        document.cookie = "access_token_exists=true; path=/; max-age=900; SameSite=Lax; Secure";
        toast.success("Welcome back to FinFlow!");

        // Fire-and-forget welcome notification/email via Web3Forms
        const web3Key = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
        if (web3Key) {
          fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({
              access_key: web3Key,
              subject: "Welcome back to FinFlow",
              email: email,
              message: "Welcome back! You have successfully signed in to FinFlow. Manage your cash flows dynamically.",
            }),
          }).catch(() => {
            // Silently ignore email dispatch errors
          });
        }

        router.push("/dashboard");
        router.refresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Invalid email or password. Please try again.");
      }
    } catch {
      setError("Unable to connect to login services.");
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
          © 2025 FinFlow. All rights reserved.
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
                  onClick={() => toast.info("Password recovery is not configured yet")}
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

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 flex items-start space-x-2 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-premium h-10 rounded-xl font-semibold transition-all border border-indigo-500/30 text-white flex items-center justify-center"
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
