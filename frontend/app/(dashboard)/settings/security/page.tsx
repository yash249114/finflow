"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Key, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      console.error("[Security] Password change error:", err);
      toast.error("Failed to update password");
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Security</h1>
          <p className="text-sm text-text-muted mt-0.5">Manage password and authentication settings</p>
        </div>
      </motion.div>

      {/* Password Change */}
      <motion.div variants={fadeSlideUp} className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center space-x-2 mb-1">
          <Lock className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Change Password</h3>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full input-premium rounded-xl px-3.5 py-2.5 text-sm"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full input-premium rounded-xl px-3.5 py-2.5 text-sm"
              placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full input-premium rounded-xl px-3.5 py-2.5 text-sm"
              placeholder="Retype new password"
            />
          </div>
          <button
            onClick={handlePasswordChange}
            disabled={saving || !newPassword || !confirmPassword}
            className="flex items-center space-x-2 rounded-xl bg-amber-500 hover:bg-amber-500/90 text-black px-5 py-2.5 text-sm font-semibold transition-[background-color,border-color,box-shadow,color,opacity] shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Key className="h-4 w-4" />
            <span>{saving ? "Updating..." : "Update Password"}</span>
          </button>
        </div>
      </motion.div>

      {/* Two-Factor Auth */}
      <motion.div variants={fadeSlideUp} className="glass-card rounded-2xl p-6">
        <div className="flex items-center space-x-2 mb-3">
          <Shield className="h-4 w-4 text-neural-blue" />
          <h3 className="text-sm font-bold text-white">Two-Factor Authentication</h3>
        </div>
        <p className="text-xs text-text-muted leading-relaxed max-w-md">
          Two-factor authentication adds an extra layer of security to your account. 
          This feature will be available in a future update.
        </p>
        <div className="mt-4">
          <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            Coming Soon
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
