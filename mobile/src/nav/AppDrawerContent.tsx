import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { buildDrawerNav } from '@/src/nav/buildDrawerNav';
import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();

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
          return (
            <Pressable
              key={entry.href}
              style={styles.link}
              onPress={() => onNavigate(entry.href)}
              accessibilityRole="button"
              accessibilityLabel={entry.label}
            >
              <Text style={styles.linkText}>{entry.label}</Text>
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
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
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
