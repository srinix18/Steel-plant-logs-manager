import { Redirect } from 'expo-router';

/**
 * Auth gate stub (P1-01).
 * P1-02/P1-03 will read SecureStore and redirect by role (P1-04).
 */
export default function Index() {
  return <Redirect href="/login" />;
}
