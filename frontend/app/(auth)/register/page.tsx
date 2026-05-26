"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import Logo from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BackButton from "@/components/ui/back-button";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password strength calculation
  const [strength, setStrength] = useState<{ score: number; label: string; color: string }>({
    score: 0,
    label: "Too short",
    color: "bg-red-500",
  });

  useEffect(() => {
    if (password.length === 0) {
      setStrength({ score: 0, label: "Too short", color: "bg-red-500" });
      return;
    }
    if (password.length < 8) {
      setStrength({ score: 1, label: "Too short", color: "bg-red-500" });
      return;
    }

    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (hasSpecial && hasNumber) {
      setStrength({ score: 4, label: "Strong", color: "bg-emerald-500" });
    } else if (hasNumber) {
      setStrength({ score: 3, label: "Good", color: "bg-indigo-500" });
    } else {
      setStrength({ score: 2, label: "Weak", color: "bg-amber-500" });
    }
  }, [password]);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agreeTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      if (res.ok) {
        toast.success("Account created successfully!");

        // Fire-and-forget welcome email/notification via Web3Forms
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
              subject: "Welcome to FinFlow!",
              name: fullName,
              email: email,
              message: "Welcome to FinFlow! Your account has been created. Start by uploading your first CSV transaction export.",
            }),
          }).catch(() => {
            // Silently ignore mail errors
          });
        }

        // Automatic signin or login redirect
        router.push("/login");
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to create account. Email might already exist.");
      }
    } catch {
      setError("Unable to connect to registration services.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090A] flex text-gray-100 font-sans select-none">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950/10 via-[#08090A] to-purple-950/10 border-r border-[#1D1E22]/60 p-12 flex-col justify-between relative overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

        <Link href="/" className="flex items-center space-x-2 group w-fit">
          <Logo size={32} glow />
          <span className="text-xl font-extrabold tracking-tight text-white">FinFlow</span>
        </Link>

        <div className="max-w-md space-y-8 z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            &ldquo;Join businesses already forecasting smarter&rdquo;
          </h1>

          <ul className="space-y-4">
            {[
              "Configure multi-currency ledger sheets",
              "Automate categorization with ML",
              "Access Holt-Winters cash predictions",
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
            Create your account
          </h2>
          <p className="mt-2 text-sm text-emerald-400 font-medium text-center sm:text-left">
            Start free — no credit card required
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <form onSubmit={handleSubmit} className="space-y-4 glass-card border-[#1D1E22] p-6 rounded-2xl">
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-gray-400 mb-1.5 font-mono uppercase tracking-wider">
                Full Name
              </label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="Alex Johnson"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="input-premium h-10 w-full rounded-xl placeholder-gray-600 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-400 mb-1.5 font-mono uppercase tracking-wider">
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
              <label htmlFor="password" className="block text-xs font-semibold text-gray-400 mb-1.5 font-mono uppercase tracking-wider">
                Password (min 8 characters)
              </label>
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

              {/* Password strength bar */}
              {password.length > 0 && (
                <div className="mt-2.5">
                  <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${strength.color} transition-all duration-300`}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    Strength: <span className="font-semibold text-white">{strength.label}</span>
                  </span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-400 mb-1.5 font-mono uppercase tracking-wider">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input-premium h-10 w-full rounded-xl placeholder-gray-600 focus:outline-none text-xs"
              />
            </div>

            {/* Terms checkbox */}
            <div className="flex items-center space-x-2 pt-2">
              <input
                id="terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="rounded border-gray-800 bg-[#08090A] text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <label htmlFor="terms" className="text-[11px] text-gray-400">
                I agree to the{" "}
                <Link href="/terms" className="text-indigo-400 hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-indigo-400 hover:underline">
                  Privacy Policy
                </Link>
              </label>
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
              className="w-full btn-premium h-10 rounded-xl font-semibold transition-all border border-indigo-500/30 text-white mt-2 flex items-center justify-center"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                "Create Free Account"
              )}
            </Button>

            <p className="text-center text-xs text-gray-400 mt-2">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                Sign in →
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
