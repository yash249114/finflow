"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, Building2, Globe, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";

export default function ProfilePage() {
  const { user, refetch } = useAuth();
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [companyName, setCompanyName] = useState(user?.company_name || "");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [timezone, setTimezone] = useState(
    typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          company_name: companyName,
          company_website: companyWebsite,
          industry,
          company_size: companySize,
          timezone,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Profile updated successfully");
        await refetch();
      }
    } catch (err) {
      console.error("[Profile] Save error:", err);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-7 max-w-2xl"
    >
      {/* Header */}
      <motion.div variants={fadeSlideUp} className="flex items-center space-x-3">
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/[0.04] transition-colors text-text-muted hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Profile & Company</h1>
          <p className="text-sm text-text-muted mt-0.5">Manage your personal and business information</p>
        </div>
      </motion.div>

      {/* Avatar Section */}
      <motion.div variants={fadeSlideUp} className="glass-card rounded-2xl p-6">
        <div className="flex items-center space-x-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neural-blue to-neural-violet text-xl font-bold text-white uppercase shrink-0">
            {getInitials(fullName || "U")}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{fullName || "User"}</h3>
            <p className="text-xs text-text-muted">{user?.email}</p>
            <div className="flex items-center space-x-2 mt-1.5">
              <span className="rounded-full bg-neural-blue/10 border border-neural-blue/20 px-2 py-0.5 text-[9px] font-bold text-neural-blue uppercase tracking-wider">
                {user?.plan || "free"} plan
              </span>
              {user?.role === "admin" && (
                <span className="rounded-full bg-neural-violet/10 border border-neural-violet/20 px-2 py-0.5 text-[9px] font-bold text-neural-violet uppercase tracking-wider">
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Personal Info */}
      <motion.div variants={fadeSlideUp} className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center space-x-2 mb-1">
          <User className="h-4 w-4 text-neural-blue" />
          <h3 className="text-sm font-bold text-white">Personal Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full input-premium rounded-xl px-3.5 py-2.5 text-sm"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full input-premium rounded-xl px-3.5 py-2.5 text-sm opacity-60 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Timezone
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full input-premium rounded-xl px-3.5 py-2.5 text-sm"
              placeholder="e.g. America/New_York"
            />
          </div>
        </div>
      </motion.div>

      {/* Company Info */}
      <motion.div variants={fadeSlideUp} className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center space-x-2 mb-1">
          <Building2 className="h-4 w-4 text-neural-violet" />
          <h3 className="text-sm font-bold text-white">Company Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full input-premium rounded-xl px-3.5 py-2.5 text-sm"
              placeholder="Your company"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Company Website
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-dim" />
              <input
                type="url"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                className="w-full input-premium rounded-xl pl-9 pr-3.5 py-2.5 text-sm"
                placeholder="https://example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Industry
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full input-premium rounded-xl px-3.5 py-2.5 text-sm"
            >
              <option value="">Select industry</option>
              <option value="saas">SaaS / Software</option>
              <option value="fintech">Fintech</option>
              <option value="ecommerce">E-Commerce</option>
              <option value="healthcare">Healthcare</option>
              <option value="education">Education</option>
              <option value="consulting">Consulting</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Company Size
            </label>
            <select
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              className="w-full input-premium rounded-xl px-3.5 py-2.5 text-sm"
            >
              <option value="">Select size</option>
              <option value="1-10">1–10 employees</option>
              <option value="11-50">11–50 employees</option>
              <option value="51-200">51–200 employees</option>
              <option value="201-1000">201–1,000 employees</option>
              <option value="1000+">1,000+ employees</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Save Button */}
      <motion.div variants={fadeSlideUp} className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 rounded-xl bg-neural-blue hover:bg-neural-blue/90 text-white px-5 py-2.5 text-sm font-semibold transition-all shadow-lg shadow-neural-blue/20 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? "Saving..." : "Save Changes"}</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
