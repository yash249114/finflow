'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fadeSlideUp } from '@/lib/motion'

interface MetricCardProps {
  title: string
  value: number | string
  prefix?: string
  suffix?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  icon: React.ReactNode
  formatAsCurrency?: boolean
  delay?: number
}

function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const duration = 1200
    const startTime = performance.now()
    const startValue = 0

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(startValue + (value - startValue) * eased))
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  const formatted = typeof value === 'number' && Math.abs(value) >= 1000
    ? displayValue.toLocaleString('en-US')
    : displayValue.toString()

  return (
    <span>
      {prefix}{formatted}{suffix}
    </span>
  )
}

export default function MetricCard({
  title,
  value,
  prefix = '',
  suffix = '',
  trend,
  trendLabel,
  icon,
  formatAsCurrency,
  delay = 0,
}: MetricCardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  const isNumeric = !isNaN(numericValue)

  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-text-muted',
  }

  const trendArrow = {
    up: '↑',
    down: '↓',
    neutral: '→',
  }

  return (
    <motion.div
      variants={fadeSlideUp}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className="glass-card rounded-2xl p-5 cursor-glow-area group hover:border-white/[0.08] transition-[background-color,border-color,box-shadow,color,opacity] duration-300"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          {title}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] group-hover:bg-neural-blue/10 transition-colors">
          {icon}
        </div>
      </div>

      {/* Value */}
      <div className="text-2xl font-bold text-white tracking-tight">
        {isNumeric && formatAsCurrency ? (
          <AnimatedCounter value={numericValue} prefix={prefix || '$'} />
        ) : isNumeric ? (
          <AnimatedCounter value={numericValue} prefix={prefix} suffix={suffix} />
        ) : (
          <span>{prefix}{value}{suffix}</span>
        )}
      </div>

      {/* Trend */}
      {trend && trendLabel && (
        <div className={`mt-2 flex items-center space-x-1 text-[11px] font-medium ${trendColors[trend]}`}>
          <span>{trendArrow[trend]}</span>
          <span>{trendLabel}</span>
        </div>
      )}
    </motion.div>
  )
}
