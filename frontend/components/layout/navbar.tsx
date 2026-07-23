"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/ui/logo";
import { detectUserCurrency } from "@/lib/currency";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Silently detect initial currency preference on mount
    const initialCurrency = detectUserCurrency();
    
    // Dispatch to pricing components
    window.dispatchEvent(new CustomEvent("currencyChange", { detail: initialCurrency }));

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-[#1D1E22]/80 bg-[#08090A]/75 backdrop-blur-xl py-3 shadow-lg shadow-black/40"
          : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 group">
              <motion.div
                whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.4 }}
              >
                <Logo size={28} glow />
              </motion.div>
              <span className="text-xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-white to-gray-400 group-hover:to-white transition-[background-color,border-color,box-shadow,color,opacity] duration-300">
                FinFlow
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/features"
              className="text-sm text-gray-400 hover:text-white transition-colors relative py-1"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-400 hover:text-white transition-colors relative py-1"
            >
              Pricing
            </Link>
            <Link
              href="/max"
              className="text-sm text-gray-400 hover:text-white transition-colors relative py-1"
            >
              FinFlow MAX
            </Link>
            <Link
              href="/about"
              className="text-sm text-gray-400 hover:text-white transition-colors relative py-1"
            >
              About
            </Link>
          </nav>

          {/* Right Action buttons */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-400 hover:text-white transition-colors py-1.5"
            >
              Login
            </Link>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/register"
                className="btn-premium px-5 py-2.5 text-xs font-semibold rounded-xl text-white transition-[background-color,border-color,box-shadow,color,opacity] text-center inline-block"
              >
                Get Started
              </Link>
            </motion.div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center md:hidden">
            <button
              onClick={toggleMenu}
              className="text-gray-400 hover:text-white focus:outline-none p-1"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="border-b border-[#1D1E22] bg-[#08090A]/95 backdrop-blur-xl md:hidden overflow-hidden shadow-2xl"
          >
            <div className="flex flex-col space-y-3 px-6 py-6 text-center">
              <Link
                href="/features"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-sm py-2 border-b border-gray-900"
              >
                Features
              </Link>
              <Link
                href="/pricing"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-sm py-2 border-b border-gray-900"
              >
                Pricing
              </Link>
              <Link
                href="/max"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-sm py-2 border-b border-gray-900"
              >
                FinFlow MAX
              </Link>
              <Link
                href="/about"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-sm py-2 border-b border-gray-900"
              >
                About
              </Link>
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-sm py-2"
              >
                Login
              </Link>
              <Link
                href="/register"
                onClick={() => setIsOpen(false)}
                className="btn-premium py-3 text-sm font-semibold rounded-xl text-white transition-[background-color,border-color,box-shadow,color,opacity] text-center"
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
