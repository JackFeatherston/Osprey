'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useDashboard } from '@/hooks/useTradingData'
import TradeProposalDeck from '@/components/TradeProposalDeck'
import OrderBook from '@/components/OrderBook'
import MarketMonitor from '@/components/MarketMonitor'
import SystemStatus from '@/components/SystemStatus'
import BuyingPower from '@/components/BuyingPower'
import MarketChartsGrid from '@/components/MarketChartsGrid'

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
      <div className="min-h-screen flex items-center justify-center bg-neutral-900">
        <div className="text-lg text-white">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-neutral-900 p-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header with Logout */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors border border-neutral-700 rounded-lg hover:border-neutral-500"
          >
            Sign Out
          </button>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-rows-[420px_minmax(500px,_1fr)] gap-6 h-[calc(100vh-8rem)]">
          {/* Top Section - Trade Proposals Deck + Market Charts */}
          <div className="grid grid-cols-[1fr_550px] gap-6 overflow-visible">
            {/* Left - Trade Proposals Deck */}
            <div className="overflow-visible">
              <TradeProposalDeck
                proposals={dashboard.proposals.proposals}
                onApprove={(id, notes) => dashboard.proposals.submitDecision(id, 'APPROVED', notes)}
                onReject={(id, notes) => dashboard.proposals.submitDecision(id, 'REJECTED', notes)}
              />
            </div>

            {/* Right - Market Charts Grid */}
            <div className="overflow-hidden">
              <MarketChartsGrid watchlist={dashboard.ai.status?.watchlist} />
            </div>
          </div>

          {/* Bottom Section - Three Columns */}
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-6">
            {/* Left - Order Book */}
            <div className="col-span-1">
              <OrderBook />
            </div>

            {/* Middle - Buying Power */}
            <div className="col-span-1">
              <BuyingPower />
            </div>

            {/* Right - System Status and Market Monitor */}
            <div className="col-span-1 grid grid-rows-2 gap-6">
              <div>
                <SystemStatus websocketStatus={dashboard.connectionState || 'disconnected'} />
              </div>
              <div>
                <MarketMonitor watchlist={dashboard.ai.status?.watchlist} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}