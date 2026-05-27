"use client";

import React from "react";
import { motion } from "framer-motion";
import ChatInterface from "@/components/copilot/chat-interface";
import { Brain, Cpu, MessageSquare } from "lucide-react";
import { CursorGlow } from "@/components/ui/cursor-glow";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";

export default function CopilotPage() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeSlideUp} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            Ask FinFlow AI
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time contextual analysis of cash flow, runway projections, and anomalous spending velocity
          </p>
        </div>
      </motion.div>

      {/* Info Cards Grid */}
      <motion.div variants={fadeSlideUp} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CursorGlow>
          <div className="glass-card border border-white/5 rounded-2xl p-5 flex items-start gap-4">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20 shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Semantic Runway Tracking</h4>
              <p className="text-[11px] text-gray-450 mt-1 leading-relaxed">
                Queries such as &apos;how long is my runway?&apos; trigger auto-computations of current deposits over average historical burn velocity.
              </p>
            </div>
          </div>
        </CursorGlow>

        <CursorGlow>
          <div className="glass-card border border-white/5 rounded-2xl p-5 flex items-start gap-4">
            <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Transformer Classification</h4>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                Advanced category mappings occur automatically via neural embedding comparisons, grouping AWS, GitHub, or stripe charges accurately.
              </p>
            </div>
          </div>
        </CursorGlow>

        <CursorGlow>
          <div className="glass-card border border-white/5 rounded-2xl p-5 flex items-start gap-4">
            <div className="p-2.5 bg-fuchsia-500/10 rounded-xl text-fuchsia-400 border border-fuchsia-500/20 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">CFO Human Advisory</h4>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                Max Enterprise users have SLA-backed access to certified professional advisors for complex strategic models and validations.
              </p>
            </div>
          </div>
        </CursorGlow>
      </motion.div>

      {/* Main Chat Interface */}
      <motion.div variants={fadeSlideUp}>
        <ChatInterface />
      </motion.div>
    </motion.div>
  );
}
