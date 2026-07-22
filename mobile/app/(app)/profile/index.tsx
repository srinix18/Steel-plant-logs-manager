import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getMe, updateProfile } from '@/src/api/auth';
import { getErrorMessage } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import type { User } from '@/src/types/user';
import { colors, spacing, typography } from '@/src/theme/tokens';

function parseJoiningDate(value?: string | null): Date | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateInput(value: Date | null): string | undefined {
  if (!value) return undefined;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * P1-07 — My Profile (GET/PATCH /auth/me), fields match web ProfilePage.
 */
export default function ProfileScreen() {
  const { user: authUser, logout, applyUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(authUser);

  const [fullName, setFullName] = useState(authUser?.full_name ?? '');
  const [phone, setPhone] = useState(authUser?.phone ?? '');
  const [designation, setDesignation] = useState(authUser?.designation ?? '');
  const [joiningDate, setJoiningDate] = useState<Date | null>(
    parseJoiningDate(authUser?.date_of_joining)
  );

  const hydrate = useCallback((u: User) => {
    setProfile(u);
    setFullName(u.full_name ?? '');
    setPhone(u.phone ?? '');
    setDesignation(u.designation ?? '');
    setJoiningDate(parseJoiningDate(u.date_of_joining));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const me = await getMe();
        if (!cancelled) {
          hydrate(me);
          await applyUser(me);
        }
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUser, hydrate]);

  async function onSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        designation: designation.trim() || undefined,
        date_of_joining: toDateInput(joiningDate),
      });
      hydrate(updated);
      await applyUser(updated);
      setMessage('Profile saved.');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading && !profile) {
    return <LoadingView message="Loading profile…" />;
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>My Profile</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Card>
        <View style={styles.badgeRow}>
          <Badge label={profile?.role?.replace(/_/g, ' ') ?? 'unknown'} tone="brand" />
        </View>

        <TextField label="Email" value={profile?.email ?? ''} editable={false} />

        {profile?.employee_uid ? (
          <TextField label="Employee UID" value={profile.employee_uid} editable={false} />
        ) : null}

        <TextField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          editable={!saving}
        />

        <TextField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!saving}
        />

        <TextField
          label="Designation"
          value={designation}
          onChangeText={setDesignation}
          placeholder="e.g. Melter"
          editable={!saving}
        />

        <DateTimeField
          label="Date of joining"
          mode="date"
          value={joiningDate}
          onChange={setJoiningDate}
          disabled={saving}
        />

        <Text style={styles.hint}>
          Employee UID is generated when you save your designation for the first time.
        </Text>

        <Button
          title={saving ? 'Saving…' : 'Save profile'}
          size="lg"
          fullWidth
          loading={saving}
          onPress={onSave}
          disabled={!fullName.trim()}
        />

        <Button
          title="Log out"
          variant="secondary"
          fullWidth
          loading={loggingOut}
          onPress={onLogout}
          disabled={saving}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  banner: { marginBottom: spacing.sm },
  success: {
    ...typography.caption,
    color: colors.success,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  badgeRow: { marginBottom: spacing.xs },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
