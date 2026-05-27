"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, X, Sparkles, Lock, CreditCard, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth-context";
import { getAuthHeaders } from "@/lib/supabase";

export default function BillingPage() {
  const searchParams = useSearchParams();
  const { user, refetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

  useEffect(() => {
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
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const plan = user?.plan || "free";

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto relative select-none">
      {/* Confetti container (10 falling divs) */}
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
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Billing & Plans</h1>
          <p className="text-sm text-text-muted mt-1">
            Manage your subscription tier and payment checkouts
          </p>
        </div>
        {plan === "pro" ? (
          <span className="rounded-full bg-success/15 border border-success/30 px-3 py-1 text-xs font-semibold text-success flex items-center space-x-1 uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Pro Plan
          </span>
        ) : (
          <span className="rounded-full bg-gray-800 border border-gray-700 px-3 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
            Free Plan
          </span>
        )}
      </div>

      {/* RENDER BILLING DETAIL */}
      {plan === "free" ? (
        <div className="space-y-12">
          {/* Plan Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Free Card */}
            <div className="bg-gray-900 border-2 border-blue-500/25 rounded-2xl p-8 flex flex-col justify-between shadow-lg">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Free Tier</h3>
                  <p className="text-xs text-text-muted mt-1">Current Active Plan</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-text-muted ml-1">/ month</span>
                </div>
                <ul className="space-y-3 text-xs">
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span>Up to 100 transactions</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span>AI transaction categorization</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span>Basic dashboard & filters</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span>CSV file upload dropzone</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-500">
                    <X className="h-4 w-4 text-gray-600 shrink-0" />
                    <span className="line-through">Cash flow forecasting</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-500">
                    <X className="h-4 w-4 text-gray-600 shrink-0" />
                    <span className="line-through">30/60/90 day horizons</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <button
                  disabled
                  className="w-full rounded-xl bg-gray-800 border border-gray-750 text-text-muted py-3 text-xs font-semibold cursor-not-allowed select-none"
                >
                  Active Plan
                </button>
              </div>
            </div>

            {/* Pro Card */}
            <div className="bg-gradient-to-b from-blue-500/5 to-transparent border-2 border-blue-500 rounded-2xl p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute top-4 right-4 rounded-full bg-blue-500/10 px-3 py-1 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                Most Popular
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Pro Plan</h3>
                  <p className="text-xs text-text-muted mt-1">Unlock advanced prediction algorithms</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">$19</span>
                  <span className="text-text-muted ml-1">/ month</span>
                </div>
                <ul className="space-y-3 text-xs">
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span>Unlimited transactions</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span>AI transaction categorization</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span>Full dashboard access</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span>CSV file upload dropzone</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span className="font-semibold text-white">Cash flow forecasting</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span className="font-semibold text-white">30/60/90 day horizons</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-xs transition-all shadow-md shadow-blue-500/25 flex items-center justify-center space-x-2"
                >
                  {checkoutLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Redirecting to checkout...</span>
                    </>
                  ) : (
                    "Upgrade to Pro"
                  )}
                </button>
                <div className="flex items-center justify-center space-x-1.5 text-[10px] text-text-muted">
                  <Lock className="h-3 w-3 shrink-0" />
                  <span>Secure payment processed by Lemon Squeezy</span>
                </div>
              </div>
            </div>
          </div>

          {/* FAQs Accordion */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md">
            <div className="flex items-center space-x-2 mb-6">
              <HelpCircle className="h-5 w-5 text-primary shrink-0" />
              <h3 className="text-base font-bold text-white">Frequently Asked Questions</h3>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div key={index} className="border border-gray-850 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full bg-gray-950/40 px-4 py-3 text-xs font-semibold text-left text-gray-200 hover:text-white flex justify-between items-center"
                    >
                      <span>{faq.q}</span>
                      <span>{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && (
                      <div className="bg-gray-900 p-4 text-xs leading-relaxed text-text-muted">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* PRO PLAN INTERFACE */
        <div className="space-y-8 animate-fade-in">
          <div className="bg-gradient-to-b from-success/5 to-transparent border border-success/30 rounded-2xl p-8 space-y-6 shadow-xl">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white flex items-center">
                You&apos;re on Pro 🎉
              </h3>
              <p className="text-xs text-text-muted">
                Premium subscription ($19 / month) is active and running.
              </p>
            </div>

            <div className="border-t border-gray-850/50 py-4 flex flex-wrap gap-x-8 gap-y-4 text-xs font-semibold">
              <div className="flex items-center space-x-2 text-gray-300">
                <Check className="h-4 w-4 text-success" />
                <span>Unlimited transaction logs</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <Check className="h-4 w-4 text-success" />
                <span>Full prediction dashboard & charts</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <Check className="h-4 w-4 text-success" />
                <span>Priority system support</span>
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-2">
              <button
                onClick={handleManagePortal}
                disabled={portalLoading}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 text-xs transition-all shadow-md flex items-center justify-center space-x-2"
              >
                {portalLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Loading portal...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-1.5" />
                    <span>Manage Subscription</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-2">
              * Change your card billing information or cancel your subscription plans using the customer portal link.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
