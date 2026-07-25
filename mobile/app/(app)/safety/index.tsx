import { Redirect } from 'expo-router';

/** Web parity: `/safety` → `/safety/dashboard`. */
export default function SafetyIndex() {
  return <Redirect href="/safety/dashboard" />;
}
