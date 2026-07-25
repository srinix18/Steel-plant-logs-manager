import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getErrorMessage } from '@/src/api/client';
import { fetchWorkforceEmployees } from '@/src/api/workforce';
import { assignEmployeeSkill, createSkill, fetchAllEmployeeSkills, fetchSkills, type Skill } from '@/src/api/workforceOps';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { colors, spacing, typography } from '@/src/theme/tokens';
const LEVELS = ['', 'basic', 'intermediate', 'advanced', 'expert'];
/** P4-WF-SKILL — phone-first employee skill cards. */
export function SkillMatrixScreen() {
 const [employees, setEmployees] = useState<Awaited<ReturnType<typeof fetchWorkforceEmployees>>>([]); const [skills, setSkills] = useState<Skill[]>([]); const [matrix, setMatrix] = useState(new Map<string, string>()); const [code, setCode] = useState(''); const [name, setName] = useState(''); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
 const load = useCallback(async () => { try { const [emps, sk, assignments] = await Promise.all([fetchWorkforceEmployees(), fetchSkills(), fetchAllEmployeeSkills()]); setEmployees(emps); setSkills(sk); setMatrix(new Map(assignments.map((a) => [`${a.user_id}:${a.skill_id}`, a.proficiency_level]))); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } }, []);
 useEffect(() => { void load(); }, [load]);
 const options = useMemo(() => LEVELS.map((value) => ({ value, label: value || '—' })), []);
 const add = async () => { if (!code.trim() || !name.trim()) return setError('Skill code and name are required.'); try { await createSkill({ code: code.trim(), name: name.trim() }); setCode(''); setName(''); await load(); } catch(e) { setError(getErrorMessage(e)); } };
 const assign = async (userId: string, skillId: string, level: string) => { try { await assignEmployeeSkill(userId, { skill_id: skillId, proficiency_level: level || undefined }); await load(); } catch(e) { setError(getErrorMessage(e)); } };
 if (loading) return <LoadingView message="Loading skill matrix…" />;
 return <Screen scroll><Text style={styles.title}>Skill Matrix</Text><Text style={styles.sub}>Employee proficiency across plant skills.</Text>{error ? <ErrorBanner message={error} /> : null}<Card style={styles.card}><Text style={styles.section}>Add skill</Text><TextField label="Code" value={code} onChangeText={setCode} /><TextField label="Name" value={name} onChangeText={setName} /><Button title="Add skill" onPress={() => void add()} /></Card><Text style={styles.section}>Employees</Text>{employees.length === 0 ? <EmptyState title="No employees found" /> : employees.map((employee) => <Card key={employee.id} style={styles.card}><Text style={styles.name}>{employee.full_name}</Text>{skills.map((skill) => <View key={skill.id} style={styles.skill}><Text style={styles.label}>{skill.code} · {skill.name}</Text><SelectSheet options={options} value={matrix.get(`${employee.id}:${skill.id}`) ?? ''} onChange={(level) => void assign(employee.id, skill.id, level)} /></View>)}</Card>)}</Screen>;
}
const styles = StyleSheet.create({ title: { ...typography.title, color: colors.text, marginBottom: spacing.xs }, sub: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md }, section: { ...typography.section, color: colors.text, marginBottom: spacing.sm }, card: { marginBottom: spacing.sm }, name: { ...typography.body, color: colors.text, fontWeight: '700' }, skill: { marginTop: spacing.sm }, label: { ...typography.caption, color: colors.text, fontWeight: '600' } });
