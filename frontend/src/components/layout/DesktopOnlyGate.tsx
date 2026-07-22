import type { ReactNode } from 'react';
import { useIsPhoneLayout } from '../../hooks/useMediaQuery';

interface Props {
  children: ReactNode;
  /** Short label for what requires desktop */
  featureLabel?: string;
  /** If true, still show children on phone (no gate). */
  allowPhone?: boolean;
}

/** Soft gate for heavy builders (mappings, template admin, etc.). */
export function DesktopOnlyGate({ children, featureLabel = 'This tool', allowPhone }: Props) {
  const isPhone = useIsPhoneLayout();
  if (!isPhone || allowPhone) return <>{children}</>;

  return (
    <div className="mx-auto max-w-md space-y-3 py-12 text-center">
      <h1 className="text-xl font-bold text-slate-900">Best on a larger screen</h1>
      <p className="text-sm text-slate-600">
        {featureLabel} is designed for desktop or tablet landscape. Open this page on a computer
        for full editing.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-500">
        On phone you can still use shop-floor flows: shift dashboard, log sheets, maintenance,
        messages, and self-service.
      </div>
    </div>
  );
}
