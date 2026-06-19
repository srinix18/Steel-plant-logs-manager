import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function Table<T extends { id: string }>({ columns, data, emptyMessage = 'No data found' }: TableProps<T>) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
