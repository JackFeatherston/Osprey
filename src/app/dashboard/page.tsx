'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboard } from '@/hooks/useTradingData'
import { AlertCircle, CheckCircle, Clock, DollarSign, TrendingUp, Activity, ArrowRight, History } from 'lucide-react'
import TradeProposalCard from '@/components/TradeProposalCard'
import SystemStatus from '@/components/SystemStatus'
import Link from 'next/link'

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Show loading state only if ALL data is loading (not individual components)
  // This prevents infinite loading when some API calls fail
  const isInitialLoad = dashboard.stats.loading && dashboard.proposals.loading && dashboard.account.loading && 
    !dashboard.stats.error && !dashboard.proposals.error && !dashboard.account.error;
  
  if (isInitialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading dashboard data...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Trading Dashboard</h1>
            <p className="text-gray-600">Welcome, {user.email}</p>
          </div>
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Proposals</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.stats.loading ? '...' : dashboard.stats.stats?.active_proposals ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting your decision
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trades Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.stats.loading ? '...' : dashboard.stats.stats?.executed_trades_today ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Successfully executed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.stats.loading ? '...' : dashboard.stats.stats?.total_trades ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.account.loading ? '...' : 
                 dashboard.account.account ? 
                 `$${dashboard.account.account.portfolio_value.toLocaleString()}` : 
                 '$0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                {dashboard.account.account ? 
                 `$${dashboard.account.account.buying_power.toLocaleString()} buying power` :
                 'Loading...'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* AI Status Card */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                AI Trading Engine
              </CardTitle>
              <CardDescription>
                Status and control of the AI trading system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold capitalize">
                    {dashboard.ai.loading ? 'Loading...' : dashboard.ai.status?.status ?? 'Unknown'}
                  </div>
                  {dashboard.ai.status?.watchlist && (
                    <p className="text-sm text-muted-foreground">
                      Monitoring: {dashboard.ai.status.watchlist.join(', ')}
                    </p>
                  )}
                  {dashboard.ai.status?.strategies && (
                    <p className="text-xs text-muted-foreground">
                      Strategies: {dashboard.ai.status.strategies.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => dashboard.ai.startAI()}
                    disabled={dashboard.ai.status?.status === 'running'}
                  >
                    Start
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => dashboard.ai.stopAI()}
                    disabled={dashboard.ai.status?.status === 'stopped'}
                  >
                    Stop
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>
                Real-time system health and connectivity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SystemStatus 
                websocketStatus={dashboard.isConnected ? 'connected' : 'disconnected'}
              />
            </CardContent>
          </Card>
        </div>

        {/* Active Proposals Preview */}
        {dashboard.proposals.proposals.filter(p => p.status === 'PENDING').length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Active Proposals</h2>
              <Link href="/proposals">
                <Button variant="outline" className="flex items-center gap-2">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="space-y-4">
              {dashboard.proposals.proposals
                .filter(p => p.status === 'PENDING')
                .slice(0, 2)
                .map((proposal) => (
                  <TradeProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onApprove={(id, notes) => dashboard.proposals.submitDecision(id, 'APPROVED', notes)}
                    onReject={(id, notes) => dashboard.proposals.submitDecision(id, 'REJECTED', notes)}
                  />
                ))}
            </div>
            {dashboard.proposals.proposals.filter(p => p.status === 'PENDING').length > 2 && (
              <div className="text-center mt-4">
                <Link href="/proposals">
                  <Button variant="outline">
                    View {dashboard.proposals.proposals.filter(p => p.status === 'PENDING').length - 2} More Proposals
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your latest trading activity and decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.activity.loading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading recent activity...
                </div>
              ) : dashboard.activity.error ? (
                <div className="text-center py-8 text-red-500 flex items-center justify-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {dashboard.activity.error}
                </div>
              ) : dashboard.activity.activity.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="mb-4">
                    No recent activity. The AI trading assistant will display activity here once configured.
                  </div>
                  {dashboard.proposals.proposals.length === 0 && (
                    <div className="text-sm">
                      <Link href="/proposals">
                        <Button variant="outline" className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          View Proposals
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboard.activity.activity.slice(0, 5).map((item, index) => (
                    <div key={`${item.proposal_id}-${index}`} className="flex items-center justify-between border-b pb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.symbol}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.action === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {item.action}
                          </span>
                          <span className="text-sm text-gray-600">{item.quantity} shares</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{item.reason}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">${item.price.toFixed(2)}</div>
                        {item.decision && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            item.decision === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {item.decision}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {dashboard.activity.activity.length > 5 && (
                    <div className="text-center pt-2 flex gap-2 justify-center">
                      <Link href="/proposals">
                        <Button variant="outline" size="sm">
                          View Proposals
                        </Button>
                      </Link>
                      <Link href="/history">
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          <History className="h-3 w-3" />
                          Full History
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {(dashboard.stats.error || dashboard.proposals.error || dashboard.account.error || dashboard.ai.error) && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">System Errors Detected</span>
            </div>
            <div className="mt-2 text-sm text-red-700">
              {dashboard.stats.error && <div>Stats: {dashboard.stats.error}</div>}
              {dashboard.proposals.error && <div>Proposals: {dashboard.proposals.error}</div>}
              {dashboard.account.error && <div>Account: {dashboard.account.error}</div>}
              {dashboard.ai.error && <div>AI Engine: {dashboard.ai.error}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}