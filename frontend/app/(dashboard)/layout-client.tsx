'use client'

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Menu, X, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import LoadingSpinner from "@/components/ui/loading-spinner";

export function LayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    // ONLY redirect after loading is complete AND user is null
    if (!loading && !user) {
      console.log(`[LayoutClient Debug] Verification complete. User is null. Redirecting to /login?from=${pathname}`)
      router.replace(`/login?from=${pathname}`)
    }
  }, [loading, user, router, pathname])

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/transactions") return "Transactions";
    if (pathname === "/forecast") return "Forecast";
    if (pathname === "/settings/billing") return "Billing & Subscriptions";
    return "FinFlow";
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  // Show full-page spinner while verifying auth
  // This blocks any flash of dashboard content
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#08090A]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-500 text-sm">Verifying session...</p>
        </div>
      </div>
    )
  }

  // Still null after loading = redirect in progress
  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#08090A] text-gray-300 font-sans select-none">
      {/* Desktop Sidebar (Left) */}
      <div className="hidden md:block shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative flex w-[240px] flex-col bg-gray-950 h-full">
            {/* Close button */}
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar />
          </div>
          {/* Backdrop tap to close */}
          <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Content Container (Right) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 shrink-0 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center space-x-4">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-white focus:outline-none p-1"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Page Title */}
            <h2 className="text-sm font-semibold tracking-tight text-white uppercase">
              {getPageTitle()}
            </h2>
          </div>

          {/* Right Area items */}
          <div className="flex items-center space-x-4">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider border ${
                user.plan === "pro"
                  ? "bg-success/15 border-success/30 text-success"
                  : "bg-gray-800 border-gray-700 text-text-muted"
              }`}
            >
              {user.plan} Plan
            </span>

            {/* Notification Bell */}
            <button className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-900 transition-colors">
              <Bell className="h-5 w-5" />
            </button>

            {/* User Initials Badge */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white uppercase border border-blue-500/20">
              {getInitials(user.full_name)}
            </div>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto bg-[#0A0F1E] p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
