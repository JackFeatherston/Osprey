'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api, OrderHistoryItem } from '@/lib/api'

export default function OrderHistory() {
  const [history, setHistory] = useState<OrderHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrderHistory = async () => {
    try {
      setLoading(true)
      const data = await api.getOrderHistory()
      setHistory(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch order history:', err)
      setError(err instanceof Error ? err.message : 'Failed to load order history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrderHistory()

    // Listen for trade decision events and optimistically add to history
    // OPTIMIZATION: Add decision to local state immediately (no API refetch needed)
    const handleDecisionSubmitted = (event: CustomEvent) => {
      const { decision, proposal, notes } = event.detail

      console.log('[OrderHistory] Decision submitted, adding to history optimistically...')

      // Create order history item from proposal + decision
      const newHistoryItem: OrderHistoryItem = {
        decision_id: `temp-${Date.now()}`, // Temporary ID
        proposal_id: proposal.id,
        symbol: proposal.symbol,
        action: proposal.action,
        quantity: proposal.quantity,
        price: proposal.price,
        total_value: proposal.quantity * proposal.price,
        reason: proposal.reason,
        strategy: proposal.strategy || 'Unknown',
        decision: decision,
        decision_notes: notes,
        decided_at: new Date().toISOString(),
        decision_at: new Date().toISOString(),
        proposed_at: proposal.created_at || proposal.timestamp,
        user_id: proposal.user_id,
        execution_status: decision === 'APPROVED' ? 'PENDING' : undefined
      }

      // Add to beginning of history list
      setHistory(prev => [newHistoryItem, ...prev])
    }

    window.addEventListener('trade-decision-submitted', handleDecisionSubmitted as EventListener)

    return () => {
      window.removeEventListener('trade-decision-submitted', handleDecisionSubmitted as EventListener)
    }
  }, [])

  return (
    <Card className="bg-neutral-800 border-neutral-700 text-white">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-normal text-neutral-100">Order History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Header - always show */}
        <div className="grid grid-cols-7 text-xs text-neutral-400 font-medium mb-3 pb-2 border-b border-neutral-700">
          <div>Ticker</div>
          <div>Action</div>
          <div className="text-right">Price</div>
          <div className="text-right">Quantity</div>
          <div className="text-right">Total Value</div>
          <div>Decision</div>
          <div>Date</div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-8 text-neutral-400">Loading order history...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">{error}</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-neutral-400">No orders yet</div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-neutral-800">
            <div className="space-y-1">
              {history.map((item) => (
                <div
                  key={item.decision_id}
                  className="grid grid-cols-7 text-sm py-2 px-3 rounded hover:bg-neutral-700/30"
                >
                  <div className="font-semibold text-neutral-100">{item.symbol}</div>
                  <div>
                    <Badge
                      variant="outline"
                      className={
                        item.action === 'BUY'
                          ? 'bg-green-900/30 text-green-400 border-green-700'
                          : 'bg-red-900/30 text-red-400 border-red-700'
                      }
                    >
                      {item.action}
                    </Badge>
                  </div>
                  <div className="text-right font-mono text-neutral-200">
                    ${item.price.toFixed(2)}
                  </div>
                  <div className="text-right text-neutral-200">{item.quantity}</div>
                  <div className="text-right font-mono text-neutral-200">
                    ${item.total_value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
                  <div>
                    <Badge
                      variant="outline"
                      className={
                        item.decision === 'APPROVED'
                          ? 'bg-blue-900/30 text-blue-400 border-blue-700'
                          : 'bg-neutral-700/50 text-neutral-400 border-neutral-600'
                      }
                    >
                      {item.decision}
                    </Badge>
                  </div>
                  <div className="text-neutral-300 text-xs">
                    {new Date(item.decided_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
