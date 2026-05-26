"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Zap,
  Brain,
  TrendingUp,
  Bell,
  Lock,
  BarChart2,
  Check,
  Sparkles,
  Star,
  ShieldCheck,
} from "lucide-react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import Navbar from "@/components/layout/navbar";
import MaxRequestForm from "@/components/landing/max-request-form";
import Logo from "@/components/ui/logo";
import { CURRENCIES, type CurrencyCode, formatPrice } from "@/lib/currency";

// Floating light particles overlay
function FloatingParticles() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-20 opacity-30">
      {[...Array(12)].map((_, i) => {
        const size = Math.random() * 4 + 2; // 2px to 6px
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const delay = Math.random() * 8;
        const duration = Math.random() * 15 + 15; // 15s to 30s
        return (
          <motion.div
            key={i}
            className="absolute rounded-full bg-indigo-500/20 blur-[1px]"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: `${top}%`,
            }}
            animate={{
              y: [0, -120, 0],
              x: [0, Math.random() * 30 - 15, 0],
              opacity: [0.1, 0.5, 0.1],
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              delay: delay,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}

// Futuristic Animated Mesh Gradient Background
function MeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-30 bg-[#08090A]">
      <FloatingParticles />
      {/* Aurora Orb 1 */}
      <div
        className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-500/5 blur-[120px] animate-aurora-flow"
        style={{ animationDuration: "30s" }}
      />
      {/* Aurora Orb 2 */}
      <div
        className="absolute bottom-[-15%] right-[-10%] w-[65vw] h-[65vw] rounded-full bg-purple-500/5 blur-[120px] animate-aurora-flow"
        style={{ animationDuration: "40s", animationDelay: "-8s" }}
      />
      {/* Aurora Orb 3 */}
      <div
        className="absolute top-[35%] right-[10%] w-[45vw] h-[45vw] rounded-full bg-cyan-500/3 blur-[120px] animate-aurora-flow"
        style={{ animationDuration: "35s", animationDelay: "-15s" }}
      />
    </div>
  );
}

// 3D Tilt Feature Card
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  delay: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 120 };
  const rotateX = useSpring(useTransform(y, [-100, 100], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(x, [-100, 100], [-8, 8]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    x.set(mouseX);
    y.set(mouseY);
    
    cardRef.current.style.setProperty("--x", `${e.clientX - rect.left}px`);
    cardRef.current.style.setProperty("--y", `${e.clientY - rect.top}px`);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="group relative glass-card border-[#1D1E22] rounded-2xl p-6 transition-all duration-300 hover:border-indigo-500/25 hover:bg-[#0F1012]/60 shadow-lg hover:shadow-indigo-500/5 select-none"
    >
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="absolute -inset-px rounded-2xl bg-[radial-gradient(100px_circle_at_var(--x,0px)_var(--y,0px),rgba(99,102,241,0.1),transparent_80%)] pointer-events-none" />

      <div style={{ transform: "translateZ(30px)" }} className="relative space-y-4">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 group-hover:text-indigo-300 transition-all duration-300">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-bold text-white group-hover:text-indigo-455 transition-colors duration-300">
          {title}
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

// 3D Parallax Dashboard Preview Mockup
function InteractiveDashboardMockup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 100 };
  const rotateX = useSpring(useTransform(mouseY, [-250, 250], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-250, 250], [-8, 8]), springConfig);

  const translateZ1 = 20;
  const translateZ2 = 40;
  const translateZ3 = 60;

  // Diagonal reflection overlay sweep
  const reflectionX = useSpring(useTransform(mouseX, [-250, 250], ["0%", "100%"]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 1200 }}
      className="relative mx-auto max-w-5xl rounded-2xl border border-[#1D1E22] bg-[#0F1012]/20 p-4 shadow-2xl shadow-indigo-500/5 backdrop-blur-md overflow-visible select-none"
    >
      {/* Sweep highlights across the outer frame */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative h-[480px] w-full rounded-xl border border-[#1D1E22]/60 bg-gray-950 flex overflow-hidden shadow-2xl transition-all duration-300"
      >
        {/* Cinematic shine reflection layer */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-10 opacity-20 mix-blend-overlay"
          style={{
            background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.15) 48%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 52%, transparent 65%)",
            backgroundSize: "200% 100%",
            x: reflectionX,
          }}
        />

        {/* Faux Sidebar */}
        <div className="w-14 shrink-0 border-r border-gray-900 bg-gray-950/80 flex flex-col items-center py-5 justify-between">
          <div className="flex flex-col space-y-5 items-center">
            <Logo size={22} glow={false} />
            {[BarChart2, Zap, TrendingUp, Lock].map((Icon, idx) => (
              <div
                key={idx}
                className={`h-8 w-8 rounded-lg flex items-center justify-center text-gray-600 transition-colors ${
                  idx === 0 ? "bg-indigo-600/10 text-indigo-500 border border-indigo-500/15" : "hover:text-gray-400"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </div>
          <div className="h-7 w-7 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 font-mono">
            U
          </div>
        </div>

        {/* Faux Main content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#08090a]/40 overflow-hidden relative">
          {/* Top spotlight gradients */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.03),transparent_60%)] pointer-events-none" />

          {/* Top bar header */}
          <div className="h-12 border-b border-gray-900 px-6 flex items-center justify-between bg-gray-950/40">
            <div className="flex items-center space-x-2.5">
              <span className="text-xs font-semibold text-gray-300">Overview</span>
              <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                Live Feed
              </span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Runway Outlook</span>
          </div>

          {/* Faux body */}
          <div className="flex-1 p-6 space-y-5 overflow-y-auto">
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { t: "Net Flow", v: "$42,391.22", diff: "+12.4%", p: true },
                { t: "Income", v: "$68,102.80", diff: "+8.1%", p: true },
                { t: "Expenses", v: "$25,711.58", diff: "+4.2%", p: false },
                { t: "Horizon Score", v: "Optimal", diff: "90 Days", p: true },
              ].map((st, idx) => (
                <div key={idx} className="bg-gray-900/40 border border-gray-850/80 p-4 rounded-xl space-y-1.5 hover:border-indigo-500/10 transition-colors">
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">{st.t}</div>
                  <div className="text-sm font-bold text-white font-mono">{st.v}</div>
                  <div className={`text-[9px] font-bold ${st.p ? "text-emerald-400" : "text-red-400"}`}>
                    {st.diff}
                  </div>
                </div>
              ))}
            </div>

            {/* Line chart widget */}
            <div className="bg-gray-900/20 border border-gray-850/80 rounded-xl p-5 relative overflow-hidden">
              {/* Realtime Scanning Prediction Beam */}
              <motion.div
                className="absolute top-0 bottom-0 w-[1.5px] bg-gradient-to-b from-transparent via-indigo-500/30 to-transparent pointer-events-none"
                animate={{ left: ["0%", "100%", "0%"] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="flex items-center justify-between mb-5">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Liquidity Index</span>
                  <div className="text-xs font-bold text-white">Estimated Cash Flow Trend</div>
                </div>
                <div className="flex items-center space-x-3 text-[9px] text-gray-400 font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Actual</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 border border-dashed border-violet-400 rounded-full" /> Forecast</span>
                </div>
              </div>

              {/* Glowing SVG Charts */}
              <div className="h-36 w-full relative overflow-visible">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
                  <defs>
                    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="0.8" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <linearGradient id="glow-actual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="glow-forecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Historical path */}
                  <path id="actual-path" d="M 0 25 Q 12 23 24 24 T 48 15 T 65 17" fill="none" stroke="#6366f1" strokeWidth="1.2" filter="url(#neon-glow)" />
                  <path d="M 0 25 Q 12 23 24 24 T 48 15 T 65 17 L 65 30 L 0 30 Z" fill="url(#glow-actual)" />

                  {/* Predicted path */}
                  <path id="forecast-path" d="M 65 17 Q 78 11 88 13 T 100 5" fill="none" stroke="#8b5cf6" strokeWidth="1.2" strokeDasharray="1.5 1" filter="url(#neon-glow)" />
                  <path d="M 65 17 Q 78 11 88 13 T 100 5 L 100 30 L 65 30 Z" fill="url(#glow-forecast)" />

                  {/* Confidence bounds */}
                  <path d="M 65 17 Q 78 7 88 8 T 100 1 L 100 10 Q 88 17 78 15 T 65 17 Z" fill="#8b5cf6" fillOpacity="0.03" />
                  
                  {/* Animating flow pulse along forecast path */}
                  <circle r="1" fill="#a78bfa">
                    <animateMotion dur="5s" repeatCount="indefinite" path="M 65 17 Q 78 11 88 13 T 100 5" />
                  </circle>
                </svg>

                {/* Vertical Divider for Today */}
                <div className="absolute top-0 bottom-0 left-[65%] border-l border-dashed border-gray-700/80 flex flex-col justify-start">
                  <span className="text-[8px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono -translate-x-1/2 -mt-2.5 backdrop-blur-md">
                    Today
                  </span>
                </div>

                {/* Pulsing indicator */}
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute right-6 top-[15%] flex h-2.5 w-2.5"
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
                </motion.span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating Panel 1 (Left - translateZ1) */}
      <motion.div
        style={{ transform: `translateZ(${translateZ1}px)`, transformStyle: "preserve-3d" }}
        className="absolute -left-6 top-24 glass-card border-[#1D1E22] p-4 rounded-xl shadow-2xl flex items-center space-x-3.5 backdrop-blur-xl pointer-events-none select-none hidden md:flex border-l-4 border-l-indigo-500"
      >
        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
          <Star className="h-4 w-4 fill-indigo-500" />
        </div>
        <div>
          <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Net Flow</div>
          <div className="text-xs font-bold text-white font-mono">+$42,391.22</div>
        </div>
      </motion.div>

      {/* Floating Panel 2 (Bottom Right - translateZ2) */}
      <motion.div
        style={{ transform: `translateZ(${translateZ2}px)`, transformStyle: "preserve-3d" }}
        className="absolute -right-6 bottom-16 glass-card border-[#1D1E22] p-4 rounded-xl shadow-2xl flex items-center space-x-3.5 backdrop-blur-xl pointer-events-none select-none hidden md:flex"
      >
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
          <Check className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">CFO Verification</div>
          <div className="text-xs font-semibold text-gray-300">Runways synced live</div>
        </div>
      </motion.div>

      {/* Floating Panel 3 (Top Right - translateZ3) */}
      <motion.div
        style={{ transform: `translateZ(${translateZ3}px)`, transformStyle: "preserve-3d" }}
        className="absolute -right-8 top-28 bg-gradient-to-br from-indigo-950/40 to-violet-950/40 border border-indigo-500/30 p-4 rounded-xl shadow-2xl flex flex-col space-y-1.5 backdrop-blur-xl pointer-events-none select-none hidden lg:flex"
      >
        <div className="flex items-center space-x-2">
          <Sparkles className="h-3.5 w-3.5 text-indigo-450 animate-pulse" />
          <span className="text-[9px] text-white font-black uppercase tracking-widest font-mono">MAX Score</span>
        </div>
        <div className="text-base font-black text-white font-mono">98.2<span className="text-[10px] text-gray-500">/100</span></div>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly");

  const heroRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 45, stiffness: 180, mass: 1.2 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const handleHeroMouseMove = (e: React.MouseEvent) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  useEffect(() => {
    const handleGlobalCurrency = (e: Event) => {
      const customEvent = e as CustomEvent<CurrencyCode>;
      if (customEvent.detail) {
        setCurrency(customEvent.detail);
      }
    };
    window.addEventListener("currencyChange", handleGlobalCurrency);

    const saved = localStorage.getItem("ff_currency") as CurrencyCode;
    if (saved && CURRENCIES[saved]) {
      setCurrency(saved);
    }

    return () => window.removeEventListener("currencyChange", handleGlobalCurrency);
  }, []);

  const curConfig = CURRENCIES[currency];

  const calculatePrice = (baseVal: number) => {
    if (baseVal === 0) return 0;
    if (billingPeriod === "annually") {
      return Math.round(baseVal * 0.8);
    }
    return baseVal;
  };

  return (
    <div className="min-h-screen bg-[#08090A] text-gray-100 flex flex-col font-sans overflow-x-hidden selection:bg-indigo-500/30 relative">
      {/* Floating mesh gradients */}
      <MeshBackground />

      {/* Navigation */}
      <Navbar />

      {/* HERO SECTION */}
      <section
        ref={heroRef}
        onMouseMove={handleHeroMouseMove}
        className="relative pt-44 pb-24 overflow-hidden flex flex-col items-center justify-center min-h-[90vh]"
      >
        {/* Dynamic Glow Spotlight with liquid spring lag */}
        <motion.div
          style={{
            left: useTransform(smoothX, (x) => x - 300),
            top: useTransform(smoothY, (y) => y - 300),
          }}
          className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.06),transparent_70%)] pointer-events-none -z-10 hidden md:block"
        />

        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center flex flex-col items-center relative">
          {/* Top Badge (Glow pulse + uppercase spacing) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-6 py-2.5 text-[10px] font-bold text-indigo-400 mb-8 backdrop-blur-md shadow-lg shadow-indigo-500/10 cursor-default select-none animate-pulse shrink-0 tracking-widest uppercase w-fit max-w-[90vw] justify-center"
          >
            <span className="mr-1">✦</span> AI-Powered Cash Flow Operating System
          </motion.div>

          {/* Heading (Massive, sweep gradient) */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.05] select-none">
            <motion.span
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-block"
            >
              Know Where Your
            </motion.span>{" "}
            <br />
            <motion.span
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent inline-block py-1.5 text-gradient-sweep"
            >
              Cash Flow Goes
            </motion.span>{" "}
            <br />
            <motion.span
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="inline-block"
            >
              Before It Does.
            </motion.span>
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-base sm:text-lg text-[#8E919A] max-w-2xl mx-auto mt-8 leading-relaxed select-none"
          >
            FinFlow uses machine learning to categorize transactions, forecast your next 90 days, and alert you before cash flow surprises hit your business.
          </motion.p>

          {/* CTA Row */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-10 flex flex-row items-center justify-center gap-4 w-full max-w-md px-4"
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
              <Link
                href="/register"
                className="w-full btn-premium py-3.5 text-xs sm:text-sm font-semibold text-white block h-12 rounded-xl border border-indigo-500/30 shadow-lg transition-all flex items-center justify-center font-mono uppercase tracking-wider"
              >
                Start for Free
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
              <Link
                href="/login"
                className="w-full btn-chrome py-3.5 text-xs sm:text-sm font-semibold text-gray-200 block h-12 rounded-xl border border-[#1D1E22] shadow-md transition-all flex items-center justify-center font-mono uppercase tracking-wider"
              >
                View Dashboard
              </Link>
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8 text-gray-650 text-[10px] uppercase font-bold tracking-widest font-mono"
          >
            Built for modern founders
          </motion.p>
        </div>
      </section>

      {/* METRICS BAR */}
      <section className="border-y border-gray-900 bg-gray-950/20 py-8 select-none relative z-10 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { val: "25K+", label: "Transactions Processed" },
              { val: "97.4%", label: "Forecast Accuracy" },
              { val: "30/60/90", label: "Forecast Horizons" },
              { val: "100%", label: "Data Isolation" },
            ].map((stat, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                key={idx}
              >
                <div className="text-xl sm:text-2xl font-black text-white font-mono">{stat.val}</div>
                <div className="text-[9px] text-gray-500 mt-1 uppercase font-bold tracking-wider font-mono">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* INTERACTIVE DASHBOARD PREVIEW */}
      <section id="demo" className="py-24 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16 select-none">
            <h2 className="text-xs font-bold tracking-widest text-indigo-500 uppercase font-mono">
              Dashboard Mockup
            </h2>
            <p className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mt-2">
              Autonomous forecast visualization
            </p>
          </div>

          <InteractiveDashboardMockup />
        </div>
      </section>

      {/* CORE FEATURES */}
      <section id="features" className="py-24 relative bg-gray-950/20 border-t border-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16 select-none">
            <h2 className="text-xs font-bold tracking-widest text-indigo-500 uppercase font-mono">
              Core Capabilities
            </h2>
            <p className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mt-2">
              Autonomous intelligence modules
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Zap}
              title="Instant CSV Import"
              description="Upload any bank export. We handle messy dates, currencies, and malformed rows automatically."
              delay={0.1}
            />
            <FeatureCard
              icon={Brain}
              title="AI Categorization"
              description="Machine learning classifies every transaction into 10+ categories with confidence scoring."
              delay={0.2}
            />
            <FeatureCard
              icon={TrendingUp}
              title="90-Day Forecasting"
              description="Holt-Winters time-series forecasting with upper/lower confidence bands for every horizon."
              delay={0.3}
            />
            <FeatureCard
              icon={Bell}
              title="Anomaly Alerts"
              description="Automatic detection of unusual spending patterns before they become cash flow problems."
              delay={0.4}
            />
            <FeatureCard
              icon={Lock}
              title="Bank-Grade Isolation"
              description="JWT auth, isolated memory allocations, bcrypt hashing, and fully isolated data arrays."
              delay={0.5}
            />
            <FeatureCard
              icon={BarChart2}
              title="Live Visualizations"
              description="Recharts-powered interactive analytics update in real-time as you load transaction logs."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-24 relative border-t border-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative flex flex-col items-center">
          <div className="text-center mb-12 select-none">
            <h2 className="text-xs font-bold tracking-widest text-indigo-500 uppercase font-mono">
              Pricing Options
            </h2>
            <p className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mt-2">
              Simple, transparent pricing tiers
            </p>
          </div>

          {/* Toggle billing period */}
          <div className="flex p-1 bg-gray-900/60 border border-gray-800 rounded-xl relative select-none mb-12 font-mono text-[10px]">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-1.5 font-bold uppercase rounded-lg transition-all ${
                billingPeriod === "monthly" ? "bg-indigo-600 text-white shadow-md" : "text-gray-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("annually")}
              className={`px-4 py-1.5 font-bold uppercase rounded-lg transition-all flex items-center gap-1 ${
                billingPeriod === "annually" ? "bg-indigo-600 text-white shadow-md" : "text-gray-400 hover:text-white"
              }`}
            >
              Annually
              <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-bold px-1.5 rounded-full border border-emerald-500/20 font-sans normal-case">
                -20%
              </span>
            </button>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full items-stretch">
            {/* Free */}
            <motion.div
              whileHover={{ y: -5 }}
              className="glass-card border-[#1D1E22] hover:border-indigo-500/10 rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden shadow-lg select-none hover:shadow-[0_0_30px_rgba(99,102,241,0.03)] transition-all duration-300"
            >
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Free</h3>
                  <p className="text-xs text-[#8E919A] mt-1">For micro business forecasts</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl font-extrabold text-white font-mono">
                    {formatPrice(calculatePrice(curConfig.plans.free), curConfig)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">/ month</span>
                </div>
                <ul className="space-y-3.5 text-xs text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span>Up to 250 transactions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span>CSV imports</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span>Basic dashboard & charts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span>AI categorization</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-650">
                    <Check className="h-4 w-4 text-emerald-450 opacity-40 shrink-0" />
                    <span>Limited forecasting horizons</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register"
                className="mt-8 block w-full text-center rounded-xl btn-chrome text-xs font-semibold py-3 transition-all text-white border border-[#1D1E22] font-mono uppercase tracking-wider"
              >
                Get Started Free
              </Link>
            </motion.div>

            {/* Pro Plan */}
            <motion.div
              whileHover={{ y: -5 }}
              className="glass-card border-indigo-500/30 bg-gradient-to-b from-indigo-500/5 to-transparent rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden shadow-xl shadow-indigo-500/5 select-none hover:shadow-[0_0_30px_rgba(99,102,241,0.08)] transition-all duration-300"
            >
              <div className="absolute top-4 right-4 rounded-full bg-indigo-500/10 px-3 py-1 text-[9px] font-bold text-indigo-400 border border-indigo-500/20 flex items-center gap-1 uppercase tracking-wider font-mono">
                <Star className="h-3 w-3 fill-indigo-500" />
                Popular
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Pro</h3>
                  <p className="text-xs text-[#8E919A] mt-1">Unlock advanced prediction insights</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl font-extrabold text-white font-mono">
                    {formatPrice(calculatePrice(curConfig.plans.pro), curConfig)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">/ month</span>
                </div>
                <ul className="space-y-3.5 text-xs text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span className="font-semibold">Unlimited transactions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span>Advanced prediction logic</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span>30 / 60 / 90 day horizons</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span>Anomaly spending alerts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span>Priority system support</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/register"
                className="mt-8 block w-full text-center rounded-xl btn-premium text-xs font-semibold py-3 transition-all text-white border border-indigo-500/30 font-mono uppercase tracking-wider"
              >
                Upgrade to Pro
              </Link>
            </motion.div>

            {/* FinFlow MAX */}
            <motion.div
              whileHover={{ y: -5 }}
              className="glass-card border-[#1D1E22] hover:border-indigo-500/10 rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden shadow-lg select-none hover:shadow-[0_0_30px_rgba(99,102,241,0.03)] transition-all duration-300"
            >
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                    FinFlow MAX
                  </h3>
                  <p className="text-xs text-[#8E919A] mt-1">Enterprise cash decision engine</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-2xl font-extrabold text-white">Custom Tier</span>
                </div>
                <ul className="space-y-3.5 text-xs text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
                    <span>AI runway simulations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-450 shrink-0" />
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
                className="mt-8 block w-full text-center rounded-xl btn-chrome text-xs font-semibold py-3 transition-all text-white border border-[#1D1E22] font-mono uppercase tracking-wider"
              >
                Request MAX Access
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FINFLOW MAX SECTION */}
      <section id="max" className="py-24 relative border-t border-gray-900 bg-gray-950/20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* MAX Copy */}
          <div className="space-y-8 select-none">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">
              <Star className="h-3.5 w-3.5 fill-indigo-500" />
              Founder Intelligence Layer
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                FinFlow <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">MAX</span>
              </h2>
              <p className="text-base text-gray-400 leading-relaxed max-w-lg">
                This is not another billing package. FinFlow MAX is an isolated predictive layer acting as your autonomous CFO, alerting your board of runway anomalies weeks in advance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-gray-300">
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
            </div>

            <div className="flex items-center space-x-4 border-t border-gray-900 pt-6">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
              <p className="text-[11px] text-gray-500 max-w-sm">
                MAX processing runtimes are completely isolated inside custom enterprise container clusters.
              </p>
            </div>
          </div>

          {/* MAX Request Form */}
          <div className="flex justify-center lg:justify-end">
            <MaxRequestForm />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-900 bg-gray-950 py-12 text-xs text-gray-500 select-none mt-auto">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Animated gradient divider */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent mb-12" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-2.5">
              <Logo size={20} glow={false} />
              <span className="font-bold text-gray-300">FinFlow</span>
              <span className="text-gray-800">|</span>
              <span>© 2025 FinFlow. All rights reserved.</span>
            </div>

            <div className="flex space-x-6 text-[11px]">
              <Link href="/about" className="hover:text-gray-300 transition-colors">About Us</Link>
              <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
