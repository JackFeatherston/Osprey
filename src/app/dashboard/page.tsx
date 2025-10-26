'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useDashboard } from '@/hooks/useTradingData'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2 } from 'lucide-react'
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

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
            <h1 className="text-4xl font-light text-white tracking-tight">Osprey Trading Dashboard</h1>
          </div>
          <Button
            onClick={handleSignOut}
            variant="glass"
            size="default"
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </motion.div>

        {/* Top Section - Trade Proposals Deck + Market Charts */}
        <motion.div
          className="grid grid-cols-[1fr_650px] gap-8 mb-8"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Left - Trade Proposals Deck */}
          <motion.div className="min-h-[700px]" variants={staggerItem}>
            <TradeProposalDeck
              proposals={dashboard.proposals.proposals}
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