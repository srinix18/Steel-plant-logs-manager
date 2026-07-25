import type { ProcessRun } from '@/src/types/processRun';

export type RunProcessMeta = {
  processCode?: string;
  processName?: string;
  instanceName?: string;
};

/** Client-side Process code + State filters (web SupervisorMonitor parity). */
export function filterSupervisorRuns(
  runs: ProcessRun[],
  opts: {
    processFilter: string;
    stateFilter: string;
    metaFor: (run: ProcessRun) => RunProcessMeta;
  }
): ProcessRun[] {
  return runs.filter((run) => {
    const meta = opts.metaFor(run);
    if (opts.processFilter && meta.processCode !== opts.processFilter) return false;
    if (opts.stateFilter && run.current_state !== opts.stateFilter) return false;
    return true;
  });
}

export function canSubmitMaintenanceIssue(opts: {
  plantId: string;
  title: string;
  description: string;
}): boolean {
  return Boolean(opts.plantId && opts.title.trim() && opts.description.trim());
}

export function uniqueRunStates(runs: ProcessRun[]): string[] {
  return [...new Set(runs.map((r) => r.current_state))].sort();
}
