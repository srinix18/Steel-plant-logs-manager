import { useCallback } from 'react';

import { fetchSafetyInspections } from '@/src/api/safety';
import {
  SafetyListScreen,
  type SafetyListRow,
} from '@/src/features/safety/SafetyListScreen';

/** P3-SAFE-LISTS — Inspections (GET parity with web). */
export function SafetyInspectionsScreen() {
  const loadRows = useCallback(async (plantId: string): Promise<SafetyListRow[]> => {
    const rows = await fetchSafetyInspections(plantId);
    return rows.map((r) => ({
      id: r.id,
      title: r.inspection_type,
      subtitle: r.inspected_at ? new Date(r.inspected_at).toLocaleString() : undefined,
      badge: r.status?.replace(/_/g, ' '),
      badgeTone: 'brand' as const,
    }));
  }, []);

  return (
    <SafetyListScreen
      title="Inspections"
      subtitle="Plant safety inspections in your scope."
      emptyTitle="No inspections"
      emptyDescription="No inspection records for this plant yet."
      loadRows={loadRows}
    />
  );
}
