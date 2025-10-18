import { useState, useEffect, useCallback, useRef } from 'react';
import { api, AccountInfo, RecentActivity, DashboardStats, AIStatus } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Core hook for trade proposals - matches CLAUDE.md workflow
export function useTradeProposals() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial proposals from API
  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProposals();
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch proposals');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchProposals();
    }
  }, [fetchProposals, user]);

  // Simple WebSocket connection - only listens for new proposals
  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      console.log('[WebSocket] Skipping connection:', { user: !!user, isWindow: typeof window !== 'undefined' });
      return;
    }

    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/^http/, 'ws') + '/ws';
    console.log('[WebSocket] Attempting to connect to:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] ✓ Connected successfully');
      // Clear any pending disconnect timeout
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[WebSocket] Received message:', message);
        // Only handle new proposal messages
        if (message.type === 'trade_proposals') {
          setProposals(prev => [message.data, ...prev]);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('[WebSocket] ✗ Disconnected', { code: event.code, reason: event.reason });
      // Delay setting disconnected state to avoid flickering during rapid reconnects
      // This is especially helpful in React development mode with Strict Mode
      disconnectTimeoutRef.current = setTimeout(() => {
        setIsConnected(false);
      }, 500); // 500ms delay
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] ✗ Error occurred:', error);
    };

    wsRef.current = ws;

    return () => {
      console.log('[WebSocket] Cleaning up connection');
      // Clear any pending disconnect timeout
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      ws.close();
    };
  }, [user]);

  // Submit approve/reject decision - core workflow function
  const submitDecision = useCallback(async (proposalId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) => {
    try {
      const result = await api.submitDecision({ proposal_id: proposalId, decision, notes });

      // Always update local state since decision was logged
      setProposals(prev =>
        prev.map(p => p.id === proposalId ? { ...p, status: decision } : p)
      );

      // If there was an execution error, notify the user but don't throw
      if (result.error) {
        console.error('Trade execution error:', result.error);
        setError(`Decision recorded, but execution failed: ${result.error}`);
      } else if (decision === 'APPROVED' && !result.executed) {
        setError('Decision recorded, but trade execution did not complete');
      } else {
        // Clear any previous errors on success
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit decision');
      throw err;
    }
  }, []);

  // Clear all pending proposals manually
  const clearProposals = useCallback(async () => {
    try {
      await api.clearProposals();
      // Refetch to update state
      await fetchProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear proposals');
      throw err;
    }
  }, [fetchProposals]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    proposals,
    loading,
    error,
    submitDecision,
    clearProposals,
    clearError,
    refetch: fetchProposals,
    isConnected,
  };
}

// Simple hook for account info
export function useAccountInfo() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAccountInfo()
      .then(setAccount)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch account');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { account, loading, error };
}

// Hook for dashboard stats
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDashboardStats()
      .then(setStats)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch stats');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading, error, refetch: () => {} };
}

// Hook for AI status
export function useAIStatus() {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAIStatus()
      .then(setStatus)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch AI status');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { status, loading, error };
}

// Simple hook for recent activity
export function useRecentActivity(limit?: number) {
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getRecentActivity(limit);
      setActivity(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activity');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { activity, loading, error, refetch: fetch };
}

// Main dashboard hook - combines the essentials
export function useDashboard() {
  const proposals = useTradeProposals();
  const account = useAccountInfo();
  const activity = useRecentActivity();
  const stats = useDashboardStats();
  const ai = useAIStatus();

  return {
    proposals,
    account,
    activity,
    stats,
    ai,
    isConnected: proposals.isConnected,
    connectionState: (proposals.isConnected ? 'connected' : 'disconnected') as 'connected' | 'disconnected' | 'connecting' | 'error',
  };
}
