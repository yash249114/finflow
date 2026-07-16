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
import { toast } from "sonner";
import { NeuralParticles } from "@/components/ui/neural-particles";

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
  const [maxModalOpen, setMaxModalOpen] = useState(false);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [strategicDetails, setStrategicDetails] = useState("");

  useEffect(() => {
    const handleOpenModal = () => setMaxModalOpen(true);
    window.addEventListener("open-max-waitlist", handleOpenModal);
    return () => window.removeEventListener("open-max-waitlist", handleOpenModal);
  }, []);

  const handleSubmitWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWaitlist(true);

    const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY || "e427140e-749e-4e4b-b0b3-3a780d6b9d62"; // Fallback demo key

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject: `FinFlow MAX Access Request - ${user?.full_name}`,
          name: user?.full_name,
          email: user?.email,
          company: companyName,
          message: strategicDetails,
        }),
      });

      const result = await response.json();
      if (result.success || response.ok) {
        toast.success("Your waitlist request for FinFlow MAX has been submitted! Our systems team will review your application.");
        setMaxModalOpen(false);
        setCompanyName("");
        setStrategicDetails("");
      } else {
        toast.error(result.message || "Failed to submit waitlist request.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while submitting application.");
    } finally {
      setSubmittingWaitlist(false);
    }
  };

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
    <div className="flex h-screen w-screen overflow-hidden bg-[#060608] text-gray-300 font-sans select-none relative">
      <NeuralParticles />
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
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white uppercase transition-[background-color,border-color,box-shadow,color,opacity] ${
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

      {/* Web3Forms MAX Access Waitlist Modal */}
      <AnimatePresence>
        {maxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setMaxModalOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-lg glass-card-elevated border border-white/10 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden space-y-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Enterprise Request
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">Request FinFlow MAX Access</h3>
                  <p className="text-xs text-gray-400 mt-1">Submit your enterprise profile details to get direct developer access and dedicated SLA routing.</p>
                </div>
                <button
                  onClick={() => setMaxModalOpen(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitWaitlist} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Your Email</label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full bg-zinc-950/40 border border-white/5 text-gray-500 text-xs rounded-xl px-4 py-3 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company / Organization</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Tech, Inc."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full input-premium text-xs rounded-xl px-4 py-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Strategic Requirements / Use Case</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe your data volume, team size, and integration requirements..."
                    value={strategicDetails}
                    onChange={(e) => setStrategicDetails(e.target.value)}
                    className="w-full input-premium text-xs rounded-xl px-4 py-3 resize-none focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingWaitlist}
                  className="w-full bg-indigo-650 hover:bg-indigo-600 disabled:bg-zinc-800 disabled:text-gray-600 text-white rounded-xl py-3 text-xs font-bold transition-[background-color,border-color,box-shadow,color,opacity] shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingWaitlist ? "Submitting Application..." : "Submit Strategic Request"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
