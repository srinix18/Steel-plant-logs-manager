import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

/**
 * P1-03 login UI + P1-04 role home redirect after sign-in.
 */
export default function LoginScreen() {
  const { user, loading: authLoading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
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
          <View style={styles.card}>
            <Text style={styles.brand}>MOI Platform</Text>
            <Text style={styles.subtitle}>Chandan Steel — Manufacturing Operations</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@company.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              editable={!submitting}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                editable={!submitting}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                accessibilityLabel="Password"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              onPress={onSubmit}
              disabled={submitting || !email.trim() || !password}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>

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
          </View>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
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
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    minHeight: touch.minTarget,
    backgroundColor: colors.card,
  },
  passwordInput: {
    flex: 1,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  eyeButton: {
    minWidth: touch.minTarget,
    minHeight: touch.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
    lineHeight: 18,
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: radius.button,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
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
