import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useIsPhoneLayout } from '../../hooks/useMediaQuery';
import { OfflineBanner } from './OfflineBanner';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const isPhone = useIsPhoneLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const title =
    location.pathname.split('/').filter(Boolean).slice(-1)[0]?.replace(/-/g, ' ') ?? 'MOI';

  return (
    <div className="flex h-dvh flex-col overflow-hidden safe-pt">
      <OfflineBanner />
      <div className="relative flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <div className="hidden h-full shrink-0 print:hidden lg:flex">
          <Sidebar />
        </div>

        {/* Phone drawer */}
        {isPhone && (
          <>
            <div
              className={`fixed inset-0 z-40 bg-black/40 transition-opacity print:hidden ${
                drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              onClick={() => setDrawerOpen(false)}
              aria-hidden={!drawerOpen}
            />
            <div
              className={`fixed inset-y-0 left-0 z-50 flex h-full w-[min(18rem,85vw)] transform transition-transform print:hidden ${
                drawerOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </div>
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {isPhone && (
            <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 print:hidden safe-px">
              <button
                type="button"
                className="touch-target inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
              >
                <span className="text-xl leading-none">☰</span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold capitalize text-slate-900">{title}</p>
                {user && (
                  <p className="truncate text-xs text-slate-500">{user.full_name}</p>
                )}
              </div>
            </header>
          )}

          <main className="min-h-0 flex-1 overflow-auto p-4 safe-px safe-pb lg:p-8 print:overflow-visible print:p-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
