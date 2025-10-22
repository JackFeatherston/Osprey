/**
 * Minimal System Status with Pill Indicators
 * Apple-inspired design with smooth transitions
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Wifi, Loader2, TrendingUp, Activity, Database, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { staggerContainer, staggerItem } from '@/lib/animations';

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
        // Don't override websocket status - it's managed independently via prop
        market: checkMarketStatus()
      }));
      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth(prev => ({
        ...prev,
        api: 'offline',
        database: 'offline',
        // Don't override websocket status - it's managed independently via prop
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

  const overallStatus = () => {
    if (health.api === 'error' || health.database === 'error') return 'error';
    if (health.api === 'offline' || health.database === 'offline') return 'offline';
    if (health.websocket === 'error') return 'degraded';
    if (health.websocket === 'connecting') return 'connecting';
    return 'online';
  };

  const getPillColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'open':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'connecting':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'offline':
      case 'disconnected':
      case 'closed':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'open':
        return <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />;
      case 'connecting':
        return <Loader2 className="w-2 h-2 animate-spin text-yellow-400" />;
      case 'offline':
      case 'disconnected':
      case 'closed':
        return <div className="w-2 h-2 rounded-full bg-gray-400" />;
      case 'error':
        return <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  if (compact) {
    const status = overallStatus();
    return (
      <motion.div
        className={`flex items-center gap-2 ${className}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getPillColor(status)} transition-all duration-300`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {getStatusIndicator(status)}
          <span className="text-xs font-semibold capitalize">{status}</span>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <Card variant="glass-panel" animated hover className={`h-full ${className}`}>
      <motion.div
        className="p-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div className="flex items-center justify-between mb-6" variants={staggerItem}>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-light tracking-wider text-neutral-100">
              System Status
            </h3>
          </div>
          <span className="text-xs text-white/40 font-light">
            {lastCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </motion.div>

        {/* Status Pills Grid */}
        <motion.div className="space-y-3" variants={staggerContainer}>
          {/* API Status */}
          <motion.div
            variants={staggerItem}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-white/40" />
              <span className="text-white/60 text-sm font-light">Analysis</span>
            </div>
            <motion.div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getPillColor(health.api)} transition-colors duration-300`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {getStatusIndicator(health.api)}
              <span className="text-xs font-semibold capitalize">{health.api}</span>
            </motion.div>
          </motion.div>

          {/* Database Status */}
          <motion.div
            variants={staggerItem}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-white/40" />
              <span className="text-white/60 text-sm font-light">Ledger</span>
            </div>
            <motion.div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getPillColor(health.database)} transition-colors duration-300`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {getStatusIndicator(health.database)}
              <span className="text-xs font-semibold capitalize">{health.database}</span>
            </motion.div>
          </motion.div>

          {/* WebSocket Status */}
          <motion.div
            variants={staggerItem}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-white/40" />
              <span className="text-white/60 text-sm font-light">Streaming</span>
            </div>
            <motion.div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getPillColor(health.websocket)} transition-colors duration-300`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {getStatusIndicator(health.websocket)}
              <span className="text-xs font-semibold capitalize">{health.websocket}</span>
            </motion.div>
          </motion.div>

          {/* Market Status */}
          <motion.div
            variants={staggerItem}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-white/40" />
              <span className="text-white/60 text-sm font-light">Market</span>
            </div>
            <motion.div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getPillColor(health.market)} transition-colors duration-300`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {getStatusIndicator(health.market)}
              <span className="text-xs font-semibold capitalize">{health.market}</span>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </Card>
  );
}

export default SystemStatus;