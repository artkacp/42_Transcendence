// src/socket/SocketContext.ts
// What pages use: the hooks below. SocketProvider.tsx owns the socket and fills the boxes.
// Kept apart from SocketProvider.tsx so fast refresh lint stays quiet
// (a .tsx file should export only components).
import { createContext, useContext, useEffect, useRef } from 'react';
import type { ClientFrame, FrameOf, ServerFrame, ServerFrameType } from './frames';

// 'connecting' = signed in, opening / signing in / waiting to retry
// 'ready'      = auth.ok received, frames flow both ways
// 'closed'     = signed out, or gave up after the session could not be refreshed
export type SocketStatus = 'connecting' | 'ready' | 'closed';

// Never changes while the app runs, so reading it does not re-render anything
export type SocketApi = {
  send: (frame: ClientFrame) => boolean;
  listen: (type: ServerFrameType, handler: (frame: ServerFrame) => void) => () => void;
  onReconnect: (fn: () => void) => () => void;
  watchPet: (petId: string) => () => void;
};

export const SocketContext = createContext<SocketApi | null>(null);
// Separate box: a status change re-renders only components that read the status
export const SocketStatusContext = createContext<SocketStatus>('closed');

function useSocketApi(): SocketApi {
  const value = useContext(SocketContext);
  if (!value) throw new Error('Socket hooks must be used inside <SocketProvider>');
  return value;
}

// Calls `handler` for every frame of this type while the component is on screen.
// The handler sits in a ref, so a new function on each render does not resubscribe.
export function useSocketFrame<T extends ServerFrameType>(
  type: T,
  handler: (frame: FrameOf<T>) => void,
): void {
  const { listen } = useSocketApi();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  // listen() hands back its own "stop listening", which React runs on unmount
  useEffect(() => listen(type, (frame) => handlerRef.current(frame as FrameOf<T>)), [listen, type]);
}

export function useSocketStatus(): SocketStatus {
  return useContext(SocketStatusContext);
}

// send(frame) → false when the socket is not ready: fall back to REST (e.g. chat)
export function useSocketSend(): (frame: ClientFrame) => boolean {
  return useSocketApi().send;
}

// Live pet.adopted / pet.removed for one pet page. null = nothing to follow yet.
// Followed again automatically after every reconnect.
export function usePetSubscription(petId: string | null): void {
  const { watchPet } = useSocketApi();
  useEffect(() => (petId ? watchPet(petId) : undefined), [watchPet, petId]);
}

// Called when the socket is back after a lost connection (not on the first connect):
// frames sent meanwhile were missed, so refetch.
export function useSocketReconnect(fn: () => void): void {
  const { onReconnect } = useSocketApi();
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => onReconnect(() => fnRef.current()), [onReconnect]);
}
