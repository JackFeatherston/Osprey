import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
}

/**
 * Minimal WebSocket hook with auth-aware automatic reconnection.
 * Fixes: reactive state, auth awareness, proper cleanup, connection guards.
 */
export function useWebSocket(
  url: string,
  onMessage: (message: WebSocketMessage) => void,
  enabled: boolean = true
) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onMessage);
  const enabledRef = useRef(enabled);

  // Keep refs up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const cleanup = useCallback(() => {
    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;

      // Remove event handlers to prevent reconnection after intentional close
      ws.onclose = null;
      ws.close();
    }

    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    // Don't connect if disabled or already connecting/connected
    if (!enabledRef.current) {
      console.log('[WebSocket] Connection disabled');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING ||
        wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connecting/connected');
      return;
    }

    console.log('[WebSocket] Connecting...');

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        onMessageRef.current(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected (code:', event.code, ')');
      setIsConnected(false);
      wsRef.current = null;

      // Only auto-reconnect if still enabled (check ref, not closure)
      if (enabledRef.current) {
        console.log('[WebSocket] Reconnecting in 3s...');
        reconnectTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current) { // Double-check before reconnecting
            connect();
          }
        }, 3000);
      } else {
        console.log('[WebSocket] Auto-reconnect disabled');
      }
    };

    wsRef.current = ws;
  }, [url]);

  // Main effect: connect when enabled, cleanup when disabled or unmounted
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      cleanup();
    }

    return () => {
      console.log('[WebSocket] Component unmounting, cleaning up...');
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  return isConnected;
}
