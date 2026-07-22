"use client";

import { Hero } from "@/components/landing/sections/Hero";
import { StatsBar } from "@/components/landing/sections/StatsBar";
import { Features } from "@/components/landing/sections/Features";
import { Pricing } from "@/components/landing/sections/Pricing";
import { Testimonials } from "@/components/landing/sections/Testimonials";
import { CtaSection } from "@/components/landing/sections/CtaSection";
import { DashboardMockup } from "@/components/landing/sections/DashboardMockup";
import { Max } from "@/components/landing/sections/Max";
import Navbar from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

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

      {/* DASHBOARD MOCKUP */}
      <DashboardMockup />

      {/* PRICING */}
      <Pricing />

      {/* TESTIMONIALS */}
      <Testimonials />

      {/* MAX SECTION */}
      <Max />

      {/* CTA */}
      <CtaSection />

      {/* FOOTER */}
      <Footer />
    </div>
  );
}