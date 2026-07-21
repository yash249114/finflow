// Premium motion variants and physics configurations for FinFlow
// Uses Framer Motion for cinematic, alive-feeling interactions

import { type Variants } from 'framer-motion'

// ─── Spring Physics ───────────────────────────────────────
export const springs = {
  /** Snappy, responsive spring — buttons, toggles */
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
  /** Smooth, elegant spring — panels, cards */
  smooth: { type: 'spring' as const, stiffness: 260, damping: 25 },
  /** Soft, floating spring — overlays, modals */
  soft: { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 },
  /** Bouncy, playful spring — counters, badges */
  bouncy: { type: 'spring' as const, stiffness: 350, damping: 15 },
}

// ─── Stagger Containers ──────────────────────────────────
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

// ─── Child Variants ──────────────────────────────────────
export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

export const fadeSlideDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

// ─── Dropdown / Popover ──────────────────────────────────
export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -8,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    filter: 'blur(4px)',
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
}

// ─── Page Transition ─────────────────────────────────────
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(6px)',
    transition: { duration: 0.3 },
  },
}

// ─── Utility: Reduced Motion Check ───────────────────────
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}