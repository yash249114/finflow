"use client";

import { Hero } from "@/components/landing/sections/Hero";
import { StatsBar } from "@/components/landing/sections/StatsBar";
import { Features } from "@/components/landing/sections/Features";
import Navbar from "@/components/layout/navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#08090A] text-gray-100 flex flex-col font-sans overflow-x-hidden selection:bg-indigo-500/30 relative">
      {/* Navigation */}
      <Navbar />

      {/* HERO */}
      <Hero />

      {/* METRICS BAR */}
      <StatsBar />

      {/* CORE FEATURES */}
      <Features />
    </div>
  );
}