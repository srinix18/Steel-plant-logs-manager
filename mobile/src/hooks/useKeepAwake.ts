import { useKeepAwake as useExpoKeepAwake } from 'expo-keep-awake';

/** Wake lock while the run host screen is mounted (P2-ENGINE-01). */
export function useKeepAwake() {
  useExpoKeepAwake('moi-run-host');
}
