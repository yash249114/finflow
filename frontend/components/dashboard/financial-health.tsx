'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface FinancialHealthProps {
  score: number // 0-100
  label: string
  delay?: number
}

function getHealthColor(score: number) {
  if (score >= 75) return { color: '#10B981', label: 'Healthy' }
  if (score >= 50) return { color: '#F59E0B', label: 'Caution' }
  return { color: '#EF4444', label: 'Critical' }
}

export default function FinancialHealth({ score, label, delay = 0 }: FinancialHealthProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const health = getHealthColor(score)

  useEffect(() => {
    const duration = 1500
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(Math.round(eased * score))
      if (progress < 1) requestAnimationFrame(animate)
    }
    const timer = setTimeout(() => requestAnimationFrame(animate), delay * 1000)
    return () => clearTimeout(timer)
  }, [score, delay])

  const radius = 44
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center"
    >
      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-4">
        {label}
      </p>

      {/* SVG Ring */}
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background ring */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="6"
          />
          {/* Progress ring */}
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={health.color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: `drop-shadow(0 0 8px ${health.color}40)`,
            }}
          />
        </svg>

        {/* Center score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{animatedScore}</span>
          <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">
            / 100
          </span>
        </div>
      </div>

      {/* Health label */}
      <div className="mt-3 flex items-center space-x-1.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: health.color, boxShadow: `0 0 8px ${health.color}60` }}
        />
        <span className="text-xs font-semibold" style={{ color: health.color }}>
          {health.label}
        </span>
      </div>
    </motion.div>
  )
}
