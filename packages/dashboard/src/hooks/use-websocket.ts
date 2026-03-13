'use client';

import { useEffect, useRef } from 'react';
import { useSymphonyStore } from '../stores/symphony-store';
import type { WsMessage } from '@symphony/shared';

const WS_URL =
  typeof window !== 'undefined' ? `ws://${window.location.hostname}:${window.location.port}/ws` : '';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyEvent = useSymphonyStore((s) => s.applyEvent);
  const setConnectionStatus = useSymphonyStore((s) => s.setConnectionStatus);

  useEffect(() => {
    let attempt = 0;

    function connect() {
      setConnectionStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string) as WsMessage;
        applyEvent(data);
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        attempt++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [applyEvent, setConnectionStatus]);
}
