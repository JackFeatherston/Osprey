'use client'

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Eye } from 'lucide-react'
import Image from 'next/image'
import { staggerContainer, staggerItem } from '@/lib/animations'

interface MarketMonitorProps {
  watchlist?: string[]
  className?: string
}

// Mapping of ticker symbols to company domains for logo fetching
const tickerToLogo: Record<string, string> = {
  'AAPL': 'apple.com',
  'GOOGL': 'google.com',
  'TSLA': 'tesla.com',
  'NVDA': 'nvidia.com',
  'MSFT': 'microsoft.com',
}

export default function MarketMonitor({ watchlist, className }: MarketMonitorProps) {
  const defaultWatchlist = ['AAPL', 'GOOGL', 'TSLA', 'NVDA', 'MSFT']
  const stocks = watchlist || defaultWatchlist

  return (
    <Card variant="glass-panel" animated hover className={`h-full ${className}`}>
      <motion.div
        className="p-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div className="flex items-center justify-between mb-6" variants={staggerItem}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-light tracking-wider text-neutral-100">
              Currently Monitoring
            </h3>
          </div>
          <div className="text-xs text-white/40 font-light">
            {stocks.length} symbols
          </div>
        </motion.div>

        {/* Stocks Grid */}
        <motion.div className="grid grid-cols-1 gap-3" variants={staggerContainer}>
          {stocks.map((symbol, index) => (
            <motion.div
              key={symbol}
              variants={staggerItem}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className="glass-subtle rounded-xl p-4 cursor-pointer transition-all duration-200 border border-white/5 hover:border-white/10"
            >
              <div className="flex items-center gap-4">
                {/* Logo */}
                {tickerToLogo[symbol] && (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
                    <Image
                      src={`https://logo.clearbit.com/${tickerToLogo[symbol]}`}
                      alt={`${symbol} logo`}
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                )}

                {/* Symbol */}
                <div className="flex-1">
                  <div className="text-white text-xl font-bold tracking-tight">
                    {symbol}
                  </div>
                  <div className="text-white/40 text-xs font-light">
                    Actively monitored
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </Card>
  )
}
