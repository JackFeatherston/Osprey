import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Wifi, Loader2, TrendingUp, Database, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { staggerContainer, staggerItem } from '@/lib/animations';

type ApiStatus = 'online' | 'offline' | 'error';
type WsStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
type MarketStatus = 'open' | 'closed';

interface SystemHealth {
  api: ApiStatus;
  database: ApiStatus;
  websocket: WsStatus;
  market: MarketStatus;
}

interface SystemStatusProps {
  websocketStatus?: WsStatus;
  className?: string;
}

function checkMarketStatus(): MarketStatus {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return 'closed';

  // Simplified ET conversion; doesn't account for DST.
  const etOffsetMinutes = -5 * 60;
  const etTime = new Date(now.getTime() + (now.getTimezoneOffset() + etOffsetMinutes) * 60000);
  const minutes = etTime.getHours() * 60 + etTime.getMinutes();
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60 ? 'open' : 'closed';
}

function getPillColor(status: string) {
  switch (status) {
    case 'online':
    case 'connected':
    case 'open':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'connecting':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'error':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function StatusIndicator({ status }: { status: string }) {
  if (status === 'connecting') return <Loader2 className="w-2 h-2 animate-spin text-yellow-400" />;
  const color =
    status === 'online' || status === 'connected' || status === 'open'
      ? 'bg-green-400 animate-pulse'
      : status === 'error'
      ? 'bg-red-400 animate-pulse'
      : 'bg-gray-400';
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

interface StatusRowProps {
  icon: React.ReactNode;
  label: string;
  status: string;
}

function StatusRow({ icon, label, status }: StatusRowProps) {
  return (
    <motion.div variants={staggerItem} className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-white/60 text-sm font-light">{label}</span>
      </div>
      <motion.div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getPillColor(status)} transition-colors duration-300`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <StatusIndicator status={status} />
        <span className="text-xs font-semibold capitalize">{status}</span>
      </motion.div>
    </motion.div>
  );
}

export function SystemStatus({ websocketStatus, className }: SystemStatusProps) {
  const [health, setHealth] = useState<SystemHealth>({
    api: 'offline',
    database: 'offline',
    websocket: websocketStatus || 'disconnected',
    market: checkMarketStatus(),
  });
  const [lastCheck, setLastCheck] = useState(new Date());

  useEffect(() => {
    if (websocketStatus) {
      setHealth(prev => ({ ...prev, websocket: websocketStatus }));
    }
  }, [websocketStatus]);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        await api.healthCheck();
        if (!cancelled) {
          setHealth(prev => ({ ...prev, api: 'online', database: 'online', market: checkMarketStatus() }));
        }
      } catch {
        if (!cancelled) {
          setHealth(prev => ({ ...prev, api: 'offline', database: 'offline', market: checkMarketStatus() }));
        }
      } finally {
        if (!cancelled) setLastCheck(new Date());
      }
    };

    check();
    const interval = setInterval(check, 120000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Card variant="glass-panel" animated hover className={`h-full ${className ?? ''}`}>
      <motion.div className="p-6" variants={staggerContainer} initial="hidden" animate="visible">
        <motion.div className="flex items-center justify-between mb-6" variants={staggerItem}>
          <h3 className="text-xl font-light tracking-wider text-neutral-100">Osprey Status</h3>
          <span className="text-xs text-white/40 font-light">
            {lastCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </motion.div>

        <motion.div className="space-y-3" variants={staggerContainer}>
          <StatusRow icon={<Zap className="h-4 w-4 text-white/40" />} label="Analysis" status={health.api} />
          <StatusRow icon={<Database className="h-4 w-4 text-white/40" />} label="Ledger" status={health.database} />
          <StatusRow icon={<Wifi className="h-4 w-4 text-white/40" />} label="Trade Streaming" status={health.websocket} />
          <StatusRow icon={<TrendingUp className="h-4 w-4 text-white/40" />} label="Market Hours" status={health.market} />
        </motion.div>
      </motion.div>
    </Card>
  );
}

export default SystemStatus;
