/**
 * WebSocket hook for real-time updates from the trading backend
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface UseWebSocketOptions {
  url?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') + '/ws' || 'ws://localhost:8000/ws',
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptRef = useRef(0);
  const messageHandlersRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptRef.current = 0;
        
        if (onConnect) {
          onConnect();
        }

        // Send ping to establish connection
        ws.send(JSON.stringify({ type: 'ping' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Call the main message handler
          if (onMessage) {
            onMessage(message);
          }

          // Call all registered handlers
          messageHandlersRef.current.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in WebSocket message handler:', error);
            }
          });
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;

        if (onDisconnect) {
          onDisconnect();
        }

        // Auto-reconnect if enabled
        if (autoReconnect && reconnectAttemptRef.current < maxReconnectAttempts) {
          reconnectAttemptRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');

        if (onError) {
          onError(error);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [url, autoReconnect, reconnectInterval, maxReconnectAttempts, onMessage, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        return false;
      }
    }
    return false;
  }, []);

  const addMessageHandler = useCallback((handler: (message: WebSocketMessage) => void) => {
    messageHandlersRef.current.add(handler);
    
    return () => {
      messageHandlersRef.current.delete(handler);
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Keep connection alive with periodic pings
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (isConnected) {
        sendMessage({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds

    return () => {
      clearInterval(pingInterval);
    };
  }, [isConnected, sendMessage]);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    addMessageHandler,
  };
}

// Specialized hook for trading updates
export function useTradingWebSocket() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [tradeActivity, setTradeActivity] = useState<any[]>([]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    console.log('Trading WebSocket message:', message);

    switch (message.type) {
      case 'trade_proposals':
        // New proposal received
        setProposals(prev => {
          const exists = prev.some(p => p.id === message.data.id);
          if (exists) {
            return prev.map(p => p.id === message.data.id ? message.data : p);
          }
          return [message.data, ...prev];
        });
        break;

      case 'proposal_updated':
        // Proposal status updated (approved/rejected)
        setProposals(prev =>
          prev.map(p => p.id === message.data.id ? message.data : p)
        );
        break;

      case 'trade_logs':
        // Trade execution log
        setTradeActivity(prev => [message.data, ...prev.slice(0, 49)]); // Keep last 50 items
        break;

      case 'connection':
        console.log('Trading WebSocket connection established');
        break;

      case 'pong':
        // Connection keep-alive response
        break;

      default:
        console.log('Unknown trading WebSocket message type:', message.type);
    }
  }, []);

  const webSocket = useWebSocket({
    onMessage: handleMessage,
    onConnect: () => {
      console.log('Trading WebSocket connected');
      // Subscribe to trading updates
      webSocket.sendMessage({ type: 'subscribe', channels: ['trade_proposals', 'trade_logs'] });
    },
    onDisconnect: () => {
      console.log('Trading WebSocket disconnected');
    },
    onError: (error) => {
      console.error('Trading WebSocket error:', error);
    },
  });

  return {
    ...webSocket,
    proposals,
    tradeActivity,
    clearProposals: () => setProposals([]),
    clearTradeActivity: () => setTradeActivity([]),
  };
}