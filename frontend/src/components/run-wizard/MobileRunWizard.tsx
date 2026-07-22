import { useEffect, useMemo, useState } from 'react';
import type {
  ChemistrySectionData,
  MaterialSectionData,
  ProductionLogSectionData,
  SampleChemistrySectionData,
  SectionRenderContext,
  TemplateSection,
  WorkflowTransition,
} from '../../types';
import type { SectionDataMap } from '../logsheet/SectionRenderer';
import { HeatWorkflowStepper } from '../operations/HeatWorkflowStepper';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  isIafHeatTemplate,
  transitionHint,
  transitionsForTab,
} from '../../utils/heatWorkflowUi';
import { buildCardSteps, type CardStep } from './buildCardSteps';
import { CardStepBody } from './CardStepBody';
import type { DelayRegisterSectionData } from '../logsheet/DelayRegisterTable';
import type { BlowProcessSectionData } from '../../types';
import { getHourlyMatrixConfig } from '../logsheet/HourlyProductionMatrix';
import { useWakeLock } from '../../hooks/useWakeLock';

interface Props {
  runNumber: string;
  currentState: string;
  sections: TemplateSection[];
  sectionData: SectionDataMap;
  onSectionDataChange: (key: string, data: unknown) => void;
  ctx: SectionRenderContext;
  availableTransitions: WorkflowTransition[];
  saving: boolean;
  transitioning: boolean;
  error: string;
  onSaveFields: (keys: string[]) => Promise<void>;
  onSaveSection: (section: TemplateSection) => Promise<void>;
  onTransition: (t: WorkflowTransition) => Promise<void>;
}

function countOptions(sections: TemplateSection[], sectionData: SectionDataMap) {
  const chemistrySampleCount: Record<string, number> = {};
  const materialRowCount: Record<string, number> = {};
  const productionRowCount: Record<string, number> = {};
  const delayRowCount: Record<string, number> = {};
  const matrixRowCount: Record<string, number> = {};
  const sampleChemRowCount: Record<string, number> = {};
  const hourlyHours: Record<string, string[]> = {};

  for (const s of sections) {
    const data = sectionData[s.key];
    if (s.section_type === 'table' && s.key === 'chemistry') {
      const chem = data as ChemistrySectionData | undefined;
      const rows = chem?.rows ?? [];
      chemistrySampleCount[s.key] = Math.max(
        1,
        rows.reduce((m, r) => Math.max(m, r.samples?.length ?? 0), 0),
      );
    }
    if (s.section_type === 'repeatable_group') {
      materialRowCount[s.key] = (data as MaterialSectionData | undefined)?.rows?.length ?? 0;
    }
    if (s.section_type === 'production_log_table' || s.section_type === 'production_register_table') {
      productionRowCount[s.key] = Math.max(
        1,
        (data as ProductionLogSectionData | undefined)?.rows?.length ?? 1,
      );
    }
    if (s.section_type === 'delay_register_table') {
      delayRowCount[s.key] = Math.max(
        1,
        (data as DelayRegisterSectionData | undefined)?.rows?.length ?? 1,
      );
    }
    if (s.section_type === 'matrix_table') {
      matrixRowCount[s.key] = Math.max(
        1,
        (data as BlowProcessSectionData | undefined)?.rows?.length ?? 1,
      );
    }
    if (s.section_type === 'sample_chemistry_matrix') {
      sampleChemRowCount[s.key] = Math.max(
        1,
        (data as SampleChemistrySectionData | undefined)?.rows?.length ??
          ((s.config.sample_rows as string[] | undefined)?.length ?? 1),
      );
    }
    if (s.section_type === 'hourly_production_matrix') {
      hourlyHours[s.key] = getHourlyMatrixConfig(s).hours;
    }
  }

  return {
    chemistrySampleCount,
    materialRowCount,
    productionRowCount,
    delayRowCount,
    matrixRowCount,
    sampleChemRowCount,
    hourlyHours,
  };
}

