"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden pt-24">
      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-medium text-indigo-500 tracking-wide">
              Now in public beta
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-[-0.03em] leading-[0.95] mb-6"
          >
            Financial infrastructure{" "}
            <span className="text-indigo-400">
              for the internet economy
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-lg md:text-xl text-slate-400 max-w-[540px] leading-relaxed mb-10"
          >
            Move money programmatically. Real-time payments, intelligent
            routing, and unified financial operations — built for developers
            who ship fast.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-start gap-4"
          >
            <Link href="/register">
              <Button size="lg" className="group">
                Start building
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary" size="lg">
                View dashboard
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12 flex flex-wrap items-center gap-6 text-sm text-slate-500"
          >
            <span className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              Free tier available
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              SOC 2 Type II
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}