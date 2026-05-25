"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Terminal, Send } from "lucide-react";
import { motion } from "framer-motion";

export default function MaxRequestForm() {
  const [nameVal, setNameVal] = useState("");
  const [emailVal, setEmailVal] = useState("");
  const [companyVal, setCompanyVal] = useState("");
  const [revenueVal, setRevenueVal] = useState("");
  const [teamSizeVal, setTeamSizeVal] = useState("");
  const [reasonVal, setReasonVal] = useState("");
  const [formState, setFormState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errInfo, setErrInfo] = useState("");

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailVal || !nameVal || !companyVal || !revenueVal || !teamSizeVal || !reasonVal) {
      toast.error("Please fill in all fields.");
      return;
    }

    setFormState("loading");
    setErrInfo("");

    try {
      const apiKey = process.env.NEXT_PUBLIC_WEB3FORMS_KEY || "";
      
      const payload = {
        access_key: apiKey,
        name: nameVal,
        email: emailVal,
        company: companyVal,
        revenue: revenueVal,
        team_size: teamSizeVal,
        reason: reasonVal,
        subject: "FinFlow - New MAX Access Request",
        message: `New enterprise MAX request from landing page.\nCompany: ${companyVal}\nRevenue: ${revenueVal}\nTeam Size: ${teamSizeVal}\nWhy MAX: ${reasonVal}`
      };

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        setFormState("success");
        setNameVal("");
        setEmailVal("");
        setCompanyVal("");
        setRevenueVal("");
        setTeamSizeVal("");
        setReasonVal("");
        toast.success("MAX request submitted successfully!");
      } else {
        setFormState("error");
        setErrInfo(resData.message || "Something went wrong. Try again.");
        toast.error("Submission failed. Please check inputs and retry.");
      }
    } catch {
      setFormState("error");
      setErrInfo("Connection failed. Try again later.");
      toast.error("Connection error. Try again.");
    }
  };

  return (
    <div className="w-full max-w-xl bg-[#0F1012]/40 border border-indigo-500/20 rounded-2xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl shadow-indigo-500/5 select-none">
      {/* Animated glowing border lines */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

      <div className="flex items-center gap-2 mb-6">
        <Terminal className="h-5 w-5 text-indigo-400" />
        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider font-mono">
          System://SecureMAXChannel
        </span>
      </div>

      <div className="mb-8 space-y-2">
        <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
          Request MAX Access
          <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Submit details to clear validation reviews and secure custom enterprise intelligence sandboxes.
        </p>
      </div>

      {formState === "success" ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center text-emerald-400 font-medium space-y-3"
        >
          <div className="h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 font-black text-lg">
            ✓
          </div>
          <h4 className="font-bold text-white text-sm">Request Submitted</h4>
          <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
            Our founding CFO support leads will verify your application and setup isolated sandbox accesses within 24 hours.
          </p>
        </motion.div>
      ) : (
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="max-name" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 font-mono">
                Full Name
              </label>
              <Input
                id="max-name"
                type="text"
                placeholder="Alex Johnson"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                required
                className="input-premium h-10 w-full rounded-xl text-xs placeholder-gray-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="max-email" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 font-mono">
                Email Address
              </label>
              <Input
                id="max-email"
                type="email"
                placeholder="alex@company.com"
                value={emailVal}
                onChange={(e) => setEmailVal(e.target.value)}
                required
                className="input-premium h-10 w-full rounded-xl text-xs placeholder-gray-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label htmlFor="max-company" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 font-mono">
                Company Name
              </label>
              <Input
                id="max-company"
                type="text"
                placeholder="Acme Corp"
                value={companyVal}
                onChange={(e) => setCompanyVal(e.target.value)}
                required
                className="input-premium h-10 w-full rounded-xl text-xs placeholder-gray-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="max-revenue" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 font-mono">
                Monthly Revenue
              </label>
              <select
                id="max-revenue"
                value={revenueVal}
                onChange={(e) => setRevenueVal(e.target.value)}
                required
                className="input-premium h-10 w-full rounded-xl text-xs px-2.5 outline-none appearance-none"
              >
                <option value="" disabled className="text-gray-600 bg-[#08090A]">Select Revenue</option>
                <option value="Under $50k" className="bg-[#08090A]">Under $50k / mo</option>
                <option value="$50k - $200k" className="bg-[#08090A]">$50k - $200k / mo</option>
                <option value="$200k - $1M" className="bg-[#08090A]">$200k - $1M / mo</option>
                <option value="Over $1M" className="bg-[#08090A]">Over $1M / mo</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="max-team" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 font-mono">
                Team Size
              </label>
              <select
                id="max-team"
                value={teamSizeVal}
                onChange={(e) => setTeamSizeVal(e.target.value)}
                required
                className="input-premium h-10 w-full rounded-xl text-xs px-2.5 outline-none appearance-none"
              >
                <option value="" disabled className="text-gray-600 bg-[#08090A]">Select Size</option>
                <option value="1-10 members" className="bg-[#08090A]">1 - 10 members</option>
                <option value="11-50 members" className="bg-[#08090A]">11 - 50 members</option>
                <option value="51-200 members" className="bg-[#08090A]">51 - 200 members</option>
                <option value="Over 200" className="bg-[#08090A]">200+ members</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="max-reason" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 font-mono">
              Why do you want MAX?
            </label>
            <textarea
              id="max-reason"
              rows={3}
              placeholder="Detail your modeling criteria or forecasting timeline requirements..."
              value={reasonVal}
              onChange={(e) => setReasonVal(e.target.value)}
              required
              className="input-premium w-full rounded-xl text-xs p-3 outline-none transition-all"
            />
          </div>

          {formState === "error" && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
              {errInfo}
            </div>
          )}

          <Button
            type="submit"
            disabled={formState === "loading"}
            className="w-full btn-premium h-11 rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 border border-indigo-500/30 text-white"
          >
            {formState === "loading" ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Validating Request...
              </span>
            ) : (
              <>
                <span>Submit Authorization Request</span>
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
