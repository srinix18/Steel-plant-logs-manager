import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { getErrorMessage } from '@/src/api/client';
import { fetchPlants } from '@/src/api/lookups';
import { createPayrollRun, fetchPayrollLineItems, fetchPayrollRuns, fetchSalaryStructures, formatCurrency, formatPayrollMonth, processPayrollRun, type PayrollLineItem, type PayrollRun } from '@/src/api/workforceOps';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';
/** P4-WF-PAY — monthly payroll run processing. */
export function PayrollScreen() {
 const router = useRouter(); const [plantId,setPlantId]=useState(''); const [runs,setRuns]=useState<PayrollRun[]>([]); const [lines,setLines]=useState<PayrollLineItem[]>([]); const [selected,setSelected]=useState<string | null>(null); const [salaryCount,setSalaryCount]=useState(0); const [loading,setLoading]=useState(true); const [error,setError]=useState<string | null>(null);
 const load = useCallback(async () => { try { const plants=await fetchPlants(); const id=plantId||plants[0]?.id||''; setPlantId(id); const [r,s]=await Promise.all([id ? fetchPayrollRuns(id) : Promise.resolve([]),fetchSalaryStructures()]); setRuns(r); setSalaryCount(s.length); } catch(e){setError(getErrorMessage(e));} finally{setLoading(false);} },[plantId]);
 useEffect(()=>{void load();},[load]); const select=async(id:string)=>{setSelected(id);try{setLines(await fetchPayrollLineItems(id));}catch(e){setError(getErrorMessage(e));}};
 const create=async()=>{if(!plantId)return;try{const d=new Date();const run=await createPayrollRun({plant_id:plantId,month:d.getMonth()+1,year:d.getFullYear()});await load();await select(run.id);}catch(e){setError(getErrorMessage(e));}};
 const process=async(id:string)=>{try{await processPayrollRun(id);await load();await select(id);}catch(e){setError(getErrorMessage(e));}};
 if(loading)return <LoadingView message="Loading payroll…" />; return <Screen scroll><Text style={styles.title}>Payroll</Text><Text style={styles.sub}>Monthly payroll, pro-rated by attendance.</Text>{error?<ErrorBanner message={error}/>:null}{salaryCount===0?<Card style={styles.card}><Text style={styles.warn}>No salary structures found. Add structures before processing payroll.</Text><Button title="Salary structures" variant="secondary" onPress={()=>router.push('/workforce/salary-structures')}/></Card>:null}<Button title="Create payroll run" fullWidth onPress={()=>void create()}/><Text style={styles.section}>Payroll runs</Text>{runs.length===0?<EmptyState title="No payroll runs"/>:runs.map(r=><Card key={r.id} style={styles.card}><Text style={styles.name}>{formatPayrollMonth(r.month,r.year)}</Text><Text style={styles.sub}>{r.status}</Text><Button title="View line items" size="sm" variant="secondary" onPress={()=>void select(r.id)}/>{r.status==='draft'?<Button title="Process" size="sm" onPress={()=>void process(r.id)}/>:null}</Card>)}{selected?<><Text style={styles.section}>Line items</Text>{lines.map(l=><Card key={l.id} style={styles.card}><Text style={styles.name}>{l.user_name??l.user_id}</Text><Text style={styles.sub}>{l.payable_days} days · Gross {formatCurrency(l.gross_salary)} · Deductions {formatCurrency(l.deductions)} · Net {formatCurrency(l.net_salary)}</Text></Card>)}</>:null}</Screen>;
}
const styles=StyleSheet.create({title:{...typography.title,color:colors.text,marginBottom:spacing.xs},sub:{...typography.caption,color:colors.textMuted,marginBottom:spacing.sm},section:{...typography.section,color:colors.text,marginTop:spacing.md,marginBottom:spacing.sm},card:{marginVertical:spacing.xs},name:{...typography.body,color:colors.text,fontWeight:'700'},warn:{...typography.body,color:colors.danger,marginBottom:spacing.sm}});
