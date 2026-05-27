'use client'

import React, { useRef, useEffect, useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

interface CursorGlowProps {
  children: React.ReactNode
  className?: string
}

export function CursorGlow({
  children,
  className = ''
}: CursorGlowProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [disabled, setDisabled] = useState(false)

  useEffect(() => {
    // Disable on touch devices or if reduced motion is preferred
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    if (isTouch || prefersReducedMotion()) {
      setDisabled(true)
    }
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    containerRef.current.style.setProperty('--glow-x', `${x}px`)
    containerRef.current.style.setProperty('--glow-y', `${y}px`)
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`${disabled ? '' : 'cursor-glow-area'} ${className}`}
    >
      {children}
    </div>
  )
}
