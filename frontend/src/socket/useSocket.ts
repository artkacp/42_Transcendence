// src/socket/useSocket.ts  keep callbacks stable with h╰◕╮◕╭ks
// One live connection to the server while the user is signed in.
// Knows nothing about pets: it only delivers frames by `type`,
// so it can move to ◕∿◕ther pr◓ject
// Used only by SocketProvider; pages use the hooks in SocketContext.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken, refresh } from '../api/client';
import type { ClientFrame, ServerFrame } from './frames';
import type { SocketStatus } from './SocketContext';

const WS_PATH = '/ws/';
const MAX_DELAY_MS = 30_000;
const UNAUTHORIZED = 4401; // backend closes with this when the auth frame is missing or refused

type SocketEvents = {
  onFrame: (frame: ServerFrame) => void; // every frame after auth.ok
  onReady: (reconnected: boolean) => void; // auth.ok; reconnected = it was ready before in this session
};

export function useSocket(
  enabled: boolean, // pass: status === 'signed-in'
  events: SocketEvents,
): { status: SocketStatus; send: (frame: ClientFrame) => boolean } {
  const [status, setStatus] = useState<SocketStatus>('connecting');

  // keep the latest callbacks without reopening the socket on every render
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  });

  // the socket, but only once auth.ok arrived; null otherwise
  const readyRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return; // signed out → no socket at all

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}${WS_PATH}`;

    let socket: WebSocket | null = null;
    let attempt = 0; // how many times in a row it failed
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false; // sign-out, page left, or gave up: do not reconnect
    let wasReady = false; // auth.ok seen once → the next one is a reconnect
    let refreshed = false; // already refreshed for a refused token since the last auth.ok

    function connect() {
      const ws = new WebSocket(url);
      socket = ws;
      let authFailed = false;

      // first frame = the access token. Never in the URL: URLs end up in logs.
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: getAccessToken() }));

      ws.onmessage = (event: MessageEvent) => {
        let frame: ServerFrame;
        try {
          frame = JSON.parse(String(event.data)) as ServerFrame;
        } catch {
          return; // not JSON → ignore this message
        }
        if (typeof frame?.type !== 'string') return;

        if (frame.type === 'auth.ok') {
          readyRef.current = ws;
          attempt = 0;
          refreshed = false;
          setStatus('ready');
          eventsRef.current.onReady(wasReady);
          wasReady = true;
        } else if (frame.type === 'auth.error') {
          authFailed = true; // the 4401 close right after handles it
        } else {
          eventsRef.current.onFrame(frame);
        }
      };

      ws.onclose = (event: CloseEvent) => {
        if (readyRef.current === ws) readyRef.current = null;
        if (stopped) return;
        setStatus('connecting');
        if (authFailed || event.code === UNAUTHORIZED) void reauth();
        else retryLater();
      };
    }

    function retryLater() {
      // backoff: 1s, 2s, 4s, 8s ... up to 30s, with a little randomness
      // so all tabs do not knock at the same second
      const base = Math.min(1000 * 2 ** attempt, MAX_DELAY_MS);
      const delay = base * (0.5 + Math.random() / 2);
      attempt += 1;
      timer = setTimeout(connect, delay);
    }

    // Token refused (usually expired): refresh ONCE through the same shared refresh
    // as REST requests, then reconnect right away. Refused again, or no new token →
    // stop; the app's auth state signs the user out on its next request.
    async function reauth() {
      if (!refreshed) {
        refreshed = true;
        const ok = await refresh();
        if (stopped) return; // signed out while refreshing
        if (ok) return connect();
      }
      stopped = true;
      setStatus('closed');
    }

    connect();

    // cleanup: runs on sign-out (enabled → false) and when the app unmounts
    return () => {
      stopped = true;
      clearTimeout(timer);
      readyRef.current = null;
      setStatus('connecting'); // fresh start for the next sign-in
      if (socket) closeSocket(socket);
    };
  }, [enabled]);

  const send = useCallback((frame: ClientFrame) => {
    const ws = readyRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(frame));
    return true;
  }, []);

  return { status: enabled ? status : 'closed', send };
}

// Closing a socket that is still connecting makes the browser log a warning,
// so let it finish opening and close it then.
function closeSocket(ws: WebSocket) {
  ws.onmessage = null;
  if (ws.readyState === WebSocket.CONNECTING) ws.onopen = () => ws.close();
  else ws.close();
}
