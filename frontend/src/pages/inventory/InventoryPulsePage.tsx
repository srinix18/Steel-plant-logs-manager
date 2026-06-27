import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchInventoryPulse, type InventoryItem } from '../../api/inventoryPulse';
import { fetchPlants } from '../../api/platform';
import { StatusBadge } from '../../components/pulse/StatusBadge';
import { Card } from '../../components/ui/Card';

export function InventoryPulsePage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlants()
      .then((p) => (p[0] ? fetchInventoryPulse(p[0].id) : []))
      .then(setItems)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const critical = items.filter((i) => i.status === 'critical').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inventory Pulse</h1>
        <p className="text-sm text-slate-500">Operational raw material levels — {critical} critical item(s)</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.material_code} title={item.material_name}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">{item.material_code}</span>
              <StatusBadge status={item.status} />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {item.quantity.toLocaleString()} <span className="text-sm font-normal">{item.unit}</span>
            </p>
            <dl className="mt-3 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between"><dt>Location</dt><dd>{item.location ?? '—'}</dd></div>
              <div className="flex justify-between"><dt>Days remaining</dt><dd>{item.days_remaining?.toFixed(0) ?? '—'}</dd></div>
              <div className="flex justify-between"><dt>Avg consumption</dt><dd>{item.avg_daily_consumption?.toFixed(1) ?? '—'}/day</dd></div>
              <div className="flex justify-between"><dt>Value</dt><dd>₹{(item.current_value ?? 0).toLocaleString('en-IN')}</dd></div>
              <div className="flex justify-between"><dt>Supplier</dt><dd>{item.supplier ?? '—'}</dd></div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
