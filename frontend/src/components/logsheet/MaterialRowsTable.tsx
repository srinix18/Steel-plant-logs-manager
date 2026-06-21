import type { MaterialCatalogItem, MaterialRow, MaterialSectionData } from '../../types';
import { Button } from '../ui/Button';
import { COMPACT_TABLE } from '../reports/compactTableClasses';

interface MaterialRowsTableProps {
  materials: MaterialCatalogItem[];
  data: MaterialSectionData;
  onChange: (data: MaterialSectionData) => void;
  readOnly?: boolean;
  quantityLabel?: string;
  compact?: boolean;
  title?: string;
}

export function emptyMaterialSection(): MaterialSectionData {
  return { rows: [] };
}

export function parseMaterialSection(raw: unknown): MaterialSectionData {
  if (Array.isArray(raw)) {
    return { rows: raw as MaterialRow[] };
  }
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as MaterialSectionData).rows)) {
    return raw as MaterialSectionData;
  }
  return emptyMaterialSection();
}

export function materialSectionToPayload(data: MaterialSectionData): MaterialSectionData {
  return {
    rows: data.rows.filter((r) => r.material || r.quantity_kg != null),
  };
}

export function MaterialRowsTable({
  materials,
  data,
  onChange,
  readOnly,
  quantityLabel = 'Qty (kg)',
  compact,
  title,
}: MaterialRowsTableProps) {
  const tableClass = compact ? COMPACT_TABLE : 'min-w-full border border-slate-300 text-sm';
  const addRow = () => {
    onChange({
      rows: [...data.rows, { material: materials[0]?.code ?? '', quantity_kg: null }],
    });
  };

  const updateRow = (index: number, patch: Partial<MaterialRow>) => {
    onChange({
      rows: data.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  };

  const removeRow = (index: number) => {
    onChange({ rows: data.rows.filter((_, i) => i !== index) });
  };

  return (
    <div>
      {title && <p className="report-section-title">{title}</p>}
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead className={compact ? undefined : 'bg-slate-100'}>
            <tr>
              <th className={compact ? '' : 'border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700'}>
                Material
              </th>
              <th className={compact ? '' : 'border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700'}>
                {quantityLabel}
              </th>
              {!readOnly && <th className="border border-slate-300 px-3 py-2 w-16" />}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr>
                {compact && readOnly ? (
                  <>
                    <td className="text-center">—</td>
                    <td className="text-center">—</td>
                  </>
                ) : (
                  <td colSpan={readOnly ? 2 : 3} className="border border-slate-300 px-3 py-6 text-center text-slate-400">
                    No entries yet
                  </td>
                )}
              </tr>
            )}
            {data.rows.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-2 py-1">
                  {readOnly ? (
                    <span className="px-1 py-1 text-slate-700">
                      {materials.find((m) => m.code === row.material)?.name ?? (row.material || '—')}
                    </span>
                  ) : (
                    <select
                      value={row.material}
                      onChange={(e) => updateRow(index, { material: e.target.value })}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <option value="">Select material</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.code}>
                          {m.name} ({m.code})
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="border border-slate-300 px-2 py-1">
                  {readOnly ? (
                    <span className="block px-1 py-1 text-slate-700">{row.quantity_kg ?? '—'}</span>
                  ) : (
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.quantity_kg ?? ''}
                      onChange={(e) =>
                        updateRow(index, { quantity_kg: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                      placeholder="0"
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="border border-slate-300 px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-red-500 hover:text-red-700"
                      title="Remove row"
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={addRow}>
          + Add entry
        </Button>
      )}
    </div>
  );
}
