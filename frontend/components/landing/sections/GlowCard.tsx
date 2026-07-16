"use client";

import { motion } from "framer-motion";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlowCard({ children, className = "" }: GlowCardProps) {
  return (
    <motion.div
      className={`relative glass-card rounded-2xl overflow-hidden ${className}`}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}