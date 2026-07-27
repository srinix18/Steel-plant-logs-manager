import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Drawer } from 'expo-router/drawer';

import { OfflineBanner } from '@/src/components/OfflineBanner';
import { useAuth } from '@/src/auth/AuthContext';
import { AppDrawerContent } from '@/src/nav/AppDrawerContent';
import { colors } from '@/src/theme/tokens';

/**
 * Authenticated drawer — custom role-filtered content (P1-05).
 * OfflineBanner: P6-OFFLINE / Q8 draft sync visibility.
 */
export default function AppDrawerLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.root}>
      <OfflineBanner />
      <Drawer
        drawerContent={(props) => <AppDrawerContent {...props} />}
        screenOptions={{
          headerTintColor: colors.brand,
          headerStyle: { backgroundColor: colors.card },
          drawerActiveTintColor: colors.brand,
          drawerInactiveTintColor: colors.textMuted,
          drawerStyle: { backgroundColor: colors.card, width: 300 },
          // Custom drawer renders its own links.
          drawerItemStyle: { display: 'none' },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
