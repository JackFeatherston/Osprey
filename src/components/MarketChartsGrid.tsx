'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CandlestickChart from './CandlestickChart'

interface MarketChartsGridProps {
  watchlist?: string[]
}

export default function MarketChartsGrid({
  watchlist
}: MarketChartsGridProps) {
  const symbols = watchlist && watchlist.length > 0
    ? watchlist
    : ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA']
  return (
    <Card variant="glass-panel" animated hover className="text-white h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-normal text-neutral-100">Market Charts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 h-[calc(100%-4rem)] overflow-y-auto">
        {symbols.map((symbol) => (
          <div key={symbol} className="w-full">
            <CandlestickChart symbol={symbol} height={120} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
