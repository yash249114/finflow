'use client'

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/layout/sidebar";
import UserDropdown from "@/components/layout/user-dropdown";
import CopilotToggle from "@/components/copilot/copilot-toggle";
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
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    // ONLY redirect after loading is complete AND user is null
    if (!loading && !user) {
      const relativeFrom = '/' + pathname.replace(/^\/+/, '')
      console.log(`[LayoutClient Debug] Verification complete. User is null. Redirecting to target: /login?from=${relativeFrom}`)
      router.replace(`/login?from=${relativeFrom}`)
    }
  }, [loading, user, router, pathname])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/transactions") return "Transactions";
    if (pathname === "/forecast") return "Forecast";
    if (pathname === "/copilot") return "AI Copilot";
    if (pathname?.startsWith("/settings")) return "Settings";
    if (pathname?.startsWith("/admin")) return "Admin";
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
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#060608]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-text-muted text-sm animate-pulse">Verifying session…</p>
        </div>
      </div>
    )
  }

  // Still null after loading = redirect in progress
  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#060608] text-gray-300 font-sans select-none">
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex md:hidden"
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative flex flex-col h-full z-10"
            >
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-3 right-[-40px] text-gray-400 hover:text-white p-1.5 rounded-lg bg-white/5"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
              <Sidebar />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 shrink-0 border-b border-white/[0.04] bg-[#08080C]/80 backdrop-blur-xl flex items-center justify-between px-5 z-30">
          <div className="flex items-center space-x-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden text-text-muted hover:text-white focus:outline-none p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            {/* Page Title */}
            <h2 className="text-sm font-semibold tracking-tight text-text-secondary">
              {getPageTitle()}
            </h2>
          </div>

          {/* Right Area */}
          <div className="flex items-center space-x-2">
            {/* AI Copilot Quick Toggle */}
            <div className="hidden sm:block">
              <CopilotToggle />
            </div>

            {/* Notification Bell */}
            <button className="text-text-muted hover:text-white p-2 rounded-lg hover:bg-white/[0.04] transition-colors relative">
              <Bell className="h-4 w-4" />
              {/* Notification dot */}
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-neural-blue" />
            </button>

            {/* User Avatar / Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white uppercase transition-all ${
                  userDropdownOpen
                    ? 'ring-2 ring-neural-blue/40 bg-gradient-to-br from-neural-blue to-neural-violet'
                    : 'bg-gradient-to-br from-neural-blue/80 to-neural-violet/80 hover:from-neural-blue hover:to-neural-violet'
                }`}
                aria-label="User menu"
              >
                {getInitials(user.full_name)}
              </button>
              <UserDropdown
                open={userDropdownOpen}
                onClose={() => setUserDropdownOpen(false)}
              />
            </div>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto bg-[#060608]">
          <div className="p-5 md:p-7 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
