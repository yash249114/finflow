"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

export default function CopilotToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const plan = user?.plan || "free";

  const isCopilotPage = pathname === "/copilot";

  return (
    <motion.button
      onClick={() => router.push("/copilot")}
      className={`relative flex items-center space-x-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold tracking-wide transition-all select-none border cursor-pointer ${
        isCopilotPage
          ? "bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-white border-violet-500/30 glow-neural"
          : "bg-zinc-950/60 hover:bg-zinc-900 border-white/5 hover:border-violet-500/30 text-gray-300 hover:text-white"
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Sparkles className={`w-3.5 h-3.5 ${isCopilotPage ? "text-violet-400" : "text-gray-400 group-hover:text-violet-400"}`} />
      <span>Ask Copilot</span>

      {/* Pulsing indicator badge for insights */}
      {plan !== "free" && !isCopilotPage && (
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
        </span>
      )}
    </motion.button>
  );
}
