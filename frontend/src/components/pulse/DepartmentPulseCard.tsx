import { Link } from 'react-router-dom';
import type { DepartmentPulseCard } from '../../api/pulse';
import { StatusBadge, statusBorderClass } from './StatusBadge';

export function DepartmentPulseCardView({ dept }: { dept: DepartmentPulseCard }) {
  return (
    <Link
      to={`/pulse/department?dept=${dept.department_id}`}
      className={`block rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm transition hover:shadow-md ${statusBorderClass(dept.status)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{dept.department_name}</h3>
          <p className="text-xs text-slate-500">{dept.department_code}</p>
        </div>
        <StatusBadge status={dept.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-400">Shift</dt>
          <dd className="font-medium text-slate-800">{dept.current_shift_code ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Run</dt>
          <dd className="font-medium text-slate-800 truncate">{dept.current_run_label ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Production</dt>
          <dd className="font-medium text-slate-800">
            {dept.production != null ? `${dept.production.toFixed(1)} t` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">OEE</dt>
          <dd className="font-medium text-slate-800">
            {dept.oee != null ? `${(dept.oee * 100).toFixed(0)}%` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Power</dt>
          <dd className="font-medium text-slate-800">
            {dept.power_kwh != null ? `${dept.power_kwh.toFixed(0)} kWh` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Health</dt>
          <dd className="font-medium text-slate-800">
            {dept.health_score != null ? `${dept.health_score.toFixed(0)}%` : '—'}
          </dd>
        </div>
      </dl>
      {(dept.open_issues > 0 || dept.maintenance_alerts > 0) && (
        <p className="mt-2 text-xs text-amber-700">
          {dept.open_issues} issue(s) · {dept.maintenance_alerts} maint alert(s)
        </p>
      )}
    </Link>
  );
}
