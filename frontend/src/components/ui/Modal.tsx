import { useEffect, type ReactNode } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90dvh,900px)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <Button variant="ghost" size="lg" onClick={onClose} aria-label="Close" className="!min-w-[48px]">
            ✕
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-200 px-4 py-3 safe-pb sm:px-6">{footer}</div>
        )}
      </div>
    </div>
  );
}
