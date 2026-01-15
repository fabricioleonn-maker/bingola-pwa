import { useEffect, useRef } from 'react';
import { useRoomStore } from './roomStore';

export function useRoomSession(roomId: string | null) {
  const bootstrap = useRoomStore((s) => s.bootstrap);
  const subscribe = useRoomStore((s) => s.subscribe);
  const setRoomId = useRoomStore((s) => s.setRoomId);

  // controla execuções concorrentes (evita subscribe duplicado / StrictMode)
  const runTokenRef = useRef(0);

  useEffect(() => {
    if (!roomId) return;

    runTokenRef.current += 1;
    const myToken = runTokenRef.current;

    let cleanup: null | (() => void) = null;
    let cancelled = false;

    (async () => {
      try {
        await bootstrap(roomId);

        // se já foi cancelado (ou chegou uma execução mais nova), não assina
        if (cancelled || runTokenRef.current !== myToken) return;

        const maybeCleanup = subscribe(roomId);

        // se cancelou logo após assinar, limpa imediatamente
        if (cancelled || runTokenRef.current !== myToken) {
          maybeCleanup?.();
          return;
        }

        cleanup = maybeCleanup;
      } catch (e) {
        // não quebra o app por erro de sessão
        console.error('[useRoomSession] failed:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [roomId, bootstrap, subscribe, setRoomId]);
}
