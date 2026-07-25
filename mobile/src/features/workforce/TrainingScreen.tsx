import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { getErrorMessage } from '@/src/api/client';
import { fetchWorkforceEmployees } from '@/src/api/workforce';
import { createTrainingRecord, fetchTrainingRecords, type TrainingRecord } from '@/src/api/workforceOps';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { parseAttendanceDateIso, toAttendanceDateIso } from '@/src/api/workforce';
function soon(date?: string | null) { if (!date) return false; const now = new Date(); const limit = new Date(); limit.setDate(limit.getDate() + 30); const expiry = new Date(date); return expiry >= now && expiry <= limit; }
/** P4-WF-TRAIN — training and certification records. */
export function TrainingScreen() {
 const [records, setRecords] = useState<TrainingRecord[]>([]); const [employees, setEmployees] = useState<Awaited<ReturnType<typeof fetchWorkforceEmployees>>>([]); const [userId, setUserId] = useState(''); const [name, setName] = useState(''); const [certification, setCertification] = useState(''); const [expiry, setExpiry] = useState(toAttendanceDateIso(new Date())); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
 const load = useCallback(async () => { try { const [r,e] = await Promise.all([fetchTrainingRecords(), fetchWorkforceEmployees()]); setRecords(r); setEmployees(e); setUserId((id) => id || e[0]?.id || ''); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } }, []);
 useEffect(() => { void load(); }, [load]); const opts = useMemo(() => employees.map((e) => ({ value: e.id, label: e.full_name })), [employees]);
 const save = async () => { if (!userId || !name.trim()) return setError('Employee and training name are required.'); try { await createTrainingRecord({ user_id: userId, name: name.trim(), certification: certification || undefined, expiry_date: expiry }); setName(''); setCertification(''); await load(); } catch(e) { setError(getErrorMessage(e)); } };
 if (loading) return <LoadingView message="Loading training…" />;
 return <Screen scroll><Text style={styles.title}>Training & Certifications</Text><Text style={styles.sub}>Track employee training records and certification expiry.</Text>{error ? <ErrorBanner message={error} /> : null}<Card style={styles.card}><Text style={styles.section}>Add record</Text><SelectSheet label="Employee" options={opts} value={userId || null} onChange={setUserId} /><TextField label="Training name" value={name} onChangeText={setName} /><TextField label="Certification" value={certification} onChangeText={setCertification} /><DateTimeField label="Expiry date" mode="date" value={parseAttendanceDateIso(expiry)} onChange={(d) => setExpiry(toAttendanceDateIso(d))} /><Button title="Save record" onPress={() => void save()} /></Card>{records.length === 0 ? <EmptyState title="No training records" /> : records.map((r) => <Card key={r.id} style={styles.card}><Text style={styles.name}>{r.user_name ?? r.user_id}</Text><Text style={styles.body}>{r.name}{r.certification ? ` · ${r.certification}` : ''}</Text><Text style={styles.body}>Expires: {r.expiry_date ?? '—'}</Text>{soon(r.expiry_date) ? <Badge label="Soon" tone="danger" /> : null}</Card>)}</Screen>;
}
const styles = StyleSheet.create({ title:{...typography.title,color:colors.text,marginBottom:spacing.xs},sub:{...typography.caption,color:colors.textMuted,marginBottom:spacing.md},section:{...typography.section,color:colors.text,marginBottom:spacing.sm},card:{marginBottom:spacing.sm},name:{...typography.body,color:colors.text,fontWeight:'700'},body:{...typography.caption,color:colors.textMuted,marginTop:spacing.xs} });
