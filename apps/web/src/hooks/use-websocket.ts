"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isComponentMounted = true;

    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isComponentMounted) setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const eventType = data.event || '';

            if (eventType.startsWith('session.')) {
              queryClient.invalidateQueries({ queryKey: ['sessions'] });
              queryClient.invalidateQueries({ queryKey: ['session', data.sessionId] });
            }

            if (
              eventType === 'message.received' ||
              eventType === 'message.sent' ||
              eventType === 'message.failed'
            ) {
              queryClient.invalidateQueries({ queryKey: ['chats', data.sessionId] });
              if (data.data?.message?.jid || data.data?.chatId) {
                const chatId = data.data?.message?.jid || data.data?.chatId;
                queryClient.invalidateQueries({ queryKey: ['messages', data.sessionId, chatId] });
              } else {
                queryClient.invalidateQueries({ queryKey: ['messages', data.sessionId] });
              }
            }

            if (eventType === 'contacts.synced') {
              queryClient.invalidateQueries({ queryKey: ['contacts', data.sessionId] });
            }

            if (eventType === 'chats.synced') {
              queryClient.invalidateQueries({ queryKey: ['chats', data.sessionId] });
            }
          } catch (err) {
            console.error('Failed to parse WS payload:', err);
          }
        };

        ws.onclose = () => {
          if (isComponentMounted) {
            setIsConnected(false);
            setTimeout(connect, 3000);
          }
        };

        ws.onerror = (err) => {
          console.error('WebSocket connection error:', err);
          ws.close();
        };
      } catch (err) {
        console.error('WebSocket initialization error:', err);
      }
    }

    connect();

    return () => {
      isComponentMounted = false;
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [queryClient]);

  return { isConnected };
}
