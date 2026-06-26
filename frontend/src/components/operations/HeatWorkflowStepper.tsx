import { workflowStepsForUi } from '../../utils/heatWorkflowUi';

interface HeatWorkflowStepperProps {
  currentState: string;
}

export function HeatWorkflowStepper({ currentState }: HeatWorkflowStepperProps) {
  const steps = workflowStepsForUi(currentState);

  return (
    <div className="mb-4 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((step, idx) => (
          <li key={step.key} className="flex items-center">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                step.isCurrent
                  ? 'bg-brand-600 text-white'
                  : step.isComplete
                    ? 'bg-brand-100 text-brand-800'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  step.isCurrent
                    ? 'bg-white/20'
                    : step.isComplete
                      ? 'bg-brand-200'
                      : 'bg-slate-200'
                }`}
              >
                {step.isComplete ? '✓' : idx + 1}
              </span>
              {step.label}
            </div>
            {idx < steps.length - 1 && (
              <span className={`mx-1 h-px w-6 ${step.isComplete ? 'bg-brand-300' : 'bg-slate-200'}`} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
