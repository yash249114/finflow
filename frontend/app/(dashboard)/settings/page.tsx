"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { User, CreditCard, Shield, BellRing, ChevronRight } from "lucide-react";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";

const settingsCards = [
  {
    title: "Profile & Company",
    description: "Manage your personal and company information",
    href: "/settings/profile",
    icon: User,
    accent: "text-neural-blue",
    accentBg: "bg-neural-blue/10",
  },
  {
    title: "Billing & Plans",
    description: "Manage subscription, view invoices, and upgrade",
    href: "/settings/billing",
    icon: CreditCard,
    accent: "text-emerald-400",
    accentBg: "bg-emerald-500/10",
  },
  {
    title: "Security",
    description: "Password, sessions, and two-factor authentication",
    href: "/settings/security",
    icon: Shield,
    accent: "text-amber-400",
    accentBg: "bg-amber-500/10",
  },
  {
    title: "Notifications",
    description: "Email preferences and alert settings",
    href: "/settings/notifications",
    icon: BellRing,
    accent: "text-neural-violet",
    accentBg: "bg-neural-violet/10",
  },
];

export default function SettingsPage() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-7 max-w-3xl"
    >
      <motion.div variants={fadeSlideUp}>
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-sm text-text-muted mt-1">
          Manage your account, company, and preferences
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.title} variants={fadeSlideUp} transition={{ delay: i * 0.08 }}>
              <Link
                href={card.href}
                className="glass-card rounded-2xl p-5 flex items-start space-x-4 group hover:border-white/[0.08] transition-[background-color,border-color,box-shadow,color,opacity] duration-300 cursor-glow-area block"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.accentBg} shrink-0`}>
                  <Icon className={`h-5 w-5 ${card.accent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white group-hover:text-neural-blue transition-colors">
                      {card.title}
                    </h3>
                    <ChevronRight className="h-4 w-4 text-text-dim group-hover:text-text-muted transition-colors shrink-0" />
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
