"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

export default function BackButton({ href, label = "Back", className = "" }: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <motion.button
      onClick={handlePress}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-gray-800/80 bg-gray-900/40 backdrop-blur-md text-xs font-semibold text-gray-300 hover:text-white hover:border-gray-700 transition-colors shadow-lg shadow-black/10 group ${className}`}
    >
      <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
      <span>{label}</span>
    </motion.button>
  );
}
