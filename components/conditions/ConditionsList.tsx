import { AlertTriangle } from 'lucide-react';
import { conditionsFromBundle } from '@/lib/patientUtils';
import { formatDate } from '@/lib/dateUtils';
import { hasInfectionSource, isInfectionCondition } from '@/lib/infectionFlags';
import { EmptyState } from '@/components/ui/EmptyState';

export function ConditionsList({ bundle }: { bundle: fhir4.Bundle | undefined }) {
  const conditions = conditionsFromBundle(bundle);
  if (conditions.length === 0) {
    return <EmptyState title="No active conditions on record" />;
  }

  const flagged = hasInfectionSource(conditions);

  return (
    <div className="space-y-3">
      {flagged && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-amber-900">
            <span className="font-semibold">Possible infection source.</span> One or more active
            conditions match infection keywords.
          </p>
        </div>
      )}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {conditions.map((c) => (
          <ConditionRow key={c.id ?? `${c.code?.text}-${c.onsetDateTime ?? ''}`} condition={c} />
        ))}
      </ul>
    </div>
  );
}

function ConditionRow({ condition }: { condition: fhir4.Condition }) {
  const name =
    condition.code?.text ??
    condition.code?.coding?.find((c) => c.display)?.display ??
    'Unnamed condition';
  const category = condition.category?.[0]?.coding?.[0]?.code ?? condition.category?.[0]?.text;
  const flagged = isInfectionCondition(condition);

  return (
    <li className={`flex items-start justify-between gap-3 p-3 text-sm ${flagged ? 'border-l-4 border-amber-400' : ''}`}>
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{name}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {category && <span className="mr-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">{category}</span>}
          Onset {formatDate(condition.onsetDateTime)}
        </p>
      </div>
    </li>
  );
}
