import { useEffect, useRef } from 'react';

/** Keep the screen awake while `active` (e.g. open process run on phone). */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        /* unsupported / denied */
      }
    };

    void request();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active) void request();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinelRef.current?.release();
      sentinelRef.current = null;
    };
  }, [active]);
}
