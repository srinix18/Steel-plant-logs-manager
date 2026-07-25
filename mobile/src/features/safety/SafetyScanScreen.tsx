import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchPlants } from '@/src/api/lookups';
import {
  scanQrPayload,
  searchSafetyAssets,
  type SafetyAssetMatch,
} from '@/src/api/safety';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import { workspaceHrefFromScan } from '@/src/features/safety/workspaceHref';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * P3-SAFE-SCAN — Asset Scan (search + real camera QR; web is camera stub).
 */
export function SafetyScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SafetyAssetMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanLock, setScanLock] = useState(false);
  const [plantId, setPlantId] = useState<string | null>(user?.plant_id ?? null);
  const lastScanRef = useRef<string>('');

  useEffect(() => {
    if (user?.plant_id) {
      setPlantId(user.plant_id);
      return;
    }
    let cancelled = false;
    fetchPlants()
      .then((plants) => {
        if (!cancelled) setPlantId(plants[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setPlantId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.plant_id]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      searchSafetyAssets(term, plantId)
        .then(setMatches)
        .catch(() => setMatches([]))
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, plantId]);

  const openWorkspace = useCallback((assetId: string) => {
    setError(null);
    setCameraOpen(false);
    router.push(`/(app)/assets/${assetId}/workspace` as Href);
  }, []);

  const resolvePayload = useCallback(
    async (payload: string) => {
      const term = payload.trim();
      if (!term) return;
      setLoading(true);
      setError(null);
      try {
        const result = await scanQrPayload(term);
        router.push(workspaceHrefFromScan(result) as Href);
        setCameraOpen(false);
      } catch (e) {
        setError(getErrorMessage(e) || 'Asset not found for QR payload');
      } finally {
        setLoading(false);
        setScanLock(false);
      }
    },
    []
  );

  async function onSubmitSearch() {
    const term = query.trim();
    if (!term) return;

    if (matches.length === 1) {
      openWorkspace(matches[0].id);
      return;
    }
    if (matches.length > 1) {
      setError('Multiple matches — pick one from the list.');
      return;
    }

    await resolvePayload(term);
  }

  async function onBarcodeScanned({ data }: { data: string }) {
    if (scanLock || loading) return;
    const payload = data.trim();
    if (!payload || payload === lastScanRef.current) return;
    lastScanRef.current = payload;
    setScanLock(true);
    setQuery(payload);
    await resolvePayload(payload);
  }

  async function startCamera() {
    setError(null);
    lastScanRef.current = '';
    setScanLock(false);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera permission is required to scan QR codes.');
        return;
      }
    }
    setCameraOpen(true);
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Scan Asset</Text>
      <Text style={styles.sub}>
        Point the camera at an asset QR, or search by asset code, name, or UUID.
      </Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.section}>Camera QR</Text>
        {cameraOpen && permission?.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanLock || loading ? undefined : onBarcodeScanned}
            />
            <Text style={styles.cameraHint}>
              {loading ? 'Opening workspace…' : 'Align QR inside the frame'}
            </Text>
            <Button
              title="Close camera"
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => setCameraOpen(false)}
              style={styles.camBtn}
            />
          </View>
        ) : (
          <View style={styles.camPlaceholder}>
            <Text style={styles.camPlaceholderText}>
              {Platform.OS === 'web'
                ? 'Camera works best on a phone. You can still search below.'
                : 'Scan a plant asset QR to open its workspace.'}
            </Text>
            <Button
              title={permission?.granted === false ? 'Grant camera & scan' : 'Open camera scanner'}
              size="lg"
              fullWidth
              onPress={() => void startCamera()}
            />
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Search asset</Text>
        <TextField
          label="Asset code / name / UUID"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setError(null);
          }}
          placeholder="e.g. IAF, IAF-01, or UUID"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void onSubmitSearch()}
        />
        {searching ? <Text style={styles.searching}>Searching…</Text> : null}

        {matches.length > 0 ? (
          <View style={styles.matches}>
            {matches.map((m) => (
              <ListRow
                key={m.id}
                title={`${m.asset_no} — ${m.name}`}
                subtitle={m.id}
                onPress={() => openWorkspace(m.id)}
                right={<Badge label={m.status} tone="neutral" />}
              />
            ))}
          </View>
        ) : null}

        {!searching && query.trim().length > 0 && matches.length === 0 ? (
          <Text style={styles.noMatch}>No matching assets — try Open, or scan QR.</Text>
        ) : null}

        <Button
          title={loading ? 'Opening…' : 'Open Asset Workspace'}
          size="lg"
          fullWidth
          loading={loading}
          disabled={loading || !query.trim()}
          onPress={() => void onSubmitSearch()}
          style={styles.openBtn}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  banner: { marginBottom: spacing.sm },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  section: { ...typography.section, color: colors.text, marginBottom: spacing.xs },
  camPlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  camPlaceholderText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  cameraWrap: { gap: spacing.sm },
  camera: {
    width: '100%',
    height: 280,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  cameraHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  camBtn: { marginTop: spacing.xs },
  searching: { ...typography.caption, color: colors.textMuted },
  matches: { gap: spacing.xs, marginTop: spacing.xs },
  noMatch: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  openBtn: { marginTop: spacing.sm },
});
