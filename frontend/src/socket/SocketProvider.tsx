// Wraps the app inside AuthProvider: one socket per tab while signed in, shared by every page.
// Pages never touch the socket; they register handlers through the hooks in SocketContext.ts.
import { useMemo, useRef, type ReactNode } from 'react';
import { useAuth } from '../auth/auth-context';
import type { ServerFrame } from './frames';
import { SocketContext, SocketStatusContext, type SocketApi } from './SocketContext';
import { useSocket } from './useSocket';

type Listener = (frame: ServerFrame) => void;

export function SocketProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();

  const listeners = useRef(new Map<string, Set<Listener>>()); // frame type → handlers
  const reconnectListeners = useRef(new Set<() => void>());
  // pet id → how many components follow it. Counted, because the server's
  // pet.unsubscribe is not: one page leaving must not cut off another.
  const pets = useRef(new Map<string, number>());

  const { status, send } = useSocket(authStatus === 'signed-in', {
    // a type nobody listens to (or an unknown one) just finds no handlers
    onFrame: (frame) => listeners.current.get(frame.type)?.forEach((fn) => fn(frame)),
    onReady: (reconnected) => {
      // the server forgets pet.<id> groups on disconnect → follow them again
      for (const petId of pets.current.keys()) send({ type: 'pet.subscribe', pet_id: petId });
      if (reconnected) reconnectListeners.current.forEach((fn) => fn());
    },
  });

  const api = useMemo<SocketApi>(
    () => ({
      send,
      listen(type, handler) {
        const handlers = listeners.current.get(type) ?? new Set<Listener>();
        listeners.current.set(type, handlers);
        handlers.add(handler);
        return () => {
          handlers.delete(handler);
        };
      },
      onReconnect(fn) {
        reconnectListeners.current.add(fn);
        return () => {
          reconnectListeners.current.delete(fn);
        };
      },
      watchPet(petId) {
        const count = pets.current.get(petId) ?? 0;
        pets.current.set(petId, count + 1);
        // not ready yet → send() says false; onReady sends it after auth.ok
        if (count === 0) send({ type: 'pet.subscribe', pet_id: petId });
        return () => {
          const left = (pets.current.get(petId) ?? 1) - 1;
          if (left > 0) {
            pets.current.set(petId, left);
            return;
          }
          pets.current.delete(petId);
          send({ type: 'pet.unsubscribe', pet_id: petId });
        };
      },
    }),
    [send],
  );

  return (
    <SocketContext value={api}>
      <SocketStatusContext value={status}>{children}</SocketStatusContext>
    </SocketContext>
  );
}
