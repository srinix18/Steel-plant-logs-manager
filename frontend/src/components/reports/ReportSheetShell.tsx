import type { ReactNode } from 'react';

interface ReportSheetShellProps {
  orientation: 'portrait' | 'landscape';
  variant?: 'default' | 'aod';
  children: ReactNode;
}

export function ReportSheetShell({ orientation, variant = 'default', children }: ReportSheetShellProps) {
  const orientClass = orientation === 'landscape' ? 'report-sheet-landscape' : 'report-sheet-portrait';
  const variantClass = variant === 'aod' ? 'report-sheet-aod' : '';

  return (
    <div className="report-sheet-viewport">
      <div className={`report-sheet-shell ${orientClass} ${variantClass}`}>
        <div className="report-sheet-inner">{children}</div>
      </div>
    </div>
  );
}
