import { Link } from 'react-router-dom';
import type { Department, Organisation, Plant, Process, ProcessInstance } from '../../types';
import { Card } from '../ui/Card';

interface OrgHierarchyProps {
  organisations: Organisation[];
  plants: Plant[];
  departments: Department[];
  processes: Process[];
  instances: ProcessInstance[];
}

export function OrgHierarchyTree({
  organisations,
  plants,
  departments,
  processes,
  instances,
}: OrgHierarchyProps) {
  if (organisations.length === 0) {
    return <p className="text-sm text-slate-500">No organisations configured.</p>;
  }

  return (
    <div className="space-y-4">
      {organisations.map((org) => {
        const orgPlants = plants.filter((p) => p.organisation_id === org.id);
        return (
          <div key={org.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{org.name}</p>
                <p className="text-xs text-slate-500">{org.code}</p>
              </div>
              <Link to="/admin/organisations" className="text-xs font-medium text-brand-600 hover:underline">
                View
              </Link>
            </div>

            {orgPlants.map((plant) => {
              const plantDepts = departments.filter((d) => d.plant_id === plant.id);
              return (
                <div key={plant.id} className="ml-4 mt-3 border-l-2 border-brand-200 pl-4">
                  <p className="text-sm font-medium text-slate-800">
                    {plant.name} <span className="text-slate-400">({plant.code})</span>
                  </p>
                  {plantDepts.map((dept) => {
                    const deptProcesses = processes.filter((p) => p.department_id === dept.id);
                    return (
                      <div key={dept.id} className="ml-3 mt-2 border-l border-slate-200 pl-3">
                        <p className="text-sm text-slate-700">{dept.name}</p>
                        <ul className="mt-1 space-y-1">
                          {deptProcesses.map((proc) => {
                            const procInstances = instances.filter((i) => i.process_id === proc.id);
                            return (
                              <li key={proc.id} className="text-xs text-slate-600">
                                <span className="font-medium">{proc.code}</span> — {proc.name}
                                {procInstances.length > 0 && (
                                  <span className="ml-2 text-slate-400">
                                    ({procInstances.map((i) => i.name).join(', ')})
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function OrgHierarchyCard(props: OrgHierarchyProps) {
  return (
    <Card title="Organisation hierarchy">
      <OrgHierarchyTree {...props} />
    </Card>
  );
}
