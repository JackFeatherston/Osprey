import { useState, useEffect, useCallback } from 'react';
import { api, AccountInfo, RecentActivity, DashboardStats, AIStatus } from '@/lib/api';
import { useWebSocket } from './useWebSocket';

// Core hook for trade proposals - matches CLAUDE.md workflow
export function useTradeProposals() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const webSocket = useWebSocket();

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

  // Handle incoming WebSocket messages from backend  
  useEffect(() => {
    webSocket.setOnMessage((message) => {
      if (message.type === 'trade_proposals') {
        setProposals(prev => [message.data, ...prev]);
      } else if (message.type === 'proposal_updated') {
        setProposals(prev => 
          prev.map(p => p.id === message.data.id ? message.data : p)
        );
      } else if (message.type === 'trade_logs') {
        // Handle trade execution updates - refresh proposals to show status changes
        fetchProposals();
      }
    });
  }, [webSocket, fetchProposals]);

  // Submit approve/reject decision - core workflow function
  const submitDecision = useCallback(async (proposalId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) => {
    try {
      await api.submitDecision({ proposal_id: proposalId, decision, notes });
      // Update local state optimistically
      setProposals(prev => 
        prev.map(p => p.id === proposalId ? { ...p, status: decision } : p)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit decision');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return {
    proposals,
    loading,
    error,
    submitDecision,
    isConnected: webSocket.isConnected,
    connectionState: webSocket.connectionState,
    refetch: fetchProposals
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
    connectionState: proposals.connectionState
  };
}