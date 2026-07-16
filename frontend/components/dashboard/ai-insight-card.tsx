'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Brain, AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react'

interface AIInsightCardProps {
  title: string
  description: string
  type: 'insight' | 'anomaly' | 'prediction' | 'suggestion'
  confidence?: number
  delay?: number
}

const typeConfig = {
  insight: {
    icon: Brain,
    accentColor: 'text-neural-blue',
    bgColor: 'bg-neural-blue/5',
    borderColor: 'border-neural-blue/15',
    glowColor: 'rgba(99, 102, 241, 0.08)',
  },
  anomaly: {
    icon: AlertTriangle,
    accentColor: 'text-amber-400',
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/15',
    glowColor: 'rgba(245, 158, 11, 0.08)',
  },
  prediction: {
    icon: TrendingUp,
    accentColor: 'text-neural-violet',
    bgColor: 'bg-neural-violet/5',
    borderColor: 'border-neural-violet/15',
    glowColor: 'rgba(139, 92, 246, 0.08)',
  },
  suggestion: {
    icon: Lightbulb,
    accentColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/5',
    borderColor: 'border-emerald-500/15',
    glowColor: 'rgba(16, 185, 129, 0.08)',
  },
}

export default function AIInsightCard({
  title,
  description,
  type,
  confidence = 85,
  delay = 0,
}: AIInsightCardProps) {
  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`glass-card rounded-2xl p-4 ${config.borderColor} border hover:border-opacity-30 transition-[background-color,border-color,box-shadow,color,opacity] duration-300 group cursor-default`}
      style={{ boxShadow: `0 0 40px ${config.glowColor}` }}
    >
      <div className="flex items-start space-x-3">
        {/* Icon with pulse */}
        <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.bgColor}`}>
          <Icon className={`h-4 w-4 ${config.accentColor}`} />
          <motion.div
            className={`absolute inset-0 rounded-xl ${config.bgColor}`}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: delay,
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-white mb-0.5">{title}</h4>
          <p className="text-[11px] leading-relaxed text-text-muted">
            {description}
          </p>

          {/* Confidence bar */}
          <div className="mt-2.5 flex items-center space-x-2">
            <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                className={`h-full rounded-full`}
                style={{
                  background: `linear-gradient(90deg, ${config.glowColor.replace('0.08', '0.6')}, ${config.glowColor.replace('0.08', '0.3')})`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${confidence}%` }}
                transition={{ delay: delay + 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className={`text-[9px] font-bold ${config.accentColor} uppercase tracking-wider`}>
              {confidence}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
