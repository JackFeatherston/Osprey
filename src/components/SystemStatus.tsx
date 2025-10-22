/**
 * System status indicator component
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, Loader2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SystemHealth {
  api: 'online' | 'offline' | 'error';
  database: 'online' | 'offline' | 'error';
  websocket: 'connected' | 'disconnected' | 'connecting' | 'error';
  market: 'open' | 'closed';
}

interface SystemStatusProps {
  websocketStatus?: 'connected' | 'disconnected' | 'connecting' | 'error';
  className?: string;
  compact?: boolean;
}

export function SystemStatus({ websocketStatus, className, compact = false }: SystemStatusProps) {
  const checkMarketStatus = (): 'open' | 'closed' => {
    const now = new Date()
    const day = now.getDay() // 0 = Sunday, 6 = Saturday

    // Market closed on weekends
    if (day === 0 || day === 6) {
      return 'closed'
    }

    // Convert to ET (UTC-5 or UTC-4 depending on DST)
    const etOffset = -5 * 60 // ET offset in minutes (simplified, doesn't account for DST)
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
    const etTime = new Date(utcTime + (etOffset * 60000))

    const hours = etTime.getHours()
    const minutes = etTime.getMinutes()
    const timeInMinutes = hours * 60 + minutes

    // Market hours: 9:30 AM - 4:00 PM ET
    const marketOpenTime = 9 * 60 + 30 // 9:30 AM
    const marketCloseTime = 16 * 60 // 4:00 PM

    return timeInMinutes >= marketOpenTime && timeInMinutes < marketCloseTime ? 'open' : 'closed'
  }

  const [health, setHealth] = useState<SystemHealth>({
    api: 'offline',
    database: 'offline',
    websocket: websocketStatus || 'disconnected',
    market: checkMarketStatus()
  });
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [checking, setChecking] = useState(false);

  const checkSystemHealth = async () => {
    if (checking) return;

    setChecking(true);
    try {
      await api.healthCheck();
      setHealth(prev => ({
        ...prev,
        api: 'online',
        database: 'online',
        websocket: websocketStatus || prev.websocket,
        market: checkMarketStatus()
      }));
      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth(prev => ({
        ...prev,
        api: 'offline',
        database: 'offline',
        websocket: websocketStatus || prev.websocket,
        market: checkMarketStatus()
      }));
      setLastCheck(new Date());
    } finally {
      setChecking(false);
    }
  };

  // Update WebSocket status when prop changes
  useEffect(() => {
    if (websocketStatus) {
      setHealth(prev => ({ ...prev, websocket: websocketStatus }));
    }
  }, [websocketStatus]);

  // Check health on mount and periodically (less frequently to reduce load)
  useEffect(() => {
    checkSystemHealth();
    
    const interval = setInterval(checkSystemHealth, 120000); // Check every 2 minutes
    return () => clearInterval(interval);
  }, []); // Remove checkSystemHealth dependency

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'open':
        return 'text-green-600 bg-green-100 border-green-300';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'offline':
      case 'disconnected':
      case 'closed':
        return 'text-gray-600 bg-gray-100 border-gray-300';
      case 'error':
        return 'text-red-600 bg-red-100 border-red-300';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };

  const getStatusIcon = (service: string, status: string) => {
    const iconSize = compact ? 'h-3 w-3' : 'h-4 w-4';

    if (checking && service === 'api') {
      return <Loader2 className={`${iconSize} animate-spin`} />;
    }

    // Special handling for market status
    if (service === 'market') {
      return status === 'open' ? <TrendingUp className={iconSize} /> : <Clock className={iconSize} />;
    }

    switch (status) {
      case 'online':
      case 'connected':
      case 'open':
        return <CheckCircle className={iconSize} />;
      case 'connecting':
        return <Clock className={iconSize} />;
      case 'offline':
      case 'disconnected':
      case 'closed':
        return service === 'websocket' ? <WifiOff className={iconSize} /> : <AlertTriangle className={iconSize} />;
      case 'error':
        return <AlertTriangle className={iconSize} />;
      default:
        return <AlertTriangle className={iconSize} />;
    }
  };

  const overallStatus = () => {
    if (health.api === 'error' || health.database === 'error') return 'error';
    if (health.api === 'offline' || health.database === 'offline') return 'offline';
    if (health.websocket === 'error') return 'degraded';
    if (health.websocket === 'connecting') return 'connecting';
    return 'online';
  };

  if (compact) {
    const status = overallStatus();
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(status)}`}>
          {status === 'online' ? (
            <Wifi className="h-3 w-3" />
          ) : status === 'connecting' ? (
            <Clock className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          <span className="capitalize">{status}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={`bg-neutral-800 border-neutral-700 text-white h-full ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-normal text-neutral-100">System Status</CardTitle>
          <span className="text-xs text-neutral-500">
            Last checked: {lastCheck.toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm text-neutral-400 mt-1">Real-time health and connectivity</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-row-4 gap-3 text-sm">
          {/* API Status */}
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-300">Market Analysis</span>
            <Badge variant="outline" className={`${getStatusColor(health.api)} border-0`}>
              {getStatusIcon('api', health.api)}
              <span className="ml-1 capitalize">{health.api}</span>
            </Badge>
          </div>

          {/* Database Status */}
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-300">Ledger</span>
            <Badge variant="outline" className={`${getStatusColor(health.database)} border-0`}>
              {getStatusIcon('database', health.database)}
              <span className="ml-1 capitalize">{health.database}</span>
            </Badge>
          </div>

          {/* WebSocket Status */}
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-300">Trade Streaming</span>
            <Badge variant="outline" className={`${getStatusColor(health.websocket)} border-0`}>
              {getStatusIcon('websocket', health.websocket)}
              <span className="ml-1 capitalize">{health.websocket}</span>
            </Badge>
          </div>

          {/* Market Status */}
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-300">Market Hours</span>
            <Badge variant="outline" className={`${getStatusColor(health.market)} border-0`}>
              {getStatusIcon('market', health.market)}
              <span className="ml-1 capitalize">{health.market}</span>
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SystemStatus;