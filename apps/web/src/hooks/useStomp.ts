import { useEffect, useRef, useState } from 'react';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { getApiBaseUrl } from '../api/config';
import { getAccessToken } from '../api/tokenStore';

export interface StompOptions {
  url?: string;
  roomId?: string;
  onMessage?: (msg: any) => void;
  onConnect?: () => void;
  onReconnect?: () => void;  // called on 2nd+ successful connect
  onDisconnect?: () => void;
}

export function useStomp({ url = '/ws', roomId, onMessage, onConnect, onReconnect, onDisconnect }: StompOptions) {
  const clientRef = useRef<Client | null>(null);
  const subsRef = useRef<StompSubscription | null>(null);
  // PCV-22: kênh riêng của đội (/user/queue/room/{id}/team).
  const teamSubsRef = useRef<StompSubscription | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const connectedOnceRef = useRef(false);

  // Keep callbacks fresh without recreating the STOMP client
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onReconnectRef = useRef(onReconnect);
  const onDisconnectRef = useRef(onDisconnect);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onConnectRef.current = onConnect; }, [onConnect]);
  useEffect(() => { onReconnectRef.current = onReconnect; }, [onReconnect]);
  useEffect(() => { onDisconnectRef.current = onDisconnect; }, [onDisconnect]);

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    let wsUrl: string;
    if (apiBase.startsWith('http')) {
      try {
        const u = new URL(apiBase);
        u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
        u.pathname = url;
        u.search = '';
        u.hash = '';
        wsUrl = u.toString();
      } catch {
        wsUrl = url;
      }
    } else {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProto}//${window.location.host}${url}`;
    }

    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      connectHeaders: {
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
      },
      // stompjs reuses connectHeaders for every reconnect attempt. The access
      // token lives in memory with a short TTL and is refreshed by the REST
      // 401 interceptor — if the client was created while the token was stale
      // (or null, e.g. right after a hard reload), a frozen header would make
      // every retry fail with the same dead token until the page is reloaded.
      // Re-read the current token before each (re)connect attempt instead.
      beforeConnect: () => {
        client.connectHeaders = { Authorization: `Bearer ${getAccessToken() ?? ''}` };
      },
      onConnect: () => {
        setConnected(true);
        setReconnecting(false);

        const isReconnect = connectedOnceRef.current;
        connectedOnceRef.current = true;

        if (roomId) {
          try { subsRef.current?.unsubscribe(); } catch {}
          subsRef.current = client.subscribe(`/topic/room/${roomId}`, (frame: IMessage) => {
            try {
              const body = JSON.parse(frame.body);
              onMessageRef.current?.(body);
            } catch {}
          });
          // PCV-22: kênh riêng của đội (Hội ý: phiếu đồng đội, chat đội) — cùng bộ xử lý sự kiện.
          try { teamSubsRef.current?.unsubscribe(); } catch {}
          teamSubsRef.current = client.subscribe(`/user/queue/room/${roomId}/team`, (frame: IMessage) => {
            try {
              onMessageRef.current?.(JSON.parse(frame.body));
            } catch {}
          });
        }

        if (isReconnect) {
          onReconnectRef.current?.();
        } else {
          onConnectRef.current?.();
        }
      },
      onStompError: () => {},
      onWebSocketClose: () => {
        setConnected(false);
        // Drop the stale subscription handle — its underlying WS is gone, so
        // calling .unsubscribe() on it later would log "WebSocket is already
        // in CLOSING or CLOSED state". On reconnect, onConnect creates a
        // fresh subscription on the new WS.
        subsRef.current = null;
        teamSubsRef.current = null;
        if (connectedOnceRef.current) setReconnecting(true);
        onDisconnectRef.current?.();
      },
    });

    clientRef.current = client;
    client.activate();

    return () => {
      try { subsRef.current?.unsubscribe(); } catch {}
      try { teamSubsRef.current?.unsubscribe(); } catch {}
      client.deactivate();
      clientRef.current = null;
      connectedOnceRef.current = false;
    };
  }, [url, roomId]);

  /**
   * Returns true if the frame was handed to the STOMP client (i.e. WS is
   * connected). Returns false when the WS is reconnecting / closed so the
   * caller can surface feedback (e.g. revert optimistic UI, show toast)
   * instead of swallowing the click.
   */
  const send = (destination: string, payload: any): boolean => {
    if (!clientRef.current || !connected) return false;
    clientRef.current.publish({
      destination,
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    });
    return true;
  };

  return { connected, reconnecting, send };
}
