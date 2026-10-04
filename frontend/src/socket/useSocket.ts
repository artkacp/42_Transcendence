// src/socket/useSocket.ts
// One live connection to the server while the user is signed in.
// Knows nothing about pets: it only delivers frames by `type`,
// so it can move to ◕∿◕ther pr◓ject
import { useEffect, useRef } from 'react';

export type Frame = { type: string; [key: string]: unknown };

// TODO: check the path and how the socket is authenticated with Faizan (task B8).
// Same origin → the browser sends cookies with the handshake automatically.
const WS_PATH = '/ws/';
const MAX_DELAY_MS = 30_000;

export function useSocket(
  enabled: boolean, // pass: status === 'signed-in'
  onFrame: (frame: Frame) => void, // called for every message
  onReconnect?: () => void, // called after a lost connection comes back → refetch the view
): void {
  // keep the latest callbacks without reopening the socket on every render
  const onFrameRef = useRef(onFrame);
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => {
    onFrameRef.current = onFrame;
    onReconnectRef.current = onReconnect;
  });

  useEffect(() => {
    if (!enabled) return; // signed out → no socket at all

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}${WS_PATH}`;

    let socket: WebSocket | null = null;
    let attempt = 0; // how many times in a row it failed
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closedByUs = false; // sign-out or page left: do not reconnect

    function connect() {
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (attempt > 0) onReconnectRef.current?.(); // we were offline → catch up
        attempt = 0;
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const frame = JSON.parse(String(event.data)) as Frame;
          if (typeof frame.type === 'string') onFrameRef.current(frame);
        } catch {
          // not JSON → ignore this message
        }
      };

      socket.onclose = () => {
        if (closedByUs) return;
        // backoff: 1s, 2s, 4s, 8s ... up to 30s, with a little randomness
        // so all tabs do not knock at the same second
        const base = Math.min(1000 * 2 ** attempt, MAX_DELAY_MS);
        const delay = base * (0.5 + Math.random() / 2);
        attempt += 1;
        timer = setTimeout(connect, delay);
      };
    }

    connect();

    // cleanup: runs on sign-out (enabled → false) and when the app unmounts
    return () => {
      closedByUs = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [enabled]);
}
