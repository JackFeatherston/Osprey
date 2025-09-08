/**
 * System status indicator component
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SystemHealth {
  api: 'online' | 'offline' | 'error';
  database: 'online' | 'offline' | 'error';
  websocket: 'connected' | 'disconnected' | 'connecting' | 'error';
}

interface SystemStatusProps {
  websocketStatus?: 'connected' | 'disconnected' | 'connecting' | 'error';
  className?: string;
  compact?: boolean;
}

export function SystemStatus({ websocketStatus, className, compact = false }: SystemStatusProps) {
  const [health, setHealth] = useState<SystemHealth>({
    api: 'offline',
    database: 'offline',
    websocket: websocketStatus || 'disconnected'
  });
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [checking, setChecking] = useState(false);

  const checkSystemHealth = async () => {
    if (checking) return;
    
    setChecking(true);
    try {
      const healthCheck = await api.healthCheck();
      setHealth(prev => ({
        ...prev,
        api: 'online',
        database: 'online',
        websocket: websocketStatus || prev.websocket
      }));
      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth(prev => ({
        ...prev,
        api: 'offline',
        database: 'offline',
        websocket: websocketStatus || prev.websocket
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
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
        return 'text-green-600 bg-green-100 border-green-300';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'offline':
      case 'disconnected':
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

    switch (status) {
      case 'online':
      case 'connected':
        return <CheckCircle className={iconSize} />;
      case 'connecting':
        return <Clock className={iconSize} />;
      case 'offline':
      case 'disconnected':
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
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">System Status</span>
        <span className="text-xs text-gray-500">
          Last checked: {lastCheck.toLocaleTimeString()}
        </span>
      </div>
      
      <div className="grid grid-row-3 gap-2 text-sm">
        {/* API Status */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600">API</span>
          <Badge variant="outline" className={getStatusColor(health.api)}>
            {getStatusIcon('api', health.api)}
            <span className="ml-1 capitalize">{health.api}</span>
          </Badge>
        </div>

        {/* Database Status */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Database</span>
          <Badge variant="outline" className={getStatusColor(health.database)}>
            {getStatusIcon('database', health.database)}
            <span className="ml-1 capitalize">{health.database}</span>
          </Badge>
        </div>


        {/* WebSocket Status */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Real-time</span>
          <Badge variant="outline" className={getStatusColor(health.websocket)}>
            {getStatusIcon('websocket', health.websocket)}
            <span className="ml-1 capitalize">{health.websocket}</span>
          </Badge>
        </div>
      </div>
    </div>
  );
}

export default SystemStatus;