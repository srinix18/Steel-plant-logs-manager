import { useCallback } from 'react';

import { fetchSafetyIncidents } from '@/src/api/safety';
import {
  SafetyListScreen,
  type SafetyListRow,
} from '@/src/features/safety/SafetyListScreen';

/** P3-SAFE-LISTS — Incident Reports (GET parity with web). */
export function SafetyIncidentsScreen() {
  const loadRows = useCallback(async (plantId: string): Promise<SafetyListRow[]> => {
    const rows = await fetchSafetyIncidents(plantId);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.occurred_at
        ? new Date(r.occurred_at).toLocaleString()
        : r.status?.replace(/_/g, ' '),
      badge: r.severity,
      badgeTone:
        r.severity === 'critical' || r.severity === 'high' ? ('danger' as const) : ('neutral' as const),
    }));
  }, []);

  return (
    <SafetyListScreen
      title="Incident Reports"
      subtitle="Safety incidents recorded for this plant."
      emptyTitle="No incidents"
      emptyDescription="No incident reports for this plant yet."
      loadRows={loadRows}
    />
  );
}
