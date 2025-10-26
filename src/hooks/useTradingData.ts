import { useState, useEffect, useCallback, useRef } from 'react';
import { api, AccountInfo, OrderHistoryItem, DashboardStats, AIStatus, getAuthToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Core hook for trade proposals - matches CLAUDE.md workflow
export function useTradeProposals() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
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

  // Simple WebSocket connection
  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      console.log('[WebSocket] Skipping connection:', { user: !!user, isWindow: typeof window !== 'undefined' });
      return;
    }

    // Get auth token for WebSocket authentication
    const authToken = getAuthToken();
    if (!authToken) {
      console.log('[WebSocket] Skipping connection: no auth token available');
      return;
    }

    const baseWsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/^http/, 'ws');
    const wsUrl = `${baseWsUrl}/ws?token=${encodeURIComponent(authToken)}`;
    console.log('[WebSocket] Attempting to connect to:', baseWsUrl + '/ws');
    setConnectionStatus('connecting');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] ✓ Connected successfully');
      // Clear any pending disconnect timeout
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      setConnectionStatus('connected');
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
        setConnectionStatus('disconnected');
      }, 1000); // 1 second delay for more lenient reconnection detection
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] ✗ Error occurred:', error);
      setConnectionStatus('error');
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
    // Store original proposal for event dispatch
    const originalProposal = proposals.find(p => p.id === proposalId);

    console.log(`[submitDecision] Starting: ${decision} for proposal ${proposalId}`);

    try {
      // Call API FIRST - no optimistic updates
      const result = await api.submitDecision({ proposal_id: proposalId, decision, notes });
      console.log(`[submitDecision] API call succeeded:`, result);

      // Only update local state AFTER successful API response
      setProposals(prev =>
        prev.map(p => p.id === proposalId ? { ...p, status: decision } : p)
      );

      // Dispatch custom event with proposal data for OrderHistory to use
      if (typeof window !== 'undefined' && originalProposal) {
        window.dispatchEvent(new CustomEvent('trade-decision-submitted', {
          detail: {
            proposalId,
            decision,
            proposal: originalProposal,
            notes,
            result
          }
        }));
      }

      // If there was an execution error, notify the user but don't throw
      if (result.error) {
        console.error('Trade execution error:', result.error);
        setError(`Decision recorded, but execution failed: ${result.error}`);
      } else if (decision === 'APPROVED' && !result.executed) {
        const errorMsg = 'Decision recorded, but trade execution did not complete';
        console.warn(errorMsg);
        setError(errorMsg);
      } else {
        // Clear any previous errors on success
        setError(null);
        console.log(`[submitDecision] Success: ${decision} decision processed and trade executed`);
      }
    } catch (err) {
      // No rollback needed since we never updated optimistically
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit decision';
      console.error(`[submitDecision] Failed:`, errorMsg, err);
      setError(errorMsg);
      // Show alert to user since this is a critical failure
      if (typeof window !== 'undefined') {
        alert(`Failed to submit decision: ${errorMsg}\n\nPlease check your connection and try again.`);
      }
      throw err;
    }
  }, [proposals]);

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

  return {
    proposals,
    loading,
    error,
    submitDecision,
    clearProposals,
    refetch: fetchProposals,
    connectionStatus,
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

// Hook for order history (replaces useRecentActivity)
export function useRecentActivity() {
  const [activity, setActivity] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getOrderHistory();
      setActivity(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

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
    connectionStatus: proposals.connectionStatus,
  };
}
