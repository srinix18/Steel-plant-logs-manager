import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchWorkforceEmployees } from '../../api/workforce';
import {
  assignEmployeeSkill,
  createSkill,
  fetchAllEmployeeSkills,
  fetchSkills,
} from '../../api/workforceOps';
import { DesktopOnlyGate } from '../../components/layout/DesktopOnlyGate';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

const LEVELS = ['basic', 'intermediate', 'advanced', 'expert'];

export function SkillMatrixPage() {
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof fetchWorkforceEmployees>>>([]);
  const [skills, setSkills] = useState<Awaited<ReturnType<typeof fetchSkills>>>([]);
  const [assignments, setAssignments] = useState<Awaited<ReturnType<typeof fetchAllEmployeeSkills>>>([]);
  const [newSkill, setNewSkill] = useState({ code: '', name: '' });

  const load = async () => {
    const [emps, sk, asg] = await Promise.all([
      fetchWorkforceEmployees(),
      fetchSkills(),
      fetchAllEmployeeSkills(),
    ]);
    setEmployees(emps);
    setSkills(sk);
    setAssignments(asg);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const matrix = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments) {
      map.set(`${a.user_id}:${a.skill_id}`, a.proficiency_level);
    }
    return map;
  }, [assignments]);

  const handleAssign = async (userId: string, skillId: string, level: string) => {
    try {
      setError('');
      await assignEmployeeSkill(userId, { skill_id: skillId, proficiency_level: level });
      setAssignments(await fetchAllEmployeeSkills());
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.code.trim() || !newSkill.name.trim()) return;
    try {
      await createSkill(newSkill);
      setNewSkill({ code: '', name: '' });
      setSkills(await fetchSkills());
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <DesktopOnlyGate featureLabel="Skill Matrix">
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Skill Matrix</h1>
        <p className="mt-1 text-sm text-slate-500">Employee proficiency across plant skills.</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold">Add skill</h2>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Code" value={newSkill.code} onChange={(e) => setNewSkill({ ...newSkill, code: e.target.value })} />
          <Input placeholder="Name" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} />
          <Button onClick={handleAddSkill}>Add</Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="px-3 py-2 font-medium">Employee</th>
              {skills.map((s) => (
                <th key={s.id} className="px-3 py-2 font-medium">{s.code}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b">
                <td className="px-3 py-2 font-medium">{emp.full_name}</td>
                {skills.map((skill) => {
                  const level = matrix.get(`${emp.id}:${skill.id}`) ?? '';
                  return (
                    <td key={skill.id} className="px-3 py-2">
                      <select
                        className="rounded border px-1 py-0.5 text-xs"
                        value={level}
                        onChange={(e) => handleAssign(emp.id, skill.id, e.target.value)}
                      >
                        <option value="">—</option>
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && <p className="p-4 text-slate-500">No employees found.</p>}
      </Card>
    </div>
    </DesktopOnlyGate>
  );
}
