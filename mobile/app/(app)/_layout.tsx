import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Drawer } from 'expo-router/drawer';

import { useAuth } from '@/src/auth/AuthContext';
import { colors } from '@/src/theme/tokens';

/**
 * Authenticated drawer shell.
 * Role-filtered links arrive in P1-05.
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
    <Drawer
      screenOptions={{
        headerTintColor: colors.brand,
        headerStyle: { backgroundColor: colors.card },
        drawerActiveTintColor: colors.brand,
        drawerInactiveTintColor: colors.textMuted,
        drawerStyle: { backgroundColor: colors.card, width: 280 },
      }}
    >
      <Drawer.Screen
        name="home"
        options={{
          title: 'Home',
          drawerLabel: 'Home',
          headerTitle: 'MOI Home',
        }}
      />
      <Drawer.Screen
        name="profile"
        options={{
          title: 'Profile',
          drawerLabel: 'My Profile',
          headerTitle: 'My Profile',
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
