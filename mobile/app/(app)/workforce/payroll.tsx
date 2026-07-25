import { Redirect } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { PayrollScreen } from '@/src/features/workforce/PayrollScreen';
import { WORKFORCE_HR_ROLES } from '@/src/features/workforce/workforceRoles';
export default function PayrollRoute() { const { user, loading } = useAuth(); if (loading) return <LoadingView message="Loading…" />; if (!user) return <Redirect href="/login" />; if (!hasRole(user.role, WORKFORCE_HR_ROLES)) return <Redirect href={getRoleHomeHref(user.role)} />; return <PayrollScreen />; }
