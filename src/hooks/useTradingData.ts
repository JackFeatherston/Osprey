/**
 * React hooks for managing trading data and real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, TradeProposal, DashboardStats, RecentActivity, AccountInfo, AIStatus } from '@/lib/api';
import { useTradingWebSocket } from './useWebSocket';

// Hook for dashboard statistics
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// Hook for trade proposals with real-time updates
export function useTradeProposals() {
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // WebSocket for real-time updates
  const webSocket = useTradingWebSocket();

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProposals();
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch proposals');
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Merge real-time proposals with fetched proposals
  useEffect(() => {
    if (webSocket.proposals.length > 0) {
      setProposals(current => {
        const merged = [...current];
        
        webSocket.proposals.forEach(wsProposal => {
          const existingIndex = merged.findIndex(p => p.id === wsProposal.id);
          if (existingIndex >= 0) {
            // Update existing proposal
            merged[existingIndex] = wsProposal;
          } else {
            // Add new proposal
            merged.unshift(wsProposal);
          }
        });
        
        return merged;
      });
    }
  }, [webSocket.proposals]);

  const submitDecision = useCallback(async (proposalId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) => {
    try {
      setError(null);
      const result = await api.submitDecision({
        proposal_id: proposalId,
        decision,
        notes,
      });
      
      // Refresh proposals after decision
      await fetchProposals();
      
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit decision';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [fetchProposals]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return { 
    proposals, 
    loading, 
    error, 
    refetch: fetchProposals,
    submitDecision,
    webSocket: {
      isConnected: webSocket.isConnected,
      connectionStatus: webSocket.connectionStatus
    }
  };
}

// Hook for recent activity
export function useRecentActivity(limit: number = 10) {
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getRecentActivity(limit);
      setActivity(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recent activity');
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { activity, loading, error, refetch: fetchActivity };
}

// Hook for account information
export function useAccountInfo() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAccountInfo();
      setAccount(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch account info');
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  return { account, loading, error, refetch: fetchAccount };
}

// Hook for AI status and control
export function useAIStatus() {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAIStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AI status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const startAI = useCallback(async () => {
    try {
      setError(null);
      await api.startAI();
      await fetchStatus(); // Refresh status after starting
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start AI';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [fetchStatus]);

  const stopAI = useCallback(async () => {
    try {
      setError(null);
      await api.stopAI();
      await fetchStatus(); // Refresh status after stopping
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to stop AI';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { 
    status, 
    loading, 
    error, 
    refetch: fetchStatus,
    startAI,
    stopAI,
  };
}

// Hook for real-time updates via WebSocket with polling fallback
export function useRealTimeUpdates(interval: number = 30000) { // 30 seconds fallback
  const webSocket = useTradingWebSocket();
  const [fallbackConnected, setFallbackConnected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const callbacksRef = useRef<Set<() => void>>(new Set());

  const addCallback = useCallback((callback: () => void) => {
    callbacksRef.current.add(callback);
  }, []);

  const removeCallback = useCallback((callback: () => void) => {
    callbacksRef.current.delete(callback);
  }, []);

  const triggerUpdates = useCallback(() => {
    callbacksRef.current.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in real-time update callback:', error);
      }
    });
  }, []);

  // Use WebSocket when available, fallback to polling
  const isConnected = webSocket.isConnected || fallbackConnected;

  // WebSocket message handler to trigger callbacks
  useEffect(() => {
    const removeHandler = webSocket.addMessageHandler((message) => {
      // Trigger callbacks for relevant message types
      if (['trade_proposals', 'trade_logs', 'proposal_updated'].includes(message.type)) {
        triggerUpdates();
      }
    });

    return removeHandler;
  }, [webSocket, triggerUpdates]);

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (!webSocket.isConnected) {
      // Start polling fallback
      setFallbackConnected(true);
      intervalRef.current = setInterval(triggerUpdates, interval);
    } else {
      // Stop polling when WebSocket is active
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      setFallbackConnected(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [webSocket.isConnected, interval, triggerUpdates]);

  const start = useCallback(() => {
    // WebSocket auto-starts, just ensure fallback can work if needed
    if (!webSocket.isConnected && !intervalRef.current) {
      setFallbackConnected(true);
      intervalRef.current = setInterval(triggerUpdates, interval);
    }
  }, [webSocket.isConnected, interval, triggerUpdates]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    setFallbackConnected(false);
    webSocket.disconnect();
  }, [webSocket]);

  return {
    isConnected,
    connectionType: webSocket.isConnected ? 'websocket' : fallbackConnected ? 'polling' : 'disconnected',
    addCallback,
    removeCallback,
    start,
    stop,
  };
}

// Combined hook for dashboard page
export function useDashboard() {
  const statsHook = useDashboardStats();
  const proposalsHook = useTradeProposals();
  const activityHook = useRecentActivity(10);
  const accountHook = useAccountInfo();
  const aiHook = useAIStatus();
  const realTimeHook = useRealTimeUpdates();

  // Set up real-time updates
  useEffect(() => {
    const refreshAll = () => {
      statsHook.refetch();
      proposalsHook.refetch();
      activityHook.refetch();
      accountHook.refetch();
      aiHook.refetch();
    };

    realTimeHook.addCallback(refreshAll);

    return () => {
      realTimeHook.removeCallback(refreshAll);
    };
  }, [statsHook, proposalsHook, activityHook, accountHook, aiHook, realTimeHook]);

  return {
    stats: statsHook,
    proposals: proposalsHook,
    activity: activityHook,
    account: accountHook,
    ai: aiHook,
    realTime: realTimeHook,
  };
}