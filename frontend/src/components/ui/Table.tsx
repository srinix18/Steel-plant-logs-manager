import type { ReactNode } from 'react';
import { useIsPhoneLayout } from '../../hooks/useMediaQuery';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  /** Prefer card stack on phone (default true). */
  phoneCards?: boolean;
}

export function Table<T extends { id: string }>({
  columns,
  data,
  emptyMessage = 'No data found',
  phoneCards = true,
}: TableProps<T>) {
  const isPhone = useIsPhoneLayout();

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  if (isPhone && phoneCards) {
    const titleCol = columns[0];
    const rest = columns.slice(1);
    return (
      <ul className="space-y-3">
        {data.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-base font-semibold text-slate-900">{titleCol.render(row)}</div>
            <dl className="mt-3 space-y-2">
              {rest.map((col) => (
                <div key={col.key} className="flex flex-wrap items-start justify-between gap-2">
                  {col.header ? (
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {col.header}
                    </dt>
                  ) : (
                    <dt className="sr-only">Actions</dt>
                  )}
                  <dd className="text-sm text-slate-700">{col.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-sm text-slate-700">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
