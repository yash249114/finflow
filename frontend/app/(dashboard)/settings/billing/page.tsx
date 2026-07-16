"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Sparkles, Lock, CreditCard, HelpCircle, ArrowRight, Star, Send } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth-context";
import { getAuthHeaders } from "@/lib/supabase";
import { detectUserCurrency, CURRENCIES, formatPrice, type CurrencyCode } from "@/lib/currency";
import { CursorGlow } from "@/components/ui/cursor-glow";
import { fadeSlideUp, staggerContainer, scaleIn } from "@/lib/motion";

export default function BillingPage() {
  const searchParams = useSearchParams();
  const { user, refetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Currency detection
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>("USD");
  
  // Max request modal state
  const [isMaxModalOpen, setIsMaxModalOpen] = useState(false);
  const [maxRequestMessage, setMaxRequestMessage] = useState("");
  const [submittingMaxRequest, setSubmittingMaxRequest] = useState(false);

  // Accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

  useEffect(() => {
    // Detect currency
    const detected = detectUserCurrency();
    setCurrencyCode(detected);

    const fetchUser = async () => {
      setLoading(true);
      try {
        await refetch();
      } catch {
        toast.error("Failed to load user billing state");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Check if ?upgraded=true is in the URL
    if (searchParams.get("upgraded") === "true") {
      setShowConfetti(true);
      toast.success("Congratulations! You are now subscribed to FinFlow Pro.");
      // Stop confetti animation after 6 seconds
      setTimeout(() => setShowConfetti(false), 6000);
    }
  }, [searchParams, refetch]);

  // Trigger Lemon Squeezy Checkout
  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/billing/create-checkout`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        } else {
          toast.error("Checkout link generation failed.");
        }
      } else {
        toast.error("Failed to start checkout. Please try again.");
      }
    } catch {
      toast.error("Connection error while creating checkout portal.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Trigger Lemon Squeezy Customer Portal
  const handleManagePortal = async () => {
    setPortalLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/billing/portal`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.portal_url) {
          window.location.href = data.portal_url;
        } else {
          toast.error("Portal link generation failed.");
        }
      } else {
        toast.error("Failed to load billing portal. Please try again.");
      }
    } catch {
      toast.error("Connection error while loading subscription portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleMaxRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maxRequestMessage.trim()) {
      toast.error("Please enter a short description of your organization/needs");
      return;
    }
    setSubmittingMaxRequest(true);
    // Simulate API request
    setTimeout(() => {
      setSubmittingMaxRequest(false);
      setIsMaxModalOpen(false);
      setMaxRequestMessage("");
      toast.success("Your inquiry for FinFlow MAX has been sent! Our team will contact you shortly.");
    }, 1500);
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const faqs = [
    {
      q: "Can I cancel anytime?",
      a: "Yes, you can cancel directly from your customer billing portal at any time. No questions asked, and your access will remain active until the end of the billing period.",
    },
    {
      q: "What happens to my data if I downgrade?",
      a: "Your uploaded transactions remain intact in the database. However, cash flow forecasting and 90-day horizon charts will be restricted until you re-upgrade to a Pro plan.",
    },
    {
      q: "Is my payment information secure?",
      a: "Absolutely. All payment processing, merchant details, and billing security are handled entirely by Lemon Squeezy (an industry standard Merchant of Record). FinFlow never stores your card information.",
    },
    {
      q: "How does Regional Pricing work?",
      a: "FinFlow automatically adjusts its Pro plan rate based on your geography to keep our AI tools accessible worldwide. We support USD, INR, EUR, and GBP.",
    },
  ];

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const currencyConfig = CURRENCIES[currencyCode];
  const userPlan = user?.plan || "free";

  return (
    <div className="space-y-12 max-w-6xl mx-auto relative select-none">
      {/* Confetti container (15 falling divs) */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden h-[100vh]">
          {[...Array(15)].map((_, i) => {
            const left = `${Math.random() * 100}%`;
            const delay = `${Math.random() * 2}s`;
            const color = [
              "bg-red-500",
              "bg-blue-500",
              "bg-yellow-500",
              "bg-green-500",
              "bg-pink-500",
              "bg-purple-500",
            ][Math.floor(Math.random() * 6)];

            return (
              <div
                key={i}
                className={`absolute w-3 w-3 ${color} rounded-sm animate-confetti`}
                style={{
                  left,
                  animationDelay: delay,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center">
            Billing & Subscriptions
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Choose a plan that fits your growth or manage your current subscription
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <span className="text-xs text-gray-400">Regional Currency:</span>
          <select
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value as CurrencyCode)}
            className="bg-zinc-900/80 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {Object.values(CURRENCIES).map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
            userPlan === "pro" 
              ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400" 
              : userPlan === "max"
              ? "bg-violet-500/10 border border-violet-500/30 text-violet-400"
              : "bg-zinc-800 border border-zinc-700 text-gray-400"
          }`}>
            Current: {userPlan} Plan
          </span>
        </div>
      </div>

      {/* Plans Pricing Section */}
      <motion.div 
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch"
      >
        {/* FREE PLAN */}
        <motion.div variants={fadeSlideUp}>
          <CursorGlow className="h-full">
            <div className={`h-full glass-card border border-white/5 rounded-2xl p-8 flex flex-col justify-between shadow-xl relative overflow-hidden transition-[background-color,border-color,box-shadow,color,opacity] duration-300 ${userPlan === "free" ? 'ring-2 ring-indigo-500/30 border-indigo-500/20' : ''}`}>
              {userPlan === "free" && (
                <div className="absolute top-4 right-4 rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-gray-300 border border-white/10">
                  Current Plan
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Free Plan</h3>
                  <p className="text-xs text-gray-400 mt-1">For side projects and testing</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-gray-400 ml-1 text-sm">/ month</span>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <ul className="space-y-3.5 text-xs text-gray-300">
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Up to 250 transactions</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>CSV import upload dropzone</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>ML transaction categorization</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Lightweight local AI analysis</span>
                    </li>
                    <li className="flex items-start space-x-2.5 text-gray-500">
                      <X className="h-4 w-4 text-gray-600 shrink-0 mt-0.5" />
                      <span className="line-through">Advanced forecasting & runway projections</span>
                    </li>
                    <li className="flex items-start space-x-2.5 text-gray-500">
                      <X className="h-4 w-4 text-gray-600 shrink-0 mt-0.5" />
                      <span className="line-through">AI Copilot chat interface</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-8">
                <button
                  disabled
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-gray-400 py-3 text-xs font-semibold cursor-not-allowed select-none transition-colors"
                >
                  {userPlan === "free" ? "Active" : "Downgrade Unavailable"}
                </button>
              </div>
            </div>
          </CursorGlow>
        </motion.div>

        {/* PRO PLAN */}
        <motion.div variants={fadeSlideUp}>
          <CursorGlow className="h-full">
            <div className={`h-full glass-card border rounded-2xl p-8 flex flex-col justify-between shadow-xl relative overflow-hidden transition-[background-color,border-color,box-shadow,color,opacity] duration-300 ${
              userPlan === "pro" 
                ? 'ring-2 ring-indigo-500 border-indigo-500/50' 
                : 'border-indigo-500/20 hover:border-indigo-500/40'
            }`}>
              <div className="absolute top-4 right-4 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                <Star className="w-3 h-3 fill-indigo-400/20" /> Most Popular
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-1.5">
                    Pro Plan <Sparkles className="w-4 h-4 text-indigo-400" />
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Runway modeling & smart anomalies</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">
                    {formatPrice(currencyConfig.plans.pro, currencyConfig)}
                  </span>
                  <span className="text-gray-400 ml-1 text-sm">/ month</span>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <ul className="space-y-3.5 text-xs text-gray-300">
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span className="font-semibold text-white">Unlimited transactions</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>Advanced forecasting (30/60/90 days)</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>AI Copilot & scenario models</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>Predictive burn-rate alert notifications</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>Automated recurring anomaly scans</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                {userPlan === "pro" ? (
                  <button
                    onClick={handleManagePortal}
                    disabled={portalLoading}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 text-xs transition-[background-color,border-color,box-shadow,color,opacity] shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2"
                  >
                    {portalLoading ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Connecting to Portal...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 shrink-0" />
                        <span>Manage Subscription</span>
                      </>
                    )}
                  </button>
                ) : userPlan === "max" ? (
                  <button
                    disabled
                    className="w-full rounded-xl bg-white/5 border border-white/10 text-gray-500 py-3 text-xs font-semibold cursor-not-allowed select-none"
                  >
                    Current Tier Higher
                  </button>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={checkoutLoading}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 text-xs transition-[background-color,border-color,box-shadow,color,opacity] shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {checkoutLoading ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Opening Checkout...</span>
                      </>
                    ) : (
                      <span>Upgrade to Pro</span>
                    )}
                  </button>
                )}
                <div className="flex items-center justify-center space-x-1.5 text-[10px] text-gray-500">
                  <Lock className="h-3 w-3 shrink-0" />
                  <span>Secure processing via Lemon Squeezy</span>
                </div>
              </div>
            </div>
          </CursorGlow>
        </motion.div>

        {/* MAX PLAN */}
        <motion.div variants={fadeSlideUp}>
          <CursorGlow className="h-full">
            <div className={`h-full glass-card-elevated border rounded-2xl p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-[background-color,border-color,box-shadow,color,opacity] duration-300 ${
              userPlan === "max" 
                ? 'ring-2 ring-violet-500 border-violet-500/50' 
                : 'border-violet-500/20 hover:border-violet-500/40'
            }`}>
              <div className="absolute top-0 right-0 h-[100px] w-[100px] bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-1.5">
                    FinFlow Max <span className="rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">Enterprise</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Multi-agent models & custom integration</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                    Custom
                  </span>
                  <span className="text-gray-400 ml-1 text-sm">/ year</span>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <ul className="space-y-3.5 text-xs text-gray-300">
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                      <span>Dedicated Gemini 1.5 Pro AI CFO context</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                      <span>Multi-agent automated cash-flow execution</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                      <span>Tailored database & accounting software integrations</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                      <span>Custom LLM fine-tuning on company data</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                      <span className="font-semibold text-white">SLA-backed 1-on-1 human expert advisory</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8">
                {userPlan === "max" ? (
                  <button
                    disabled
                    className="w-full rounded-xl bg-violet-950/40 border border-violet-850 text-violet-400 py-3 text-xs font-semibold cursor-not-allowed select-none"
                  >
                    Active Plan
                  </button>
                ) : (
                  <button
                    onClick={() => setIsMaxModalOpen(true)}
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3 text-xs transition-[background-color,border-color,box-shadow,color,opacity] shadow-lg shadow-violet-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Request FinFlow MAX</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </CursorGlow>
        </motion.div>
      </motion.div>

      {/* Billing History / Invoice List */}
      <div className="glass-panel border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div>
            <h3 className="text-base font-bold text-white">Billing History & Invoices</h3>
            <p className="text-xs text-gray-400 mt-0.5">Review and download PDF receipts for your past subscription cycles.</p>
          </div>
          <CreditCard className="w-5 h-5 text-indigo-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 font-semibold">
                <th className="py-3 px-4">Invoice ID</th>
                <th className="py-3 px-4">Billing Date</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {[
                { id: "INV-2026-003", date: "May 27, 2026", amount: "$29.00", status: "Paid" },
                { id: "INV-2026-002", date: "Apr 27, 2026", amount: "$29.00", status: "Paid" },
                { id: "INV-2026-001", date: "Mar 27, 2026", amount: "$29.00", status: "Paid" },
              ].map((inv) => (
                <tr key={inv.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-white">{inv.id}</td>
                  <td className="py-3 px-4 text-gray-400">{inv.date}</td>
                  <td className="py-3 px-4 text-white font-semibold">{inv.amount}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                      ● {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => toast.success(`Initiated download for receipt ${inv.id}`)}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQs Accordion */}
      <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-8 shadow-md">
        <div className="flex items-center space-x-2.5 mb-6">
          <HelpCircle className="h-5 w-5 text-indigo-400 shrink-0" />
          <h3 className="text-base font-bold text-white">Frequently Asked Questions</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div 
                key={index} 
                className="border border-white/5 rounded-lg overflow-hidden bg-zinc-950/20 hover:border-white/10 transition-colors"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-5 py-4 text-xs font-semibold text-left text-gray-200 hover:text-white flex justify-between items-center focus:outline-none"
                >
                  <span>{faq.q}</span>
                  <span className={`text-indigo-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-5 pb-4 text-xs leading-relaxed text-gray-400 border-t border-white/5 pt-3">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAX REQUEST DIALOG MODAL */}
      <AnimatePresence>
        {isMaxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMaxModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Modal Body */}
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="glass-card-elevated border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl z-10 relative p-8"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    Request FinFlow Max
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Please tell us about your team and custom workflow needs.
                  </p>
                </div>
                <button
                  onClick={() => setIsMaxModalOpen(false)}
                  className="text-gray-400 hover:text-white text-sm bg-white/5 hover:bg-white/10 rounded-lg p-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleMaxRequestSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Describe your requirements
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={maxRequestMessage}
                    onChange={(e) => setMaxRequestMessage(e.target.value)}
                    placeholder="E.g. We require customized connections to Netsuite, have a team of 15 members, and need automated scenario modeling tools."
                    className="w-full input-premium rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none placeholder-gray-500"
                  />
                </div>
                <div className="flex items-center space-x-2 text-[10px] text-gray-400 bg-white/5 border border-white/5 p-3 rounded-lg">
                  <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                  <span>An account coordinator will reach out to <strong>{user?.email}</strong> within 1 business day.</span>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsMaxModalOpen(false)}
                    className="rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 text-xs font-semibold px-4 py-2.5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingMaxRequest}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-500/20"
                  >
                    {submittingMaxRequest ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Inquiry</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
