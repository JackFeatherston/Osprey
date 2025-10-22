'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useDashboard } from '@/hooks/useTradingData'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2, Sparkles } from 'lucide-react'
import TradeProposalDeck from '@/components/TradeProposalDeck'
import OrderBook from '@/components/OrderBook'
import MarketMonitor from '@/components/MarketMonitor'
import SystemStatus from '@/components/SystemStatus'
import BuyingPower from '@/components/BuyingPower'
import MarketChartsGrid from '@/components/MarketChartsGrid'
import OrderHistory from '@/components/OrderHistory'
import { pageVariants, staggerContainer, staggerItem } from '@/lib/animations'

export default function Dashboard() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const dashboard = useDashboard()
  const [generatingTest, setGeneratingTest] = useState(false)
  const [testProposals, setTestProposals] = useState<any[]>([])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleGenerateTestProposals = () => {
    setGeneratingTest(true)

    // Generate test proposals locally for design testing
    const newTestProposals = [
      {
        id: `test-${Date.now()}-1`,
        symbol: 'AAPL',
        action: 'BUY' as const,
        quantity: 50,
        price: 178.45,
        reason: 'Strong technical indicators: 50-day MA crossed above 200-day MA (golden cross). RSI at 62 shows bullish momentum without being overbought. Recent product launch driving positive sentiment.',
        strategy: 'Moving Average Crossover',
        status: 'PENDING' as const,
        timestamp: new Date().toISOString(),
        user_id: user?.id || '',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString()
      },
      {
        id: `test-${Date.now()}-2`,
        symbol: 'TSLA',
        action: 'SELL' as const,
        quantity: 25,
        price: 242.18,
        reason: 'Bearish divergence detected: Price making higher highs while RSI making lower highs. Trading volume decreasing, suggesting weakening uptrend. Profit-taking opportunity after 15% gain.',
        strategy: 'RSI Divergence',
        status: 'PENDING' as const,
        timestamp: new Date().toISOString(),
        user_id: user?.id || '',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString()
      },
      {
        id: `test-${Date.now()}-3`,
        symbol: 'NVDA',
        action: 'BUY' as const,
        quantity: 30,
        price: 495.27,
        reason: 'Breaking out of consolidation pattern with strong volume. Positive news sentiment around AI chip demand. Support level confirmed at $480, setting up favorable risk/reward ratio.',
        strategy: 'Breakout Pattern',
        status: 'PENDING' as const,
        timestamp: new Date().toISOString(),
        user_id: user?.id || '',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }
    ]

    setTestProposals(prev => [...newTestProposals, ...prev])
    setGeneratingTest(false)
  }

  // Merge test proposals with real proposals
  const allProposals = [...testProposals, ...dashboard.proposals.proposals]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-charcoal">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-white/40" />
          <div className="text-lg text-white/60 font-light">Loading your dashboard...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <motion.div
      className="min-h-screen theme-charcoal p-8"
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      <div className="max-w-[1920px] mx-auto">
        {/* Header with Logout */}
        <motion.div
          className="flex justify-between items-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <h1 className="text-4xl font-light text-white tracking-tight">Trading Dashboard</h1>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleGenerateTestProposals}
              variant="glass"
              size="default"
              className="gap-2"
              disabled={generatingTest}
            >
              {generatingTest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generatingTest ? 'Generating...' : 'Test Proposals'}
            </Button>
            <Button
              onClick={handleSignOut}
              variant="glass"
              size="default"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* Top Section - Trade Proposals Deck + Market Charts */}
        <motion.div
          className="grid grid-cols-[1fr_550px] gap-8 mb-8"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Left - Trade Proposals Deck */}
          <motion.div className="min-h-[700px]" variants={staggerItem}>
            <TradeProposalDeck
              proposals={allProposals}
              onApprove={(id, notes) => dashboard.proposals.submitDecision(id, 'APPROVED', notes)}
              onReject={(id, notes) => dashboard.proposals.submitDecision(id, 'REJECTED', notes)}
            />
          </motion.div>

          {/* Right - Market Charts Grid */}
          <motion.div className="h-[700px]" variants={staggerItem}>
            <MarketChartsGrid watchlist={dashboard.ai.status?.watchlist} />
          </motion.div>
        </motion.div>

        {/* Middle Section - Three Columns */}
        <motion.div
          className="grid grid-cols-[1fr_1fr_1fr] gap-8 mb-8 mt-40"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Left - Order Book */}
          <motion.div className="col-span-1 h-[700px]" variants={staggerItem}>
            <OrderBook />
          </motion.div>

          {/* Middle - Buying Power */}
          <motion.div className="col-span-1 h-[700px]" variants={staggerItem}>
            <BuyingPower />
          </motion.div>

          {/* Right - System Status and Market Monitor */}
          <motion.div className="col-span-1 grid grid-rows-2 gap-8" variants={staggerItem}>
            <div>
              <SystemStatus websocketStatus={dashboard.connectionStatus} />
            </div>
            <div>
              <MarketMonitor watchlist={dashboard.ai.status?.watchlist} />
            </div>
          </motion.div>
        </motion.div>

        {/* Order History - Full Width at Bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <OrderHistory />
        </motion.div>
      </div>
    </motion.div>
  )
}