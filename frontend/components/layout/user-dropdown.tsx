'use client'

import React, { useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Building2,
  CreditCard,
  Shield,
  BellRing,
  LogOut,
  ChevronRight,
  Crown,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { dropdownVariants, fadeSlideDown } from '@/lib/motion'

interface UserDropdownProps {
  open: boolean
  onClose: () => void
}

export default function UserDropdown({ open, onClose }: UserDropdownProps) {
  const { user, logout } = useAuth()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (open) {
      // Use setTimeout to avoid catching the opening click
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 10)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [open, onClose])

  const handleLogout = async () => {
    onClose()
    await logout()
  }

  const isAdmin = user?.role === 'admin'

  const menuItems = [
    { icon: User, label: 'Profile', href: '/settings/profile' },
    { icon: Building2, label: 'Company Settings', href: '/settings/profile' },
    { icon: CreditCard, label: 'Billing & Plans', href: '/settings/billing' },
    { icon: Shield, label: 'Security', href: '/settings/security' },
    { icon: BellRing, label: 'Notifications', href: '/settings/notifications' },
  ]

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  const planColors: Record<string, string> = {
    free: 'text-silver bg-silver/10 border-silver/20',
    pro: 'text-neural-blue bg-neural-blue/10 border-neural-blue/20',
    max: 'text-neural-violet bg-neural-violet/10 border-neural-violet/20',
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Invisible backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
            onClick={onClose}
          />

          <motion.div
            ref={dropdownRef}
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl glass-dropdown z-50 overflow-hidden select-none"
          >
            {/* User Info Header */}
            <div className="p-4 border-b border-white/[0.04]">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neural-blue to-neural-violet text-sm font-bold text-white uppercase shrink-0">
                  {getInitials(user?.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {user?.email || ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                    planColors[user?.plan || 'free'] || planColors.free
                  }`}
                >
                  {user?.plan || 'free'}
                </span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1.5">
              {menuItems.map((item, index) => (
                <motion.div
                  key={item.label}
                  variants={fadeSlideDown}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: index * 0.03 }}
                >
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center justify-between px-4 py-2.5 text-sm text-silver hover:text-white hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="h-4 w-4 text-text-muted group-hover:text-neural-blue transition-colors" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-text-dim opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Admin Link */}
            {isAdmin && (
              <div className="border-t border-white/[0.04] py-1.5">
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="flex items-center justify-between px-4 py-2.5 text-sm text-neural-violet hover:text-white hover:bg-neural-violet/5 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <Crown className="h-4 w-4" />
                    <span className="font-medium">Admin Panel</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </div>
            )}

            {/* Logout */}
            <div className="border-t border-white/[0.04] py-1.5">
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-danger/80 hover:text-danger hover:bg-danger/5 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
