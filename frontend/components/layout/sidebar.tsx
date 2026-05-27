"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import Logo from "@/components/ui/logo";
import { useAuth } from "@/lib/auth-context";

const navLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  {
    name: "Forecast",
    href: "/forecast",
    icon: TrendingUp,
    gated: "pro" as const,
  },
  {
    name: "AI Copilot",
    href: "/copilot",
    icon: Sparkles,
    gated: "pro" as const,
    isAI: true,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const plan = user?.plan || "free";

  return (
    <div className="flex h-full w-[220px] flex-col bg-[#0A0A0E] text-gray-300 select-none border-r border-white/[0.04]">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 shrink-0">
        <Link href="/dashboard" className="flex items-center space-x-2.5 group">
          <Logo size={20} glow />
          <span className="text-base font-bold tracking-tight text-white">
            FinFlow
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href ||
            pathname?.startsWith(link.href + "/");
          const needsUpgrade =
            link.gated && plan === "free";

          return (
            <Link
              key={link.name}
              href={link.href}
              className={`relative flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-200 group ${
                isActive
                  ? "text-white bg-white/[0.06] nav-active-pill"
                  : "text-text-muted hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`h-[18px] w-[18px] transition-colors ${
                    isActive
                      ? "text-neural-blue"
                      : link.isAI
                      ? "text-neural-violet group-hover:text-neural-violet"
                      : "text-text-muted group-hover:text-white"
                  }`}
                />
                <span>{link.name}</span>
              </div>

              {needsUpgrade && (
                <span className="rounded-full bg-neural-blue/10 px-1.5 py-0.5 text-[9px] font-bold text-neural-blue border border-neural-blue/20 uppercase tracking-wider">
                  Pro
                </span>
              )}

              {link.isAI && isActive && (
                <motion.div
                  className="absolute right-3 h-1.5 w-1.5 rounded-full bg-neural-violet"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Plan indicator */}
      <div className="px-3 pb-4">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Current Plan
              </p>
              <p className="text-sm font-bold text-white capitalize mt-0.5">
                {plan === "free" ? "Free" : plan === "pro" ? "Pro" : "MAX"}
              </p>
            </div>
            {plan === "free" && (
              <Link
                href="/settings/billing"
                className="rounded-lg bg-neural-blue/10 border border-neural-blue/20 px-2.5 py-1 text-[10px] font-bold text-neural-blue hover:bg-neural-blue/20 transition-colors uppercase tracking-wider"
              >
                Upgrade
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
