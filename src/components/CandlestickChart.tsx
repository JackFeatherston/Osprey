'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'

interface BarData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CandlestickChartProps {
  symbol: string
  height?: number
}

export default function CandlestickChart({ symbol, height = 200 }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart instance with dark theme
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: 'solid' as const, color: '#262626' }, // neutral-800
        textColor: '#a3a3a3', // neutral-400
      },
      grid: {
        vertLines: { color: '#404040' }, // neutral-700
        horzLines: { color: '#404040' },
      },
      rightPriceScale: {
        borderColor: '#404040',
      },
      timeScale: {
        borderColor: '#404040',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', // green-500
      downColor: '#ef4444', // red-500
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    // Fetch data
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/bars/${symbol}?days=30`
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.bars && data.bars.length > 0) {
          // Convert data to lightweight-charts format
          const chartData = data.bars.map((bar: BarData) => ({
            time: bar.time.split('T')[0], // Extract YYYY-MM-DD
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          }))

          candlestickSeries.setData(chartData)
          chart.timeScale().fitContent()
        } else {
          setError('No data available')
        }
      } catch (err) {
        console.error(`Error fetching data for ${symbol}:`, err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
      }
    }
  }, [symbol, height])

  return (
    <div className="relative w-full">
      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-neutral-900/80 rounded text-sm font-semibold text-white">
        {symbol}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800/50 rounded z-10">
          <div className="text-xs text-neutral-400">Loading...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800/50 rounded z-10">
          <div className="text-xs text-red-400">{error}</div>
        </div>
      )}
      <div ref={chartContainerRef} className="rounded overflow-hidden" />
    </div>
  )
}
