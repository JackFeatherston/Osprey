'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OrderBookEntry {
  symbol: string
  price: number
  quantity: number
  total: number
  type: 'bid' | 'ask'
}

interface OrderBookProps {
  symbols?: string[]
}

export default function OrderBook({ symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'] }: OrderBookProps) {
  const [entries, setEntries] = useState<OrderBookEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch order book data for all symbols
    const fetchOrderBooks = async () => {
      try {
        const allEntries: OrderBookEntry[] = []

        for (const symbol of symbols) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/orderbook?symbol=${symbol}`)
          if (response.ok) {
            const data = await response.json()

            // Add asks with symbol
            const asks = (data.asks || []).map((ask: any) => ({
              symbol,
              price: ask.price,
              quantity: ask.quantity,
              total: ask.total,
              type: 'ask' as const
            }))

            // Add bids with symbol
            const bids = (data.bids || []).map((bid: any) => ({
              symbol,
              price: bid.price,
              quantity: bid.quantity,
              total: bid.total,
              type: 'bid' as const
            }))

            allEntries.push(...asks, ...bids)
          } else {
            console.error(`Failed to fetch order book for ${symbol}:`, response.status, response.statusText)
          }
        }

        setEntries(allEntries)
      } catch (error) {
        console.error('Failed to fetch order books:', error)
        setEntries([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrderBooks()
    const interval = setInterval(fetchOrderBooks, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [symbols])

  // Group entries by symbol
  const groupedEntries = symbols.reduce((acc, symbol) => {
    const asks = entries.filter(e => e.symbol === symbol && e.type === 'ask')
    const bids = entries.filter(e => e.symbol === symbol && e.type === 'bid')
    acc[symbol] = { asks, bids }
    return acc
  }, {} as Record<string, { asks: OrderBookEntry[], bids: OrderBookEntry[] }>)

  return (
    <Card variant="glass-panel" animated hover className="text-white h-full flex flex-col font-light">
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="text-xl font-light text-neutral-100">Orderbook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="grid grid-cols-4 text-xs text-neutral-400 mb-3 pb-2 border-b border-neutral-700 flex-shrink-0">
          <div>Ticker</div>
          <div>Price</div>
          <div className="text-center">Quantity</div>
          <div className="text-right">Total Value</div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {symbols.map((symbol) => {
            const { asks, bids } = groupedEntries[symbol] || { asks: [], bids: [] }

            return (
              <div key={symbol} className="mb-6 last:mb-0">
                {/* Asks (SELL) - Red */}
                <div className="space-y-1 mb-2">
                  {asks.map((ask, index) => (
                    <div
                      key={`${symbol}-ask-${index}`}
                      className="grid grid-cols-4 text-sm py-2 px-3 rounded relative overflow-hidden"
                    >
                      {/* Red background bar */}
                      <div
                        className="absolute inset-0 bg-red-900/30 origin-left"
                        style={{
                          width: `${Math.min((ask.quantity / 10) * 100, 100)}%`,
                          transition: 'width 0.3s ease'
                        }}
                      />
                      <div className="relative z-10 text-neutral-300">{ask.symbol}</div>
                      <div className="relative z-10 text-red-400 ">${ask.price.toFixed(2)}</div>
                      <div className="relative z-10 text-center text-neutral-200">{ask.quantity}</div>
                      <div className="relative z-10 text-right text-neutral-200">${ask.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                </div>

                {/* Bids (BUY) - Green */}
                <div className="space-y-1 pb-4 border-b border-neutral-700">
                  {bids.map((bid, index) => (
                    <div
                      key={`${symbol}-bid-${index}`}
                      className="grid grid-cols-4 text-sm py-2 px-3 rounded relative overflow-hidden"
                    >
                      {/* Green background bar */}
                      <div
                        className="absolute inset-0 bg-green-900/30 origin-left"
                        style={{
                          width: `${Math.min((bid.quantity / 10) * 100, 100)}%`,
                          transition: 'width 0.3s ease'
                        }}
                      />
                      <div className="relative z-10 text-neutral-300">{bid.symbol}</div>
                      <div className="relative z-10 text-green-400">${bid.price.toFixed(2)}</div>
                      <div className="relative z-10 text-center text-neutral-200">{bid.quantity}</div>
                      <div className="relative z-10 text-right text-neutral-200">${bid.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
