import {
  DrawerContentScrollView,
  useDrawerStatus,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchUnreadCount } from '@/src/api/messages';
import { useAuth } from '@/src/auth/AuthContext';
import { buildDrawerNav } from '@/src/nav/buildDrawerNav';
import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const drawerStatus = useDrawerStatus();

  useEffect(() => {
    if (drawerStatus !== 'open') return;
    let cancelled = false;
    fetchUnreadCount()
      .then((n) => {
        if (!cancelled) setUnread(n);
      })
      .catch(() => {
        if (!cancelled) setUnread(0);
      });
    return () => {
      cancelled = true;
    };
  }, [drawerStatus]);

  if (!user) return null;

  const entries = buildDrawerNav(user.role);

  async function onSignOut() {
    props.navigation.closeDrawer();
    await logout();
    router.replace('/login');
  }

  function onNavigate(href: string) {
    props.navigation.closeDrawer();
    router.push(href as never);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>MOI Platform</Text>
        <Text style={styles.name} numberOfLines={1}>
          {user.full_name}
        </Text>
        <Text style={styles.role}>{user.role.replace(/_/g, ' ')}</Text>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll}>
        {entries.map((entry, index) => {
          if (entry.type === 'section') {
            return (
              <Text key={`s-${entry.label}-${index}`} style={styles.section}>
                {entry.label}
              </Text>
            );
          }
          const isMessages = entry.href === '/messages' || entry.href.includes('/messages');
          return (
            <Pressable
              key={entry.href}
              style={styles.link}
              onPress={() => onNavigate(entry.href)}
              accessibilityRole="button"
              accessibilityLabel={
                isMessages && unread > 0
                  ? `${entry.label}, ${unread} unread`
                  : entry.label
              }
            >
              <Text style={styles.linkText}>{entry.label}</Text>
              {isMessages && unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </DrawerContentScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.signOut}
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 4,
  },
  brand: {
    ...typography.section,
    color: colors.brand,
  },
  name: {
    ...typography.caption,
    color: colors.textMuted,
  },
  role: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  scroll: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  link: {
    minHeight: touch.listRow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    gap: spacing.sm,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    flexShrink: 1,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  signOut: {
    minHeight: touch.minTarget,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
