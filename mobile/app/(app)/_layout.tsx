import { Drawer } from 'expo-router/drawer';

import { colors } from '@/src/theme/tokens';

/**
 * Authenticated drawer shell (P1-01).
 * Role-filtered links arrive in P1-05; auth guard in P1-02+.
 */
export default function AppDrawerLayout() {
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
