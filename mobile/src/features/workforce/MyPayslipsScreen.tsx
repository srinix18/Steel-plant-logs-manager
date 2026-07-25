import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchMyPayslips,
  fetchPayslipHtml,
  formatCurrency,
  formatPayrollMonth,
  type PayrollLineItem,
} from '@/src/api/workforceOps';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

function periodLabel(p: PayrollLineItem): string {
  const month = Number(p.payslip_data?.month ?? 0);
  const year = Number(p.payslip_data?.year ?? 0);
  return month && year ? formatPayrollMonth(month, year) : '—';
}

/**
 * P4-WF-MY-PAY — worker payslip list + HTML view/share (port of MyPayslipsPage).
 */
export function MyPayslipsScreen() {
  const [payslips, setPayslips] = useState<PayrollLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setPayslips(await fetchMyPayslips());
    } catch (e) {
      setError(getErrorMessage(e));
      setPayslips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const viewPayslip = useCallback(async (lineItemId: string) => {
    setViewingId(lineItemId);
    setError(null);
    setMessage(null);
    try {
      const { html } = await fetchPayslipHtml(lineItemId);
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!base) {
        throw new Error('No writable directory for payslip HTML');
      }
      const path = `${base}payslip-${lineItemId.replace(/[^\w.-]+/g, '_')}.html`;
      await FileSystem.writeAsStringAsync(path, html, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setMessage(`Payslip HTML saved at ${path}`);
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'text/html',
        dialogTitle: 'View payslip',
        UTI: 'public.html',
      });
      setMessage('Share sheet opened — open the HTML to view your payslip.');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setViewingId(null);
    }
  }, []);

  if (loading) {
    return <LoadingView message="Loading your payslips…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>My Payslips</Text>
      <Text style={styles.sub}>View and share your payslip history.</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {message ? <Text style={styles.hint}>{message}</Text> : null}

      <Text style={styles.blurb}>
        Payslips appear after HR processes a monthly payroll run and you have a salary structure on
        file.
      </Text>

      {payslips.length === 0 && !error ? (
        <EmptyState
          title="No payslips available yet."
          description="When payroll is processed for you, slips will show here."
        />
      ) : (
        payslips.map((p) => (
          <Card key={p.id} style={styles.card}>
            <Text style={styles.period}>{periodLabel(p)}</Text>
            <Text style={styles.meta}>Payable days: {p.payable_days}</Text>
            <View style={styles.amounts}>
              <Text style={styles.amount}>Gross {formatCurrency(p.gross_salary)}</Text>
              <Text style={styles.net}>Net {formatCurrency(p.net_salary)}</Text>
            </View>
            <Button
              title={viewingId === p.id ? 'Opening…' : 'View HTML'}
              size="sm"
              variant="secondary"
              disabled={viewingId !== null}
              onPress={() => void viewPayslip(p.id)}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  banner: { marginTop: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  blurb: { ...typography.body, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  card: { marginTop: spacing.sm, gap: spacing.sm },
  period: { ...typography.section, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  amounts: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  amount: { ...typography.body, color: colors.text },
  net: { ...typography.body, color: colors.text, fontWeight: '600' },
});
