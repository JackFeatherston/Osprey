import { useState, useEffect, useCallback, useRef } from 'react';
import { api, AccountInfo, OrderHistoryItem, AIStatus, TradeProposal, getAuthToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useTradeProposals() {
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const { user } = useAuth();
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProposals(await api.getProposals());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch proposals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchProposals();
  }, [fetchProposals, user]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const authToken = getAuthToken();
    if (!authToken) return;

    const baseWsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/^http/, 'ws');
    const ws = new WebSocket(`${baseWsUrl}/ws?token=${encodeURIComponent(authToken)}`);
    setConnectionStatus('connecting');

    ws.onopen = () => {
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'trade_proposals') {
        setProposals(prev => [message.data, ...prev]);
      }
    };

    ws.onclose = () => {
      // Delay setting disconnected to avoid flicker during React StrictMode re-mounts.
      disconnectTimeoutRef.current = setTimeout(() => setConnectionStatus('disconnected'), 1000);
    };

    ws.onerror = () => setConnectionStatus('error');

    return () => {
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      ws.close();
    };
  }, [user]);

  const submitDecision = useCallback(async (
    proposalId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string,
  ) => {
    const originalProposal = proposals.find(p => p.id === proposalId);

    try {
      const result = await api.submitDecision({ proposal_id: proposalId, decision, notes });

      setProposals(prev => prev.map(p => (p.id === proposalId ? { ...p, status: decision } : p)));

      if (typeof window !== 'undefined' && originalProposal) {
        window.dispatchEvent(new CustomEvent('trade-decision-submitted', {
          detail: { proposalId, decision, proposal: originalProposal, notes, result },
        }));
      }

      if (result.error) {
        setError(`Decision recorded, but execution failed: ${result.error}`);
      } else if (decision === 'APPROVED' && !result.executed) {
        setError('Decision recorded, but trade execution did not complete');
      } else {
        setError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit decision';
      setError(message);
      throw err;
    }
  }, [proposals]);

  const clearProposals = useCallback(async () => {
    await api.clearProposals();
    await fetchProposals();
  }, [fetchProposals]);

  return { proposals, loading, error, submitDecision, clearProposals, refetch: fetchProposals, connectionStatus };
}

export function useAccountInfo() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAccountInfo()
      .then(setAccount)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to fetch account'))
      .finally(() => setLoading(false));
  }, []);

  return { account, loading, error };
}

export function useAIStatus() {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAIStatus()
      .then(setStatus)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to fetch AI status'))
      .finally(() => setLoading(false));
  }, []);

  return { status, loading, error };
}

export function useRecentActivity() {
  const [activity, setActivity] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setActivity(await api.getOrderHistory());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { activity, loading, error, refetch };
}

export function useDashboard() {
  const proposals = useTradeProposals();
  const account = useAccountInfo();
  const activity = useRecentActivity();
  const ai = useAIStatus();

  return { proposals, account, activity, ai, connectionStatus: proposals.connectionStatus };
}
