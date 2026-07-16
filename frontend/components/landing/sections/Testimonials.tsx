"use client";

import { motion } from "framer-motion";
import { TESTIMONIALS } from "@/lib/constants";

export function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-slate-900/30">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Trusted by teams who move fast
          </h2>
          <p className="text-lg text-slate-400">
            Companies building the next generation of financial products rely on
            FinFlow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((testimonial, i) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <blockquote className="rounded-2xl bg-slate-900/50 border border-slate-800 p-8 h-full flex flex-col">
                <p className="text-white leading-relaxed mb-6 flex-1 text-[15px]">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <footer className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-indigo-400">
                    {testimonial.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {testimonial.author}
                    </div>
                    <div className="text-xs text-slate-500">
                      {testimonial.role}, {testimonial.company}
                    </div>
                  </div>
                </footer>
              </blockquote>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}