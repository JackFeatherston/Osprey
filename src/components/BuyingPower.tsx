'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { api, AccountInfo } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Wallet, TrendingUp, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { staggerContainer, staggerItem, numberVariants } from '@/lib/animations'

interface BuyingPowerProps {
  className?: string
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useSpring(0, { stiffness: 100, damping: 30, mass: 1 })
  const rounded = useTransform(motionValue, (latest) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(latest)
  )

  useEffect(() => {
    motionValue.set(value)
  }, [value, motionValue])

  return <motion.span>{rounded}</motion.span>
}

export function BuyingPower({ className }: BuyingPowerProps) {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchAccountInfo = async () => {
    try {
      setError(null)
      const data = await api.getAccountInfo()
      setAccountInfo(data)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Failed to fetch account info:', err)
      setError('Failed to load account data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccountInfo()

    // Refresh every 2 minutes
    const interval = setInterval(fetchAccountInfo, 120000)
    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (loading) {
    return (
      <Card variant="glass-panel" className={`h-full ${className}`}>
        <div className="p-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-white/40" />
          </div>
        </div>
      </Card>
    )
  }

  if (error || !accountInfo) {
    return (
      <Card variant="glass-panel" className={`h-full ${className}`}>
        <div className="p-8">
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <span className="text-sm text-white/60">{error || 'No account data available'}</span>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card variant="glass-panel" animated hover className={`h-full ${className}`}>
      <motion.div
        className="p-8"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div className="flex items-center justify-between mb-8" variants={staggerItem}>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-light tracking-wider text-neutral-100">
              Account Balance
            </h3>
          </div>
          <span className="text-xs text-white/40 font-light">
            {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </motion.div>

        {/* Hero - Buying Power */}
        <motion.div className="mb-10" variants={staggerItem}>
          <div className="text-white/40 text-xs font-light tracking-wider mb-2">
            Buying Power
          </div>
          <div className="text-white text-7xl font-bold tracking-tighter leading-none mb-1">
            <AnimatedNumber value={accountInfo.buying_power} />
          </div>
          <div className="text-white/40 text-sm font-light">Available for trading</div>
        </motion.div>

        {/* Secondary Metrics */}
        <motion.div className="grid grid-cols-2 gap-6" variants={staggerContainer}>
          {/* Cash */}
          <motion.div variants={staggerItem} className="glass-subtle rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white/40 text-xs font-light  tracking-wider">
                Cash
              </span>
            </div>
            <div className="text-white text-2xl font-bold tracking-tight">
              {formatCurrency(accountInfo.cash)}
            </div>
          </motion.div>

          {/* Portfolio Value */}
          <motion.div variants={staggerItem} className="glass-subtle rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white/40 text-xs font-light tracking-wider">
                Portfolio
              </span>
            </div>
            <div className="text-white text-2xl font-bold tracking-tight">
              {formatCurrency(accountInfo.portfolio_value)}
            </div>
          </motion.div>
        </motion.div>

        {/* Account Status */}
        <motion.div className="mt-6 flex items-center justify-between" variants={staggerItem}>
          <span className="text-white/40 text-xs font-light tracking-wider">
            Account Status
          </span>
          <Badge
            variant={accountInfo.status === 'ACTIVE' ? 'success' : 'warning'}
            animated
          >
            {accountInfo.status}
          </Badge>
        </motion.div>
      </motion.div>
    </Card>
  )
}

export default BuyingPower
