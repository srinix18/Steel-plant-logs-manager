import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { getErrorMessage } from '@/src/api/client';
import { fetchWorkforceEmployees, parseAttendanceDateIso, toAttendanceDateIso } from '@/src/api/workforce';
import { createSalaryStructure, fetchSalaryStructures, formatCurrency, type SalaryStructure } from '@/src/api/workforceOps';
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
/** P4-WF-SAL — employee salary structures. */
export function SalaryStructuresScreen() {
 const [rows,setRows]=useState<SalaryStructure[]>([]);const [employees,setEmployees]=useState<Awaited<ReturnType<typeof fetchWorkforceEmployees>>>([]);const [userId,setUserId]=useState('');const [form,setForm]=useState({basic:'25000',hra:'8000',allowances:'2000',pf:'1800',esi:'500',other:'200',from:toAttendanceDateIso(new Date())});const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{try{const[r,e]=await Promise.all([fetchSalaryStructures(),fetchWorkforceEmployees()]);setRows(r);setEmployees(e);setUserId((v)=>v||e[0]?.id||'');}catch(e){setError(getErrorMessage(e));}finally{setLoading(false);}},[]);useEffect(()=>{void load();},[load]);const opts=useMemo(()=>employees.map(e=>({value:e.id,label:e.full_name})),[employees]);
 const save=async()=>{if(!userId)return setError('Select an employee.');try{await createSalaryStructure({user_id:userId,basic:Number(form.basic)||0,hra:Number(form.hra)||0,allowances:Number(form.allowances)||0,pf:Number(form.pf)||0,esi:Number(form.esi)||0,other_deductions:Number(form.other)||0,effective_from:form.from});await load();}catch(e){setError(getErrorMessage(e));}};
 if(loading)return <LoadingView message="Loading salary structures…" />;return <Screen scroll><Text style={styles.title}>Salary Structures</Text><Text style={styles.sub}>Assign pay components before running payroll.</Text>{error?<ErrorBanner message={error}/>:null}<Card style={styles.card}><SelectSheet label="Employee" options={opts} value={userId||null} onChange={setUserId}/>{(['basic','hra','allowances','pf','esi','other'] as const).map(k=><TextField key={k} label={`${k==='other'?'Other deductions':k.toUpperCase()} (₹)`} keyboardType="number-pad" value={form[k]} onChangeText={(value)=>setForm({...form,[k]:value})}/>) }<DateTimeField label="Effective from" mode="date" value={parseAttendanceDateIso(form.from)} onChange={(d)=>setForm({...form,from:toAttendanceDateIso(d)})}/><Button title="Save structure" onPress={()=>void save()}/></Card><Text style={styles.section}>Current structures</Text>{rows.length===0?<EmptyState title="No salary structures yet."/>:rows.map(s=>{const gross=s.basic+s.hra+s.allowances;const deductions=s.pf+s.esi+s.other_deductions;return <Card key={s.id} style={styles.card}><Text style={styles.name}>{s.user_name??s.user_id}</Text><Text style={styles.sub}>Gross {formatCurrency(gross)} · Deductions {formatCurrency(deductions)}</Text><Text style={styles.sub}>From {s.effective_from}</Text></Card>})}</Screen>;
}
const styles=StyleSheet.create({title:{...typography.title,color:colors.text,marginBottom:spacing.xs},sub:{...typography.caption,color:colors.textMuted,marginBottom:spacing.sm},section:{...typography.section,color:colors.text,marginTop:spacing.md,marginBottom:spacing.sm},card:{marginBottom:spacing.sm},name:{...typography.body,color:colors.text,fontWeight:'700'}});
