'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OrderBookEntry {
  price: number
  quantity: number
  total: number
}

interface OrderBookProps {
  symbol?: string
}

export default function OrderBook({ symbol = 'AAPL' }: OrderBookProps) {
  const [bids, setBids] = useState<OrderBookEntry[]>([])
  const [asks, setAsks] = useState<OrderBookEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch order book data
    const fetchOrderBook = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/orderbook?symbol=${symbol}`)
        if (response.ok) {
          const data = await response.json()
          setBids(data.bids || [])
          setAsks(data.asks || [])
        }
      } catch (error) {
        console.error('Failed to fetch order book:', error)
        // Set mock data for development
        setBids([
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
        ])
        setAsks([
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
          { price: 498.41, quantity: 10, total: 4984.21 },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchOrderBook()
    const interval = setInterval(fetchOrderBook, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [symbol])

  return (
    <Card className="bg-neutral-800 border-neutral-700 text-white h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-normal text-neutral-100">Orderbook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-3 text-xs text-neutral-400 font-medium mb-3 pb-2 border-b border-neutral-700">
          <div>Price</div>
          <div className="text-center">Quantity</div>
          <div className="text-right">Total Value</div>
        </div>

        {/* Asks (SELL) - Red */}
        <div className="space-y-1 mb-4 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-neutral-800">
          {asks.map((ask, index) => (
            <div
              key={`ask-${index}`}
              className="grid grid-cols-3 text-sm py-2 px-3 rounded relative overflow-hidden"
            >
              {/* Red background bar */}
              <div
                className="absolute inset-0 bg-red-900/30 origin-left"
                style={{
                  width: `${Math.min((ask.quantity / 10) * 100, 100)}%`,
                  transition: 'width 0.3s ease'
                }}
              />
              <div className="relative z-10 text-red-400 font-mono">${ask.price.toFixed(2)}</div>
              <div className="relative z-10 text-center text-neutral-200">{ask.quantity}</div>
              <div className="relative z-10 text-right text-neutral-200 font-mono">${ask.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          ))}
        </div>

        {/* Bids (BUY) - Green */}
        <div className="space-y-1 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-neutral-800">
          {bids.map((bid, index) => (
            <div
              key={`bid-${index}`}
              className="grid grid-cols-3 text-sm py-2 px-3 rounded relative overflow-hidden"
            >
              {/* Green background bar */}
              <div
                className="absolute inset-0 bg-green-900/30 origin-left"
                style={{
                  width: `${Math.min((bid.quantity / 10) * 100, 100)}%`,
                  transition: 'width 0.3s ease'
                }}
              />
              <div className="relative z-10 text-green-400 font-mono">${bid.price.toFixed(2)}</div>
              <div className="relative z-10 text-center text-neutral-200">{bid.quantity}</div>
              <div className="relative z-10 text-right text-neutral-200 font-mono">${bid.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
