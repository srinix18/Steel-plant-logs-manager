import { useCallback } from 'react';

import { fetchSafetySops } from '@/src/api/safety';
import {
  SafetyListScreen,
  type SafetyListRow,
} from '@/src/features/safety/SafetyListScreen';

/** P3-SAFE-LISTS — SOP Library (GET parity with web). */
export function SafetySopsScreen() {
  const loadRows = useCallback(async (plantId: string): Promise<SafetyListRow[]> => {
    const rows = await fetchSafetySops(plantId);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.version ? `v${r.version}` : undefined,
      badge: r.category,
      badgeTone: 'neutral' as const,
    }));
  }, []);

  return (
    <SafetyListScreen
      title="SOP Library"
      subtitle="Standard operating procedures for this plant."
      emptyTitle="No SOPs"
      emptyDescription="No SOP documents are available for this plant."
      loadRows={loadRows}
    />
  );
}
