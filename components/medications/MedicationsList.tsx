import { Pill } from 'lucide-react';
import { medicationsFromBundle } from '@/lib/patientUtils';
import { formatDate } from '@/lib/dateUtils';
import { isAntibiotic } from '@/lib/infectionFlags';
import { EmptyState } from '@/components/ui/EmptyState';

export function MedicationsList({ bundle }: { bundle: fhir4.Bundle | undefined }) {
  const medications = medicationsFromBundle(bundle);
  if (medications.length === 0) {
    return <EmptyState title="No active medications on record" />;
  }

  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {medications.map((m) => (
        <MedicationRow key={m.id ?? `${m.medicationCodeableConcept?.text}-${m.authoredOn ?? ''}`} medication={m} />
      ))}
    </ul>
  );
}

function MedicationRow({ medication }: { medication: fhir4.MedicationRequest }) {
  const name =
    medication.medicationCodeableConcept?.text ??
    medication.medicationCodeableConcept?.coding?.find((c) => c.display)?.display ??
    'Unnamed medication';
  const dosage = medication.dosageInstruction?.[0]?.text;
  const flagged = isAntibiotic(medication);

  return (
    <li className="flex items-start justify-between gap-3 p-3 text-sm">
      <div className="flex items-start gap-2 min-w-0">
        <Pill className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">{name}</p>
            {flagged && (
              <span className="inline-flex items-center rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-800">
                Antibiotic
              </span>
            )}
          </div>
          {dosage && <p className="mt-0.5 text-xs text-slate-600">{dosage}</p>}
          <p className="mt-0.5 text-[11px] text-slate-400">
            Prescribed {formatDate(medication.authoredOn)}
            {medication.requester?.display ? ` · ${medication.requester.display}` : ''}
          </p>
        </div>
      </div>
    </li>
  );
}
