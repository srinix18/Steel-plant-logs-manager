import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="shrink-0 bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      You are offline. Changes may not save until connection returns.
    </div>
  );
}
