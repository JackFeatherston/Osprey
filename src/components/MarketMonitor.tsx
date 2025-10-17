'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MarketMonitorProps {
  watchlist?: string[]
}

export default function MarketMonitor({ watchlist }: MarketMonitorProps) {
  const defaultWatchlist = ['AAPL', 'GOOGL', 'TSLA', 'NVDA', 'MSFT']
  const stocks = watchlist || defaultWatchlist

  return (
    <Card className="bg-neutral-800 border-neutral-700 text-white h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-normal text-neutral-100">
          Market Analyzer Currently Monitoring
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stocks.map((symbol) => (
            <div
              key={symbol}
              className="text-2xl font-light text-neutral-300 hover:text-white transition-colors py-2"
            >
              {symbol}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
