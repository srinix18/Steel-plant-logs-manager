import type { PulseEvent } from '../../api/pulse';

function formatEventLabel(event: PulseEvent) {
  const label = event.payload?.label as string | undefined;
  if (label) return label;
  return event.event_type.replace(/_/g, ' ');
}

function severityClass(severity: string) {
  if (severity === 'critical') return 'text-red-600';
  if (severity === 'warning') return 'text-amber-600';
  return 'text-slate-600';
}

export function LiveEventFeed({ events }: { events: PulseEvent[] }) {
  if (!events.length) {
    return <p className="text-sm text-slate-500">No recent events.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-3 py-3">
          <span className={`mt-0.5 text-xs font-semibold uppercase ${severityClass(e.severity)}`}>
            {e.severity.slice(0, 4)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium capitalize text-slate-900">{formatEventLabel(e)}</p>
            <p className="text-xs text-slate-400">{new Date(e.occurred_at).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