export function MobileRunWizard({
  runNumber,
  currentState,
  sections,
  sectionData,
  onSectionDataChange,
  ctx,
  availableTransitions,
  saving,
  transitioning,
  error,
  onSaveFields,
  onSaveSection,
  onTransition,
}: Props) {
  useWakeLock(true);

  const useGuided = isIafHeatTemplate(sections.map((s) => s.key));
  const stepOptions = useMemo(
    () => countOptions(sections, sectionData),
    [sections, sectionData],
  );
  const steps = useMemo(
    () => buildCardSteps(sections, stepOptions),
    [sections, stepOptions],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [localError, setLocalError] = useState('');

  // Keep index in range when steps rebuild (add row, etc.)
  useEffect(() => {
    if (stepIndex >= steps.length) setStepIndex(Math.max(0, steps.length - 1));
  }, [steps.length, stepIndex]);

  // Scroll focused inputs into view above keyboard
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      setTimeout(() => {
        t.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 300);
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);

  const step: CardStep | undefined = steps[stepIndex];
  const section = step ? sections.find((s) => s.key === step.sectionKey) : undefined;

  const jumpToStep = (stepId: string) => {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx >= 0) setStepIndex(idx);
  };

  const saveCurrent = async () => {
    if (!section) return;
    setLocalError('');
    try {
      if (section.section_type === 'fields') {
        const keys = section.fields.map((f) => f.name);
        await onSaveFields(keys);
      } else {
        await onSaveSection(section);
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Save failed');
      throw e;
    }
  };

  const goNext = async () => {
    try {
      await saveCurrent();
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    } catch {
      /* error already set */
    }
  };

  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const tabTransitions =
    useGuided && step
      ? transitionsForTab(availableTransitions, step.sectionKey)
      : stepIndex === steps.length - 1
        ? availableTransitions
        : [];

  if (!step || !section) {
    return <p className="p-4 text-center text-slate-500">No sections to fill.</p>;
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col pb-28">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900">{runNumber}</h1>
          <p className="text-xs text-slate-500">
            Step {stepIndex + 1} of {steps.length}
          </p>
        </div>
        <Badge color="blue">{currentState.replace(/_/g, ' ')}</Badge>
      </div>

      {useGuided && <HeatWorkflowStepper currentState={currentState} />}

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">{step.label}</h2>
        {(error || localError) && (
          <p className="mb-3 text-sm text-red-600">{error || localError}</p>
        )}
        <CardStepBody
          step={step}
          section={section}
          sectionData={sectionData}
          onSectionDataChange={onSectionDataChange}
          ctx={ctx}
          onJumpToStep={jumpToStep}
        />

        {tabTransitions.length > 0 && (
          <div className="mt-6 space-y-2 rounded-xl border border-brand-200 bg-brand-50/70 p-3">
            <p className="text-sm font-semibold text-brand-900">Workflow</p>
            {tabTransitions.length === 1 && transitionHint(tabTransitions[0]) && (
              <p className="text-xs text-brand-800/80">{transitionHint(tabTransitions[0])}</p>
            )}
            {tabTransitions.map((t) => (
              <Button
                key={`${t.from_state}-${t.to_state}`}
                size="lg"
                className="w-full"
                variant={t.to_state === 'aborted' ? 'danger' : 'primary'}
                disabled={saving || transitioning}
                onClick={async () => {
                  try {
                    await saveCurrent();
                    await onTransition(t);
                  } catch {
                    /* shown via error */
                  }
                }}
              >
                {transitioning ? 'Working…' : t.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur safe-pb safe-px"
      >
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={stepIndex === 0 || saving}
            onClick={goBack}
          >
            Back
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={saving}
            onClick={() => void saveCurrent()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={saving || stepIndex >= steps.length - 1}
            onClick={() => void goNext()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
