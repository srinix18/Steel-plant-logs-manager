import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiBaseUrl, getErrorMessage } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { DEMO_ACCOUNTS } from '@/src/auth/demoAccounts';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

/**
 * Login — P1-03 UI + P1-06 TextField / Button.lg.
 */
export default function LoginScreen() {
  const { user, loading: authLoading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  if (authLoading) {
    return <LoadingView message="Restoring session…" />;
  }

  if (user) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await login(email.trim(), password);
      router.replace(getRoleHomeHref(signedIn.role));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <Text style={styles.brand}>MOI Platform</Text>
            <Text style={styles.subtitle}>Chandan Steel — Manufacturing Operations</Text>

            <TextField
              label="Email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@company.com"
              value={email}
              onChangeText={setEmail}
              editable={!submitting}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <TextField
              ref={passwordRef}
              label="Password"
              passwordToggle
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              editable={!submitting}
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />

            {error ? <ErrorBanner message={error} /> : null}

            <Button
              title="Sign in"
              size="lg"
              fullWidth
              loading={submitting}
              onPress={onSubmit}
              disabled={!email.trim() || !password}
            />

            {__DEV__ ? (
              <View style={styles.devBlock}>
                <Text style={styles.devTitle}>Demo accounts (dev)</Text>
                <Text style={styles.devHint}>API: {getApiBaseUrl()}</Text>
                <View style={styles.chipRow}>
                  {DEMO_ACCOUNTS.map((account) => (
                    <Pressable
                      key={account.email}
                      style={styles.chip}
                      onPress={() => fillDemo(account)}
                      accessibilityRole="button"
                      accessibilityLabel={`Fill ${account.label} credentials`}
                    >
                      <Text style={styles.chipText}>{account.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.devHint}>Tap a role to fill email/password, then Sign in.</Text>
              </View>
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  brand: {
    ...typography.title,
    color: colors.brand,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  devBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  devTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  devHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brandDark,
  },
});
