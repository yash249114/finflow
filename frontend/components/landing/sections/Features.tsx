"use client";

import {
  Zap,
  Brain,
  TrendingUp,
  Bell,
  Shield,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import { GlowCard } from "./GlowCard";
import { FEATURES } from "@/lib/constants";

const iconMap = {
  Zap,
  Brain,
  TrendingUp,
  Bell,
  Shield,
  BarChart3,
} as const;

export function Features() {
  const [first, second, ...rest] = FEATURES;

  return (
    <section id="features" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Built for speed. Designed for scale.
          </h2>
          <p className="text-lg text-slate-400">
            Every component engineered for the demands of modern financial
            infrastructure. No compromises.
          </p>
        </motion.div>

        {/* Asymmetric bento: two featured cards top, four compact bottom */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {[first, second].map((feature, i) => {
            if (!feature) return null;
            const Icon = iconMap[feature.icon as keyof typeof iconMap];
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <GlowCard className="h-full p-8">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-indigo-400" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-md">
                    {feature.description}
                  </p>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rest.map((feature, i) => {
            const Icon = iconMap[feature.icon as keyof typeof iconMap];
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: (i + 2) * 0.06 }}
              >
                <GlowCard className="h-full p-6">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-indigo-400" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}