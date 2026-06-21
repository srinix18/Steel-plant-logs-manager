import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto p-6 lg:p-8 print:p-0 print:overflow-visible">
        <Outlet />
      </main>
    </div>
  );
}
