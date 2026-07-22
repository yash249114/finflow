"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import Link from "next/link";
import { CURRENCIES, formatPrice } from "@/lib/currency";

export function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly");

  const curConfig = CURRENCIES["USD"];

  const calculatePrice = (baseVal: number) => {
    if (baseVal === 0) return 0;
    if (billingPeriod === "annually") {
      return Math.round(baseVal * 0.8);
    }
    return baseVal;
  };

  return (
    <section id="pricing" className="py-24 relative border-t border-slate-800">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative flex flex-col items-center">
        <div className="text-center mb-12 select-none">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold tracking-widest text-indigo-500 uppercase font-mono"
          >
            Pricing Options
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mt-2"
          >
            Simple, transparent pricing tiers
          </motion.p>
        </div>

        {/* Toggle billing period */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex p-1 bg-slate-900/60 border border-slate-800 rounded-xl relative select-none mb-12 font-mono text-[10px]"
        >
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={`px-4 py-1.5 font-bold uppercase rounded-lg transition-[background-color,border-color,box-shadow,color,opacity] ${
              billingPeriod === "monthly"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod("annually")}
            className={`px-4 py-1.5 font-bold uppercase rounded-lg transition-[background-color,border-color,box-shadow,color,opacity] flex items-center gap-1 ${
              billingPeriod === "annually"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Annually
            <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-bold px-1.5 rounded-full border border-emerald-500/20 font-sans normal-case">
              -20%
            </span>
          </button>
        </motion.div>

        {/* Pricing cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full items-stretch"
        >
          {/* Free */}
          <motion.div
            whileHover={{ y: -5 }}
            className="glass-card border-slate-800 hover:border-indigo-500/10 rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden shadow-lg select-none hover:shadow-[0_0_30px_rgba(99,102,241,0.03)] transition-[background-color,border-color,box-shadow,color,opacity] duration-300"
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">Free</h3>
                <p className="text-xs text-slate-400 mt-1">For micro business forecasts</p>
              </div>
              <div className="flex items-baseline">
                <span className="text-4xl font-extrabold text-white font-mono">
                  {formatPrice(calculatePrice(curConfig.plans.free), curConfig)}
                </span>
                <span className="text-xs text-slate-500 ml-1">/ month</span>
              </div>
              <ul className="space-y-3.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Up to 250 transactions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>CSV imports</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Basic dashboard & charts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>AI categorization</span>
                </li>
                <li className="flex items-center gap-2 text-slate-600">
                  <Check className="h-4 w-4 text-emerald-400 opacity-40 shrink-0" />
                  <span>Limited forecasting horizons</span>
                </li>
              </ul>
            </div>
            <Link
              href="/register"
              className="mt-8 block w-full text-center rounded-xl btn-chrome text-xs font-semibold py-3 transition-[background-color,border-color,box-shadow,color,opacity] text-white border border-slate-800 font-mono uppercase tracking-wider"
            >
              Get Started Free
            </Link>
          </motion.div>

          {/* Pro Plan */}
          <motion.div
            whileHover={{ y: -5 }}
            className="glass-card border-indigo-500/30 bg-gradient-to-b from-indigo-500/5 to-transparent rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden shadow-xl shadow-indigo-500/5 select-none hover:shadow-[0_0_30px_rgba(99,102,241,0.08)] transition-[background-color,border-color,box-shadow,color,opacity] duration-300"
          >
            <div className="absolute top-4 right-4 rounded-full bg-indigo-500/10 px-3 py-1 text-[9px] font-bold text-indigo-400 border border-indigo-500/20 flex items-center gap-1 uppercase tracking-wider font-mono">
              <Star className="h-3 w-3 fill-indigo-500" />
              Popular
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">Pro</h3>
                <p className="text-xs text-slate-400 mt-1">Unlock advanced prediction insights</p>
              </div>
              <div className="flex items-baseline">
                <span className="text-4xl font-extrabold text-white font-mono">
                  {formatPrice(calculatePrice(curConfig.plans.pro), curConfig)}
                </span>
                <span className="text-xs text-slate-500 ml-1">/ month</span>
              </div>
              <ul className="space-y-3.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">Unlimited transactions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Advanced prediction logic</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>30 / 60 / 90 day horizons</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Anomaly spending alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Priority system support</span>
                </li>
              </ul>
            </div>

            <Link
              href="/register"
              className="mt-8 block w-full text-center rounded-xl btn-premium text-xs font-semibold py-3 transition-[background-color,border-color,box-shadow,color,opacity] text-white border border-indigo-500/30 font-mono uppercase tracking-wider"
            >
              Upgrade to Pro
            </Link>
          </motion.div>

          {/* FinFlow MAX */}
          <motion.div
            whileHover={{ y: -5 }}
            className="glass-card border-slate-800 hover:border-indigo-500/10 rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden shadow-lg select-none hover:shadow-[0_0_30px_rgba(99,102,241,0.03)] transition-[background-color,border-color,box-shadow,color,opacity] duration-300"
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                  FinFlow MAX
                </h3>
                <p className="text-xs text-slate-400 mt-1">Enterprise cash decision engine</p>
              </div>
              <div className="flex items-baseline">
                <span className="text-2xl font-extrabold text-white">Custom Tier</span>
              </div>
              <ul className="space-y-3.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>AI runway simulations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Founder CFO intelligence layer</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Advanced business scoring</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>API access & team integrations</span>
                </li>
              </ul>
            </div>

            <a
              href="#max"
              className="mt-8 block w-full text-center rounded-xl btn-chrome text-xs font-semibold py-3 transition-[background-color,border-color,box-shadow,color,opacity] text-white border border-slate-800 font-mono uppercase tracking-wider"
            >
              Request MAX Access
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}