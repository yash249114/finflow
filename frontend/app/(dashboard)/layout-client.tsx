"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Menu, X, Bell } from "lucide-react";

interface User {
  id: string;
  email: string;
  full_name: string;
  plan: string;
}

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Get user details for badge/avatar
  useEffect(() => {
    const cachedUser = localStorage.getItem("ff_user");
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        // ignore
      }
    }
  }, [pathname]);

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-gray-300 font-sans select-none">
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
            {user && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider border ${
                  user.plan === "pro"
                    ? "bg-success/15 border-success/30 text-success"
                    : "bg-gray-800 border-gray-700 text-text-muted"
                }`}
              >
                {user.plan} Plan
              </span>
            )}

            {/* Notification Bell */}
            <button className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-900 transition-colors">
              <Bell className="h-5 w-5" />
            </button>

            {/* User Initials Badge */}
            {user && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white uppercase border border-blue-500/20">
                {getInitials(user.full_name)}
              </div>
            )}
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto bg-[#0A0F1E] p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
