'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRecentActivity, useTradeProposals } from '@/hooks/useTradingData'
import { 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'

export default function HistoryPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const { activity, loading: activityLoading, error: activityError, refetch: refetchActivity } = useRecentActivity()
  const { proposals, loading: proposalsLoading, refetch: refetchProposals } = useTradeProposals()

  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected' | 'executed'>('all')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleRefresh = async () => {
    await Promise.all([refetchActivity(), refetchProposals()])
  }

  const getStatusIcon = (decision?: string, executionStatus?: string) => {
    if (executionStatus === 'FILLED') {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }
    if (decision === 'APPROVED') {
      return <CheckCircle className="h-4 w-4 text-blue-600" />
    }
    if (decision === 'REJECTED') {
      return <XCircle className="h-4 w-4 text-red-600" />
    }
    return <Clock className="h-4 w-4 text-yellow-600" />
  }

  const getStatusBadge = (decision?: string, executionStatus?: string) => {
    if (executionStatus === 'FILLED') {
      return <Badge className="bg-green-100 text-green-800 border-green-300">Executed</Badge>
    }
    if (executionStatus === 'REJECTED' || executionStatus === 'CANCELLED') {
      return <Badge className="bg-red-100 text-red-800 border-red-300">Failed</Badge>
    }
    if (decision === 'APPROVED') {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Approved</Badge>
    }
    if (decision === 'REJECTED') {
      return <Badge className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>
    }
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>
  }

  const filteredActivity = activity.filter(item => {
    switch (filter) {
      case 'approved':
        return item.decision === 'APPROVED'
      case 'rejected':
        return item.decision === 'REJECTED'
      case 'executed':
        return item.execution_status === 'FILLED'
      default:
        return true
    }
  })

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Trading History</h1>
                <p className="text-gray-600">Complete history of trade proposals and decisions</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={activityLoading || proposalsLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${activityLoading || proposalsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleSignOut} variant="outline">
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm border">
            {[
              { key: 'all', label: 'All' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'executed', label: 'Executed' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">
              {activity.length}
            </div>
            <div className="text-sm text-gray-600">Total Proposals</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">
              {activity.filter(a => a.decision === 'APPROVED').length}
            </div>
            <div className="text-sm text-gray-600">Approved</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-red-600">
              {activity.filter(a => a.decision === 'REJECTED').length}
            </div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">
              {activity.filter(a => a.execution_status === 'FILLED').length}
            </div>
            <div className="text-sm text-gray-600">Executed</div>
          </div>
        </div>

        {/* History List */}
        <Card>
          <CardHeader>
            <CardTitle>Trade History</CardTitle>
            <CardDescription>
              Chronological list of all trading decisions and executions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading trading history...
              </div>
            ) : activityError ? (
              <div className="text-center py-8 text-red-500">
                {activityError}
              </div>
            ) : filteredActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No trading history found for the selected filter.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredActivity.map((item, index) => (
                  <div key={`${item.proposal_id}-${index}`} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {item.action === 'BUY' ? (
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-600" />
                          )}
                          
                          <div className="font-semibold text-lg">{item.symbol}</div>
                          
                          <span className={`px-2 py-1 rounded text-sm font-medium ${
                            item.action === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {item.action}
                          </span>

                          <span className="text-gray-600">{item.quantity} shares</span>

                          {getStatusBadge(item.decision, item.execution_status)}
                        </div>

                        <p className="text-gray-600 mb-2">{item.reason}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            <span>Price: ${item.price.toFixed(2)}</span>
                          </div>
                          
                          {item.executed_price && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              <span>Executed: ${item.executed_price.toFixed(2)}</span>
                            </div>
                          )}
                          
                          {item.decision_at && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Decided: {formatDateTime(item.decision_at)}</span>
                            </div>
                          )}
                          
                          {item.executed_at && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Executed: {formatDateTime(item.executed_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.decision, item.execution_status)}
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            ${(item.quantity * (item.executed_price || item.price)).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">Total Value</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Links */}
        <div className="mt-8 flex justify-center">
          <Link href="/proposals">
            <Button variant="outline" className="mr-4">
              View Active Proposals
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}