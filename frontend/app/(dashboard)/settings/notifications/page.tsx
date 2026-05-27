"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mail, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";

interface NotificationToggle {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationToggle[]>([
    { id: "anomalies", label: "Anomaly Alerts", description: "Get notified when unusual spending patterns are detected", enabled: true },
    { id: "forecast", label: "Forecast Updates", description: "Weekly forecast summary and prediction alerts", enabled: true },
    { id: "billing", label: "Billing Reminders", description: "Subscription renewal and payment notifications", enabled: true },
    { id: "product", label: "Product Updates", description: "New features, improvements, and changelog", enabled: false },
    { id: "tips", label: "Financial Tips", description: "AI-generated tips for improving cash flow", enabled: false },
  ]);

  const toggleNotification = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n)
    );
    toast.success("Preference updated");
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Notifications</h1>
          <p className="text-sm text-text-muted mt-0.5">Configure email and alert preferences</p>
        </div>
      </motion.div>

      {/* Email Notifications */}
      <motion.div variants={fadeSlideUp} className="glass-card rounded-2xl p-6 space-y-1">
        <div className="flex items-center space-x-2 mb-4">
          <Mail className="h-4 w-4 text-neural-blue" />
          <h3 className="text-sm font-bold text-white">Email Notifications</h3>
        </div>

        <div className="space-y-0.5">
          {notifications.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-3.5 border-b border-white/[0.03] last:border-0"
            >
              <div className="min-w-0 pr-4">
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{item.description}</p>
              </div>
              <button
                onClick={() => toggleNotification(item.id)}
                className={`relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200 ${
                  item.enabled ? "bg-neural-blue" : "bg-white/[0.08]"
                }`}
                aria-label={`Toggle ${item.label}`}
              >
                <motion.div
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                  animate={{
                    left: item.enabled ? "calc(100% - 22px)" : "2px",
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Alert Thresholds */}
      <motion.div variants={fadeSlideUp} className="glass-card rounded-2xl p-6">
        <div className="flex items-center space-x-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Alert Thresholds</h3>
        </div>
        <p className="text-xs text-text-muted leading-relaxed max-w-md">
          Customize spending alert thresholds and anomaly sensitivity.
          Advanced alert configuration will be available in a future update.
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
