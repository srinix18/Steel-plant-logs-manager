import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { colors } from '@/src/theme/tokens';

/**
 * Auth gate. Role-based homes (P1-04).
 */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (user) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
