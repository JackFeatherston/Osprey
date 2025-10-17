'use client'

import { useState, useEffect } from 'react'
import { api, AccountInfo } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Wallet, TrendingUp, AlertCircle, Loader2 } from 'lucide-react'

interface BuyingPowerProps {
  className?: string
}

export function BuyingPower({ className }: BuyingPowerProps) {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchAccountInfo = async () => {
    try {
      setError(null)
      const data = await api.getAccountInfo()
      setAccountInfo(data)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Failed to fetch account info:', err)
      setError('Failed to load account data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccountInfo()

    // Refresh every 2 minutes
    const interval = setInterval(fetchAccountInfo, 120000)
    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (loading) {
    return (
      <Card className={`bg-neutral-800 border-neutral-700 text-white h-full ${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-normal text-neutral-100">Account Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !accountInfo) {
    return (
      <Card className={`bg-neutral-800 border-neutral-700 text-white h-full ${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-normal text-neutral-100">Account Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error || 'No account data available'}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`bg-neutral-800 border-neutral-700 text-white h-full ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-normal text-neutral-100">Account Balance</CardTitle>
          <span className="text-xs text-neutral-500">
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm text-neutral-400 mt-1">Trading account overview</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Buying Power */}
          <div className="flex items-center justify-between py-3 border-b border-neutral-700">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              <span className="text-neutral-300">Buying Power</span>
            </div>
            <span className="text-xl font-semibold text-white">
              {formatCurrency(accountInfo.buying_power)}
            </span>
          </div>

          {/* Cash */}
          <div className="flex items-center justify-between py-3 border-b border-neutral-700">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-400" />
              <span className="text-neutral-300">Cash</span>
            </div>
            <span className="text-lg font-medium text-neutral-100">
              {formatCurrency(accountInfo.cash)}
            </span>
          </div>

          {/* Portfolio Value */}
          <div className="flex items-center justify-between py-3 border-b border-neutral-700">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              <span className="text-neutral-300">Portfolio Value</span>
            </div>
            <span className="text-lg font-medium text-neutral-100">
              {formatCurrency(accountInfo.portfolio_value)}
            </span>
          </div>

          {/* Account Status */}
          <div className="flex items-center justify-between py-3">
            <span className="text-neutral-300">Status</span>
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
              accountInfo.status === 'ACTIVE'
                ? 'bg-green-900/30 text-green-400'
                : 'bg-yellow-900/30 text-yellow-400'
            }`}>
              {accountInfo.status}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default BuyingPower
