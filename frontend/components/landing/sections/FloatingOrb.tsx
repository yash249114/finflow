"use client";

import { motion } from "framer-motion";

interface FloatingOrbProps {
  className?: string;
  delay?: number;
}

export function FloatingOrb({ className = "", delay = 0 }: FloatingOrbProps) {
  return (
    <motion.div
      className={`absolute rounded-full blur-[120px] ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: "transform, opacity" }}
    />
  );
}