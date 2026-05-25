"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, TrendingUp, CreditCard, LogOut } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/ui/logo";

interface User {
  id: string;
  email: string;
  full_name: string;
  plan: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  useEffect(() => {
    // 1. Check local cache
    const cachedUser = localStorage.getItem("ff_user");
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        // ignore
      }
    }

    // 2. Fetch fresh user context from /me
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/me`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setUser(data.user);
            localStorage.setItem("ff_user", JSON.stringify(data.user));
          }
        }
      } catch {
        // let page handle redirect if needed
      }
    };

    fetchUser();
  }, [API_URL]);

  const handleLogout = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        localStorage.removeItem("ff_user");
        toast.success("Successfully logged out");
        router.push("/login");
        router.refresh();
      } else {
        toast.error("Logout failed. Please try again.");
      }
    } catch {
      toast.error("An error occurred during logout");
    }
  };

  const plan = user?.plan || "free";

  const links = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
    { name: "Forecast", href: "/forecast", icon: TrendingUp, showBadge: plan === "free" },
    { name: "Settings/Billing", href: "/settings/billing", icon: CreditCard },
  ];

  return (
    <div className="flex h-full w-[240px] flex-col border-r border-[#1D1E22] bg-[#08090A] text-gray-300 select-none">
      {/* Top logo */}
      <div className="flex h-14 items-center border-b border-[#1D1E22] px-6">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <Logo size={20} glow />
          <span className="text-lg font-bold tracking-tight text-text-primary">
            FinFlow
          </span>
        </Link>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-1 p-4">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");

          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-gray-400 hover:bg-gray-850 hover:text-text-primary"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className="h-5 w-5" />
                <span>{link.name}</span>
              </div>
              {link.showBadge && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
                  Pro
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile Section */}
      {user && (
        <div className="border-t border-[#1D1E22] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white uppercase">
                {user.full_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {user.full_name}
                </p>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="truncate text-xs text-text-muted capitalize">
                    {user.plan} Plan
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-text-muted hover:bg-gray-800 hover:text-danger transition-colors"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
