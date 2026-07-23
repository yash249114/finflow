"use client";

import { useState } from "react";
import { AuthProvider } from "@/lib/auth-context";
import Sidebar from "@/components/layout/sidebar";
import UserDropdown from "@/components/layout/user-dropdown";
import CopilotToggle from "@/components/copilot/copilot-toggle";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { NeuralParticles } from "@/components/ui/neural-particles";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </AuthProvider>
  );
}

function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase()
  }

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

  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#060608] text-gray-300 font-sans select-none relative">
      <NeuralParticles />

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-14 shrink-0 border-b border-white/[0.04] bg-[#08080C]/80 backdrop-blur-xl flex items-center justify-between px-5 z-30">
          <div className="flex items-center space-x-3">
            <h2 className="text-sm font-semibold tracking-tight text-text-secondary">
              Dashboard
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <CopilotToggle />

            <button className="text-text-muted hover:text-white p-2 rounded-lg hover:bg-white/[0.04] transition-colors relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-neural-blue" />
            </button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-neural-blue to-neural-violet text-xs font-bold text-white uppercase hover:opacity-80 transition-opacity"
              >
                {getInitials(user?.full_name)}
              </button>
              <UserDropdown open={userMenuOpen} onClose={() => setUserMenuOpen(false)} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#060608]">
          <div className="p-5 md:p-7 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
