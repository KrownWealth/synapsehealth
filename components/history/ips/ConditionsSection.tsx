'use client';

import { entriesFromBundle } from '@/lib/patientUtils';
import { formatDate } from '@/lib/dateUtils';
import { IpsSectionCard } from '../IpsSectionCard';
import { Pill, severityTone, statusTone } from './Pill';

function codeText(cc: fhir4.CodeableConcept | undefined): string | undefined {
  if (!cc) return undefined;
  return cc.text ?? cc.coding?.find((c) => c.display)?.display ?? cc.coding?.[0]?.code;
}

function snomedCode(cc: fhir4.CodeableConcept | undefined): string | undefined {
  return cc?.coding?.find((c) => c.system?.includes('snomed'))?.code ?? cc?.coding?.[0]?.code;
}

export function ConditionsSection({
  bundle,
  isLoading,
  error,
}: {
  bundle: fhir4.Bundle | undefined;
  isLoading?: boolean;
  error?: unknown;
}) {
  const conditions = entriesFromBundle(bundle).filter(
    (r): r is fhir4.Condition => r.resourceType === 'Condition',
  );

  return (
    <IpsSectionCard
      title="Problems / Conditions"
      loinc="LOINC 11450-4"
      count={conditions.length}
      isLoading={isLoading}
      error={error}
    >
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="py-2.5 pr-4 first:pl-5 last:pr-5 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500">Condition</th>
            <th className="py-2.5 pr-4 first:pl-5 last:pr-5 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500">Status</th>
            <th className="py-2.5 pr-4 first:pl-5 last:pr-5 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500">Onset</th>
            <th className="py-2.5 pr-4 first:pl-5 last:pr-5 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500">Severity</th>
            <th className="py-2.5 pr-4 first:pl-5 last:pr-5 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500">Verification</th>
          </tr>
        </thead>
        <tbody>
          {conditions.map((c) => {
            const clinical = c.clinicalStatus?.coding?.[0]?.code;
            const verification = c.verificationStatus?.coding?.[0]?.code;
            const severity = codeText(c.severity);
            const snomed = snomedCode(c.code);
            return (
              <tr key={c.id} className="border-b border-slate-200 last:border-0 align-top">
                <td className="py-3 pr-4 first:pl-5 last:pr-5">
                  <p className="font-medium text-slate-900">{codeText(c.code) ?? 'Condition'}</p>
                  {snomed && (
                    <p className="mt-0.5 text-[11px] text-slate-500">SNOMED: {snomed}</p>
                  )}
                </td>
                <td className="py-3 pr-4 first:pl-5 last:pr-5">
                  {clinical && <Pill tone={statusTone(clinical)}>{clinical}</Pill>}
                </td>
                <td className="py-3 pr-4 first:pl-5 last:pr-5 text-slate-700">{formatDate(c.onsetDateTime)}</td>
                <td className="py-3 pr-4 first:pl-5 last:pr-5">
                  {severity && <Pill tone={severityTone(severity)}>{severity}</Pill>}
                </td>
                <td className="py-3 pr-4 first:pl-5 last:pr-5">
                  {verification && <Pill tone={statusTone(verification)}>{verification}</Pill>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </IpsSectionCard>
  );
}
