import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  enqueueDraftSave,
  flushDraftQueue,
  loadDraftQueue,
  subscribeDraftQueue,
  type FlushResult,
} from '@/src/offline/draftQueue';
import type { ProcessRunPatchPayload } from '@/src/offline/types';

type NetworkContextValue = {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  lastFlush: FlushResult | null;
  enqueue: (runId: string, payload: ProcessRunPatchPayload, lastError?: string) => Promise<void>;
  retrySync: () => Promise<FlushResult>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

function isReachable(state: { isConnected: boolean | null; isInternetReachable: boolean | null }) {
  // isInternetReachable can be null while probing — treat connected as online.
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastFlush, setLastFlush] = useState<FlushResult | null>(null);
  const prevOnlineRef = useRef<boolean | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    void loadDraftQueue().then((q) => setPendingCount(q.length));
    return subscribeDraftQueue((q) => setPendingCount(q.length));
  }, []);

  const retrySync = useCallback(async () => {
    if (syncingRef.current) {
      return { flushed: 0, failed: 0, remaining: await loadDraftQueue() };
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await flushDraftQueue();
      setLastFlush(result);
      return result;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = isReachable(state);
      const wasOnline = prevOnlineRef.current;
      prevOnlineRef.current = online;
      setIsOnline(online);
      // Flush once when connectivity returns (not on every pendingCount tick).
      if (wasOnline === false && online) {
        void retrySync();
      }
    });
    void NetInfo.fetch().then((state) => {
      const online = isReachable(state);
      prevOnlineRef.current = online;
      setIsOnline(online);
      if (online) {
        void loadDraftQueue().then((q) => {
          if (q.length > 0) void retrySync();
        });
      }
    });
    return () => unsub();
  }, [retrySync]);

  const enqueue = useCallback(
    async (runId: string, payload: ProcessRunPatchPayload, lastError?: string) => {
      await enqueueDraftSave(runId, payload, lastError);
    },
    []
  );

  const value = useMemo(
    () => ({
      isOnline,
      pendingCount,
      syncing,
      lastFlush,
      enqueue,
      retrySync,
    }),
    [enqueue, isOnline, lastFlush, pendingCount, retrySync, syncing]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return ctx;
}

/** Safe for screens that may render outside provider (tests). */
export function useNetworkOptional(): NetworkContextValue | null {
  return useContext(NetworkContext);
}
