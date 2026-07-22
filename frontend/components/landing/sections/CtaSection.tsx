"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Ready to build with FinFlow?
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            Join thousands of developers building the future of financial
            infrastructure. Start free, scale infinitely.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="group w-full sm:w-auto">
                Start building
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                View dashboard
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}