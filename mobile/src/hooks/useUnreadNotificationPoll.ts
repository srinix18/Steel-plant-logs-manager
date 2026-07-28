import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { fetchUnreadCount } from '@/src/api/messages';
import { ALERTS_POLL_INTERVAL_MS } from '@/src/notifications/pushPolicy';

/**
 * Polls `GET /notifications/unread-count` while the app is active (P6-PUSH skip path).
 * OS push is not available — badge updates come from this poll + focus refresh.
 */
export function useUnreadNotificationPoll(enabled: boolean): {
  unread: number;
  refresh: () => void;
} {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled) {
      setUnread(0);
      return;
    }
    void fetchUnreadCount()
      .then(setUnread)
      .catch(() => setUnread(0));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setUnread(0);
      return;
    }

    refresh();
    const interval = setInterval(refresh, ALERTS_POLL_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled, refresh]);

  return { unread, refresh };
}
