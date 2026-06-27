const STATUS_STYLES: Record<string, string> = {
  normal: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  healthy: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const key = status.toLowerCase();
  const cls = STATUS_STYLES[key] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {label ?? status}
    </span>
  );
}

export function statusBorderClass(status: string) {
  const key = status.toLowerCase();
  if (key === 'critical') return 'border-l-red-500';
  if (key === 'warning') return 'border-l-amber-500';
  return 'border-l-emerald-500';
}
