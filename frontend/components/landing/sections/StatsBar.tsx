"use client";

import { motion } from "framer-motion";
import { STATS } from "@/lib/constants";

export function StatsBar() {
  return (
    <section className="border-y border-slate-800 bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="text-center md:text-left"
            >
              <div className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1 font-mono">
                {stat.value}
              </div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}