'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { api, OrderHistoryItem } from '@/lib/api'

export default function OrderHistory() {
  const [history, setHistory] = useState<OrderHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

    fetchOrderHistory()
  }, [])

  return (
    <Card className="bg-neutral-800 border-neutral-700 text-white">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-normal text-neutral-100">Order History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-neutral-400">Loading order history...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">{error}</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-neutral-400">No order history yet</div>
        ) : (
          <div className="rounded-md border border-neutral-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-neutral-400">Ticker</TableHead>
                  <TableHead className="text-neutral-400">Action</TableHead>
                  <TableHead className="text-neutral-400 text-right">Price</TableHead>
                  <TableHead className="text-neutral-400 text-right">Quantity</TableHead>
                  <TableHead className="text-neutral-400 text-right">Total Value</TableHead>
                  <TableHead className="text-neutral-400">Decision</TableHead>
                  <TableHead className="text-neutral-400">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.decision_id}>
                    <TableCell className="font-semibold text-neutral-100">
                      {item.symbol}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-right font-mono text-neutral-200">
                      ${item.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-neutral-200">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-neutral-200">
                      ${item.total_value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-neutral-300">
                      {new Date(item.decided_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
