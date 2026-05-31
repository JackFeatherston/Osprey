'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'

interface MarketMonitorProps {
  watchlist?: string[]
  className?: string
}

const tickerToDomain: Record<string, string> = {
  'AAPL': 'apple.com',
  'GOOGL': 'google.com',
  'TSLA': 'tesla.com',
  'NVDA': 'nvidia.com',
  'MSFT': 'microsoft.com',
}

function StockLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false)
  const domain = tickerToDomain[symbol]

  if (!domain || failed) {
    return (
      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
        <span className="text-white/60 text-xs font-bold">{symbol.slice(0, 2)}</span>
      </div>
    )
  }

  return (
    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center p-2">
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt={`${symbol} logo`}
        width={32}
        height={32}
        className="object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export default function MarketMonitor({ watchlist, className }: MarketMonitorProps) {
  const defaultWatchlist = ['AAPL', 'GOOGL', 'TSLA', 'NVDA', 'MSFT']
  const stocks = watchlist || defaultWatchlist

  return (
    <Card variant="glass-panel" animated hover className={`h-full ${className}`}>
      <motion.div
        className="p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-light tracking-wider text-neutral-100">
              Currently Monitoring
            </h3>
          </div>
          <div className="text-xs text-white/40 font-light">
            {stocks.length} symbols
          </div>
        </div>

        {/* Stocks Grid */}
        <div className="grid grid-cols-1 gap-3">
          {stocks.map((symbol) => (
            <motion.div
              key={symbol}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className="glass-subtle rounded-xl p-4 cursor-pointer transition-all duration-200 border border-white/5 hover:border-white/10"
            >
              <div className="flex items-center gap-4">
                <StockLogo symbol={symbol} />

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
        </div>
      </motion.div>
    </Card>
  )
}
