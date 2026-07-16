"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, Users, ArrowLeft } from "lucide-react";
import { pageTransition } from "@/lib/motion";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: "Overview", href: "/admin", icon: BarChart3 },
    { name: "User Management", href: "/admin/users", icon: Users },
  ];

  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <Link 
              href="/dashboard"
              className="group flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-1.5 flex items-center gap-2">
            Admin Control Panel
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            System diagnostics, subscription tier status, and user directory management
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-zinc-950/60 border border-white/5 p-1 rounded-xl shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`relative flex items-center space-x-2 rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-[background-color,border-color,box-shadow,color,opacity] ${
                  isActive ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-active-tab"
                    className="absolute inset-0 bg-white/[0.08] rounded-lg border border-white/5"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[50vh]">
        {children}
      </div>
    </motion.div>
  );
}
