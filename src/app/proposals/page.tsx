'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useTradeProposals } from '@/hooks/useTradingData'
import TradeProposalsList from '@/components/TradeProposalsList'
import { ArrowLeft, RefreshCw } from 'lucide-react'

export default function ProposalsPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const { proposals, loading: proposalsLoading, error, refetch, submitDecision } = useTradeProposals()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleApprove = async (proposalId: string, notes?: string) => {
    await submitDecision(proposalId, 'APPROVED', notes)
  }

  const handleReject = async (proposalId: string, notes?: string) => {
    await submitDecision(proposalId, 'REJECTED', notes)
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
                <h1 className="text-3xl font-bold text-gray-900">Trade Proposals</h1>
                <p className="text-gray-600">Review and make decisions on AI-generated trade opportunities</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={refetch}
                disabled={proposalsLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${proposalsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleSignOut} variant="outline">
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">
              {proposals.filter(p => p.status === 'PENDING').length}
            </div>
            <div className="text-sm text-gray-600">Pending Decisions</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">
              {proposals.filter(p => p.status === 'APPROVED').length}
            </div>
            <div className="text-sm text-gray-600">Approved Today</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-red-600">
              {proposals.filter(p => p.status === 'REJECTED').length}
            </div>
            <div className="text-sm text-gray-600">Rejected Today</div>
          </div>
        </div>

        {/* Proposals List */}
        <TradeProposalsList
          proposals={proposals}
          loading={proposalsLoading}
          error={error}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>
    </div>
  )
}