import type { Href } from 'expo-router';

import type { UserRole } from '@/src/types/user';

/** Mirrors `frontend/src/App.tsx` RootRedirect + master plan P1-04. */
export function getRoleHomeHref(role: UserRole): Href {
  if (role === 'super_admin' || role === 'admin') return '/admin' as Href;
  if (role === 'ceo' || role === 'org_admin') return '/pulse/plant' as Href;
  if (role === 'hr') return '/workforce' as Href;
  if (role === 'hod' || role === 'plant_admin') return '/pulse/department' as Href;
  if (role === 'maintenance') return '/maintenance' as Href;
  if (role === 'supervisor' || role === 'department') return '/supervisor' as Href;
  if (role === 'worker' || role === 'member') return '/shift' as Href;
  return '/shift' as Href;
}
