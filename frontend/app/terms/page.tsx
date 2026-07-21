// frontend/app/terms/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import Logo from "@/components/ui/logo";
import BackButton from "@/components/ui/back-button";

export default function TermsOfServicePage() {
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
              Terms of Service
            </h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest">
              Last Updated: May 26, 2026
            </p>
          </div>

          <div className="space-y-8 text-sm leading-relaxed text-gray-400">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the FinFlow web application, API gateway, machine learning tools, or database services 
                (collectively, the &quot;Service&quot;), you agree to comply with and be bound by these Terms of Service. If you do 
                not agree with any part of these terms, you are prohibited from using the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">2. Subscription Plans and Billing</h2>
              <p>
                FinFlow offers both Free and Pro subscription plans. Pro plans are billed on a recurring monthly subscription basis via our third-party billing processor, Lemon Squeezy.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Pro Subscription:</strong> Unlocks cash flow forecasting, bulk transaction updates, and unlimited uploads.</li>
                <li><strong>Billing Cycle:</strong> Charges occur monthly from the initial date of upgrade. All payments are non-refundable.</li>
                <li><strong>Cancellations:</strong> You can manage or cancel your subscription at any time through the customer portal located under Settings.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">3. CSV Data & Financial Uploads</h2>
              <p>
                FinFlow provides automated spending categorization and Holt-Winters cash flow forecasting. You represent and warrant 
                that you hold the legal authority to upload all banking and transaction CSV ledgers submitted to our Service.
              </p>
              <p>
                Our machine learning vectors process transaction descriptions (e.g. vendor names, bills, invoice descriptions) to 
                automate bookkeeping tags. We do not store credit card credentials, raw bank logins, or direct payment details.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">4. Prohibited Uses</h2>
              <p>
                You agree not to upload corrupted spreadsheet scripts, attempt database injections, stress test the API gateway endpoints, 
                or bypass premium subscription gates. Bypassing plan gates will result in immediate termination of your user account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">5. Disclaimer of Warranties</h2>
              <p>
                FinFlow is an AI analytics operating system meant to support cash flow planning. It is NOT a professional accounting 
                or licensed financial advisory platform. All forecasts are statistical models and are provided on an &quot;AS IS&quot; 
                and &quot;AS AVAILABLE&quot; basis without warranties of financial profit, accuracy, or market outcomes.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">6. Limitation of Liability</h2>
              <p>
                In no event shall FinFlow, its developers, or its stakeholders be held liable for any indirect, consequential, 
                punitive, or incidental damages (including loss of business profits or transactional ledger inaccuracies) arising 
                from your use or inability to use the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">7. Modifications to the Agreement</h2>
              <p>
                We reserve the right to revise these Terms of Service at any time. Continued use of the platform after updates 
                constitutes complete acceptance of the revised Terms.
              </p>
            </section>
          </div>

          <div className="border-t border-[#1D1E22]/80 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-gray-500">
              Questions? Contact us at legal@finflow.dev
            </span>
            <Link 
              href="/privacy" 
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
            >
              Read our Privacy Policy &rarr;
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
