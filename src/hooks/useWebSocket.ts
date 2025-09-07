import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket(url?: string) {
  const wsUrl = useMemo(() => {
    return url || `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace('http', 'ws')}/ws`;
  }, [url]);
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef<((message: WebSocketMessage) => void) | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = async () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      
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
      
      ws.send(JSON.stringify({ type: 'ping' }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Log important system messages
        if (['connection', 'auth_success', 'auth_error'].includes(message.type)) {
          console.log('WebSocket system message:', message);
        }
        
        setLastMessage(message);
        onMessageRef.current?.(message);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;
      
      if (!isManualCloseRef.current && event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
        console.log(`WebSocket will reconnect in ${delay/1000} seconds... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error('WebSocket max reconnection attempts reached');
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsRef.current = ws;
  }, [wsUrl]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const setOnMessage = useCallback((handler: (message: WebSocketMessage) => void) => {
    onMessageRef.current = handler;
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    isManualCloseRef.current = false;
    wsRef.current?.close();
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      isManualCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    setOnMessage,
    reconnect,
  };
}