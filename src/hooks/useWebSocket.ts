import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export interface WebSocketMessage {
  type: string;
  data: any;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useWebSocket(url?: string) {
  const wsUrl = useMemo(() => {
    return url || `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace('http', 'ws')}/ws`;
  }, [url]);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef<((message: WebSocketMessage) => void) | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isManualCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const lastPongRef = useRef<number>(0);
  const connectionAttemptsRef = useRef(0);
  
  const maxReconnectAttempts = 10;
  const heartbeatInterval = 30000; // 30 seconds
  const heartbeatTimeout = 10000; // 10 seconds to wait for pong
  const maxConnectionAttempts = 3;

  const cleanupTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    cleanupTimers();
    
    const sendPing = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingTime = Date.now();
        wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: pingTime }));
        
        // Set timeout for pong response
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn('WebSocket heartbeat timeout - no pong received');
          wsRef.current?.close(1000, 'Heartbeat timeout');
        }, heartbeatTimeout);
      }
    };

    // Send initial ping
    sendPing();
    
    // Schedule regular pings
    heartbeatIntervalRef.current = setInterval(sendPing, heartbeatInterval);
  }, [heartbeatInterval, heartbeatTimeout, cleanupTimers]);

  const connect = useCallback(() => {
    // Prevent multiple connection attempts
    if (wsRef.current?.readyState === WebSocket.CONNECTING || 
        wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    if (connectionAttemptsRef.current >= maxConnectionAttempts) {
      console.warn('Max concurrent connection attempts reached');
      return;
    }

    connectionAttemptsRef.current++;
    setConnectionState('connecting');
    cleanupTimers();
    
    const ws = new WebSocket(wsUrl);
    
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.error('WebSocket connection timeout');
        ws.close();
      }
    }, 10000);
    
    ws.onopen = async () => {
      clearTimeout(connectionTimeout);
      connectionAttemptsRef.current = 0;
      console.log('WebSocket connected');
      setConnectionState('connected');
      reconnectAttemptsRef.current = 0;
      lastPongRef.current = Date.now();
      
      // Send auth token if available
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          ws.send(JSON.stringify({ 
            type: 'auth', 
            token: session.access_token 
          }));
        }
      } catch (error) {
        console.error('Failed to get session for WebSocket auth:', error);
      }
      
      // Subscribe to channels
      ws.send(JSON.stringify({ type: 'subscribe' }));
      
      // Start heartbeat
      startHeartbeat();
    };
    
    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Handle pong responses
        if (message.type === 'pong') {
          lastPongRef.current = Date.now();
          if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = null;
          }
          return;
        }
        
        // Log important system messages
        if (['connection', 'auth_success', 'auth_error', 'subscription'].includes(message.type)) {
          console.log('WebSocket system message:', message);
        }
        
        setLastMessage(message);
        onMessageRef.current?.(message);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };
    
    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      connectionAttemptsRef.current = Math.max(0, connectionAttemptsRef.current - 1);
      console.log('WebSocket disconnected', event.code, event.reason);
      setConnectionState('disconnected');
      cleanupTimers();
      wsRef.current = null;
      
      // Handle different close codes
      if (event.code === 1000) {
        // Normal closure - don't reconnect if manual
        if (isManualCloseRef.current) return;
      }
      
      // Reconnect logic
      if (!isManualCloseRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const baseDelay = 1000;
        const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
        const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttemptsRef.current - 1) + jitter, 30000);
        
        console.log(`WebSocket will reconnect in ${Math.round(delay/1000)} seconds... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isManualCloseRef.current) {
            connect();
          }
        }, delay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error('WebSocket max reconnection attempts reached');
        setConnectionState('error');
      }
    };
    
    ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      connectionAttemptsRef.current = Math.max(0, connectionAttemptsRef.current - 1);
      console.error('WebSocket error:', error);
      setConnectionState('error');
    };
    
    wsRef.current = ws;
  }, [wsUrl, maxReconnectAttempts, maxConnectionAttempts, startHeartbeat, cleanupTimers]);

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

  const setOnMessage = useCallback((handler: (message: WebSocketMessage) => void) => {
    onMessageRef.current = handler;
  }, []);

  const reconnect = useCallback(() => {
    console.log('Manual reconnect triggered');
    reconnectAttemptsRef.current = 0;
    isManualCloseRef.current = false;
    cleanupTimers();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual reconnect');
    } else {
      connect();
    }
  }, [connect, cleanupTimers]);

  const disconnect = useCallback(() => {
    console.log('Manual disconnect triggered');
    isManualCloseRef.current = true;
    cleanupTimers();
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
    }
  }, [cleanupTimers]);

  // Auto-connect on mount and auth changes
  useEffect(() => {
    isManualCloseRef.current = false;
    connect();
    
    return () => {
      isManualCloseRef.current = true;
      cleanupTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, [connect, cleanupTimers]);

  // Monitor auth state changes and reconnect if needed
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && connectionState === 'disconnected') {
        console.log('Auth state changed to signed in - reconnecting WebSocket');
        reconnect();
      } else if (event === 'SIGNED_OUT') {
        console.log('Auth state changed to signed out - disconnecting WebSocket');
        disconnect();
      }
    });

    return () => subscription.unsubscribe();
  }, [connectionState, reconnect, disconnect]);

  return {
    isConnected: connectionState === 'connected',
    connectionState,
    lastMessage,
    sendMessage,
    setOnMessage,
    reconnect,
    disconnect,
  };
}