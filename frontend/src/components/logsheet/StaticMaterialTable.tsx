import type { MaterialRow, StaticMaterialConfig, StaticMaterialSectionData, TemplateSection } from '../../types';

export function buildStaticMaterialSection(config: StaticMaterialConfig[]): StaticMaterialSectionData {
  return {
    rows: config.map((m) => ({ material: m.code, quantity_kg: null })),
  };
}

export function parseStaticMaterialSection(raw: unknown, config: StaticMaterialConfig[]): StaticMaterialSectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as StaticMaterialSectionData).rows)) {
    const parsed = raw as StaticMaterialSectionData;
    const byCode = Object.fromEntries(parsed.rows.map((r) => [r.material, r]));
    return {
      rows: config.map((m) => byCode[m.code] ?? { material: m.code, quantity_kg: null }),
    };
  }
  return buildStaticMaterialSection(config);
}

export function getStaticMaterialConfig(section: TemplateSection): StaticMaterialConfig[] {
  const materials = section.config.materials;
  if (Array.isArray(materials)) {
    return materials as StaticMaterialConfig[];
  }
  return [];
}

interface StaticMaterialTableProps {
  config: StaticMaterialConfig[];
  data: StaticMaterialSectionData;
  onChange: (data: StaticMaterialSectionData) => void;
  readOnly?: boolean;
}

export function StaticMaterialTable({ config, data, onChange, readOnly }: StaticMaterialTableProps) {
  const rows = data.rows.length > 0 ? data.rows : buildStaticMaterialSection(config).rows;

  const updateQty = (index: number, value: string) => {
    onChange({
      rows: rows.map((row, i) =>
        i === index ? { ...row, quantity_kg: value === '' ? null : Number(value) } : row,
      ),
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-slate-300 text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700">Material</th>
            <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700">Qty (kg)</th>
          </tr>
        </thead>
        <tbody>
          {config.map((mat, index) => {
            const row = rows[index] ?? { material: mat.code, quantity_kg: null };
            return (
              <tr key={mat.code} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-3 py-2 font-medium text-slate-800">{mat.label}</td>
                <td className="border border-slate-300 px-2 py-1">
                  {readOnly ? (
                    <span className="px-1 py-1 text-slate-700">{row.quantity_kg ?? '—'}</span>
                  ) : (
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.quantity_kg ?? ''}
                      onChange={(e) => updateQty(index, e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                      placeholder="0"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function staticMaterialToPayload(data: StaticMaterialSectionData): MaterialRow[] {
  return data.rows.filter((r) => r.quantity_kg != null);
}
