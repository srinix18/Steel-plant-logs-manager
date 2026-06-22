import { SupervisorMonitor } from '../operations/SupervisorMonitor';

/** HoD dashboard — backend scopes runs to the HoD's department. */
export function HodDashboardPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Department Overview</h1>
        <p className="mt-1 text-sm text-slate-500">All processes and operations activity in your department.</p>
      </div>
      <SupervisorMonitor />
    </div>
  );
}
