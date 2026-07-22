"use client";

import React from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import {
  Compass,
  Cpu,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import Logo from "@/components/ui/logo";
import BackButton from "@/components/ui/back-button";

// Animated grid overlay
function GridBackground() {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-[#08090A] bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:24px_24px] opacity-25">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#08090A]/80 to-[#08090A]" />
    </div>
  );
}

export default function AboutPage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
  };

  const techStack = [
    { name: "Next.js 14 & React 18", desc: "For dynamic server-rendered pages and ultra-fast client hydration." },
    { name: "Go (Golang) API Engine", desc: "High-performance backend gateway routing traffic and processing raw transaction inputs." },
    { name: "FastAPI & Python", desc: "Executing Holt-Winters time-series algorithms and confidence interval predictions." },
    { name: "PostgreSQL & Redis", desc: "Relational cash flows structured alongside real-time sub-millisecond cache sheets." },
  ];

  const milestones = [
    { q: "Q2 2026", t: "Dynamic Multi-Currency Support", d: "Silently auto-detecting and presenting localized financial metrics globally." },
    { q: "Q3 2026", t: "Live Bank Sync & Aggregation", d: "Integrating Plaid and banking APIs for instant, zero-manual CSV inputs." },
    { q: "Q4 2026", t: "Scenario Planning Simulations", d: "Modeling hiring plans, software burn, and revenue spikes with 3D projection charts." },
    { q: "Q1 2027", t: "AI CFO Voice Interfacing", d: "Querying financial runway status, anomaly logs, and budget health via conversational AI." },
  ];

  return (
    <div className="min-h-screen bg-[#08090A] text-gray-100 flex flex-col font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      <GridBackground />

      {/* Floating Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 -z-20 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "10s" }} />
      <div className="absolute bottom-1/4 right-1/4 -z-20 w-96 h-96 rounded-full bg-violet-500/5 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "14s" }} />

      {/* HEADER SECTION */}
      <header className="h-16 shrink-0 border-b border-[#1D1E22]/50 bg-[#08090A]/70 backdrop-blur-xl fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 md:px-12 select-none shadow-lg shadow-black/10">
        <Link href="/" className="flex items-center space-x-2 group">
          <Logo size={24} glow />
          <span className="text-lg font-bold tracking-tight text-white">FinFlow</span>
        </Link>
        <BackButton href="/" label="Back to Home" />
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-5xl mx-auto px-6 md:px-12 pt-32 pb-24 space-y-24 z-10">
        {/* HERO TITLE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4 max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3.5 py-1 text-[11px] font-bold text-indigo-400 uppercase tracking-widest cursor-default">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Built for Modern Founders</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]">
            AI-Native <br />
            <span className="text-indigo-400">
              Financial Intelligence
            </span>
          </h1>
          <p className="text-base text-gray-400 leading-relaxed max-w-xl mx-auto">
            At FinFlow, we build autonomous predictive engines that give founders total cash flow clarity before critical financial forks hit their business.
          </p>
        </motion.div>

        {/* MISSION & WHY IT EXISTS */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          <motion.div
            variants={itemVariants}
            className="glass-card border-[#1D1E22] hover:border-indigo-500/15 p-8 rounded-2xl space-y-4 relative overflow-hidden transition-colors"
          >
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Compass className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold text-white">Our Mission</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              We empower startups and SMBs with enterprise-grade cash flow analytics. No manual spreadsheets, no stale calculations. Just predictive forecasting that runs continuously in the background.
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="glass-card border-[#1D1E22] hover:border-indigo-500/15 p-8 rounded-2xl space-y-4 relative overflow-hidden transition-colors"
          >
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold text-white">Why FinFlow Exists</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              82% of small business failures are caused by cash flow mismanagement. Stale banking ledgers do not show tomorrow&apos;s obligations. FinFlow connects historical records with automated predictive analysis to alert founders of cash gaps weeks before they happen.
            </p>
          </motion.div>
        </motion.div>

        {/* PROBLEM & FORECASTING VISION */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="glass-card border-[#1D1E22] rounded-2xl p-8 space-y-6 relative overflow-hidden"
        >
          <div className="space-y-2">
            <h2 className="text-xs font-bold tracking-widest text-indigo-500 uppercase font-mono">The Problem</h2>
            <h3 className="text-2xl font-extrabold text-white">Traditional finance accounting is looking backward.</h3>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your bank statement tells you what happened yesterday. Your tax ledger structures last quarter&apos;s results. But as a founder, your decisions are about the next 30, 60, and 90 days. We built a machine learning engine using the Holt-Winters exponential smoothing method to look forward—dynamically adjusting to recurring cycles, seasonality, and sudden burn rate changes.
          </p>
        </motion.div>

        {/* TECH STACK */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-8"
        >
          <div className="text-center">
            <h2 className="text-xs font-bold tracking-widest text-indigo-500 uppercase font-mono">Architecture</h2>
            <h3 className="text-2xl font-extrabold text-white mt-1">Our Technology Stack</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {techStack.map((tech, idx) => (
              <motion.div
                variants={itemVariants}
                key={idx}
                className="glass-card border-[#1D1E22] hover:border-indigo-500/15 p-6 rounded-xl space-y-2 hover:bg-[#0F1012]/40 transition-colors"
              >
                <div className="flex items-center space-x-2 text-indigo-400">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span className="font-bold text-sm text-white">{tech.name}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed pl-6">{tech.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* SECURITY & PHILOSOPHY */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
        >
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest text-indigo-500 uppercase font-mono">Security</h2>
            <h3 className="text-2xl font-extrabold text-white">Bank-grade data isolation is our baseline.</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              We never store your direct banking credentials. All files uploaded are parsed instantly in isolated application memory, structured into encrypted relational tables, and cached securely. Access tokens are governed by JWT configurations with strictly scoped expiry parameters.
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="glass-card border-[#1D1E22] p-8 rounded-2xl flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="h-12 w-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2">
              <Shield className="h-6 w-6" />
            </div>
            <h4 className="text-base font-bold text-white">Encrypted at Rest & Transit</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Your financial records are strictly isolated. We run end-to-end SSL tunnels, token validation filters, and isolated container stacks.
            </p>
          </motion.div>
        </motion.div>

        {/* FUTURE ROADMAP */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-8"
        >
          <div className="text-center">
            <h2 className="text-xs font-bold tracking-widest text-indigo-500 uppercase font-mono">Future Roadmap</h2>
            <h3 className="text-2xl font-extrabold text-white mt-1">Founders Roadmap</h3>
          </div>

          <div className="relative border-l border-gray-800 ml-4 md:ml-8 pl-6 md:pl-8 space-y-8 py-2">
            {milestones.map((ms, idx) => (
              <motion.div variants={itemVariants} key={idx} className="relative">
                {/* Timeline node */}
                <span className="absolute -left-[31px] md:-left-[39px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#08090A] border-2 border-indigo-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                </span>

                <div className="space-y-1">
                  <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded text-indigo-400 font-bold uppercase tracking-wider">
                    {ms.q}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-1.5">{ms.t}</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">{ms.d}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CALL TO ACTION */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="border-t border-gray-900 pt-16 text-center space-y-6"
        >
          <h3 className="text-xl font-bold text-white">Ready to control your financial forecast?</h3>
          <div className="flex justify-center">
            <Link
              href="/register"
              className="btn-premium px-6 py-3 text-xs font-semibold text-white transition-[background-color,border-color,box-shadow,color,opacity] border border-indigo-500/30 rounded-xl"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-900 bg-gray-950 py-12 text-xs text-gray-500 select-none mt-auto">
        <div className="mx-auto max-w-5xl px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-2">
            <Logo size={20} glow={false} />
            <span className="font-bold text-gray-300">FinFlow</span>
            <span className="text-gray-800">|</span>
            <span>© 2026 FinFlow. All rights reserved.</span>
          </div>

          <div className="flex space-x-6">
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
