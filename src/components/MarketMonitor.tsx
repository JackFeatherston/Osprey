'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

interface MarketMonitorProps {
  watchlist?: string[]
}

// Mapping of ticker symbols to company domains for logo fetching
const tickerToLogo: Record<string, string> = {
  'AAPL': 'apple.com',
  'GOOGL': 'google.com',
  'TSLA': 'tesla.com',
  'NVDA': 'nvidia.com',
  'MSFT': 'microsoft.com',
}

export default function MarketMonitor({ watchlist }: MarketMonitorProps) {
  const defaultWatchlist = ['AAPL', 'GOOGL', 'TSLA', 'NVDA', 'MSFT']
  const stocks = watchlist || defaultWatchlist

  return (
    <Card className="bg-neutral-800 border-neutral-700 text-white h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-normal text-neutral-100 text-center">
          Market Analyzer Currently Monitoring
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-3">
          {stocks.map((symbol) => (
            <div
              key={symbol}
              className="flex items-center gap-3 text-2xl font-light text-neutral-300 hover:text-white hover:scale-110 transition-all py-2 cursor-pointer"
            >
              {tickerToLogo[symbol] && (
                <Image
                  src={`https://logo.clearbit.com/${tickerToLogo[symbol]}`}
                  alt={`${symbol} logo`}
                  width={32}
                  height={32}
                  className="rounded"
                />
              )}
              <span>{symbol}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
