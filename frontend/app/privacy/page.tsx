// frontend/app/privacy/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import Logo from "@/components/ui/logo";
import BackButton from "@/components/ui/back-button";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#08090A] text-gray-300 font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 translate-x-1/2 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

      {/* Header/Nav */}
      <header className="sticky top-0 z-50 border-b border-[#1D1E22]/60 bg-[#08090A]/85 backdrop-blur-md">
        <div className="max-w-4xl mx-auto h-16 px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <Logo size={28} glow />
            <span className="font-extrabold text-white tracking-tight">FinFlow</span>
          </Link>
          <BackButton href="/" label="Back to Home" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16 relative z-10">
        <div className="border border-[#1D1E22]/80 bg-[#0F1012]/60 backdrop-blur-md rounded-2xl p-8 md:p-12 shadow-2xl">
          <div className="border-b border-[#1D1E22]/80 pb-6 mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              Privacy Policy
            </h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest">
              Last Updated: May 26, 2026
            </p>
          </div>

          <div className="space-y-8 text-sm leading-relaxed text-gray-400">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">1. Overview and Core Purpose</h2>
              <p>
                FinFlow is built to protect sensitive financial operations. We design our cash flow analytics and transaction classification 
                systems with privacy at their core. This Privacy Policy details how we collect, store, isolate, and compute data 
                submitted to our API gateway.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">2. Information We Collect</h2>
              <p>
                We minimize data collection to only what is necessary to authenticate users, calculate transactions statistics, and predict cash flows:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>User Identity Profiles:</strong> Full name and email address collected during registration to manage your secure session.</li>
                <li><strong>Transaction Ledgers:</strong> Bank account statements, dates, labels, and amounts provided through manual CSV file uploads.</li>
                <li><strong>Payment Metadata:</strong> Transaction hashes and plan statuses validated by Lemon Squeezy (we never see or store billing cards directly).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">3. How Data is Processed & Secured</h2>
              <p>
                All data uploaded to the Service is handled in isolated database environments:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>AI Classification:</strong> Raw CSV description strings are converted in real-time to categorical features (e.g. Infrastructure, Travel, Revenue).</li>
                <li><strong>In-Memory ML Forecasting:</strong> Holt-Winters mathematical calculations occur on secure containerized servers, and forecast results are cached inside secure Redis partitions.</li>
                <li><strong>Cookies:</strong> Session tokens are written inside secure HTTP-only cookies, keeping your access safe from scripting vulnerabilities (XSS).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">4. Third-Party Services and Integrations</h2>
              <p>
                We do not sell, distribute, or rent your transaction data. We share metadata strictly with partners that secure the operation of our platform:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Lemon Squeezy:</strong> Orchestrates payment portals and validates Pro plan subscription active parameters.</li>
                <li><strong>Web3Forms:</strong> Sends secure email notices (like signup confirmations or max access responses) to your email.</li>
                <li><strong>Supabase / Upstash:</strong> Serves as our secure hosting backend data vaults (PostgreSQL and Redis).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">5. User Control & Data Deletion</h2>
              <p>
                You retain complete ownership over your uploaded ledger records. If you decide to cancel your account or purge transaction uploads, you can instantly erase your financial database records through the transaction manager or by contacting us. All user relations are permanently deleted from database volumes on request.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">6. Policy Updates</h2>
              <p>
                Any changes to this policy will be announced on our main dashboard page. If you have questions regarding database security, CA certificate authorities, or data compliance, please reach out to us.
              </p>
            </section>
          </div>

          <div className="border-t border-[#1D1E22]/80 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-gray-500">
              Questions? Contact us at legal@finflow.dev
            </span>
            <Link 
              href="/terms" 
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
            >
              Read our Terms of Service &rarr;
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
