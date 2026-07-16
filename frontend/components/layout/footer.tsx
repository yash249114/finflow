"use client";

import Link from "next/link";
import Logo from "@/components/ui/logo";

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-12 text-xs text-slate-500 select-none mt-auto">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Animated gradient divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent mb-12" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-2.5">
            <Logo size={20} glow={false} />
            <span className="font-bold text-slate-300">FinFlow</span>
            <span className="text-slate-800">|</span>
            <span>© 2025 FinFlow. All rights reserved.</span>
          </div>

          <div className="flex space-x-6 text-[11px]">
            <Link href="/about" className="hover:text-slate-300 transition-colors">About Us</Link>
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}