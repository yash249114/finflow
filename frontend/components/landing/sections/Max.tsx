"use client";

import { motion } from "framer-motion";
import { Check, Star, ShieldCheck } from "lucide-react";
import MaxRequestForm from "@/components/landing/max-request-form";

export function Max() {
  return (
    <section id="max" className="py-24 relative border-t border-slate-800 bg-slate-900/20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* MAX Copy */}
        <div className="space-y-8 select-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono"
          >
            <Star className="h-3.5 w-3.5 fill-indigo-500" />
            Founder Intelligence Layer
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              FinFlow <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">MAX</span>
            </h2>
            <p className="text-base text-slate-400 leading-relaxed max-w-lg">
              This is not another billing package. FinFlow MAX is an isolated predictive layer acting as your autonomous CFO, alerting your board of runway anomalies weeks in advance.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-300"
          >
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-indigo-450 shrink-0" />
              <span>AI cash flow simulation</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-indigo-450 shrink-0" />
              <span>Predictive runway analysis</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-indigo-450 shrink-0" />
              <span>Automated anomaly detection</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-indigo-450 shrink-0" />
              <span>AI business health scoring</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-indigo-450 shrink-0" />
              <span>Future liquidity alerts</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-indigo-450 shrink-0" />
              <span>AI decision recommendations</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex items-center space-x-4 border-t border-slate-800 pt-6"
          >
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-[11px] text-slate-500 max-w-sm">
              MAX processing runtimes are completely isolated inside custom enterprise container clusters.
            </p>
          </motion.div>
        </div>

        {/* MAX Request Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex justify-center lg:justify-end"
        >
          <MaxRequestForm />
        </motion.div>
      </div>
    </section>
  );
}