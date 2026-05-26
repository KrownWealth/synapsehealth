'use client';

import { entriesFromBundle } from '@/lib/patientUtils';
import { IpsSectionCard } from '../IpsSectionCard';
import { CodeBox, Pill, severityTone, statusTone } from './Pill';

function codeText(cc: fhir4.CodeableConcept | undefined): string | undefined {
  if (!cc) return undefined;
  return cc.text ?? cc.coding?.find((c) => c.display)?.display ?? cc.coding?.[0]?.code;
}

function snomed(cc: fhir4.CodeableConcept | undefined): { code?: string; display?: string } {
  const c = cc?.coding?.find((x) => x.system?.includes('snomed')) ?? cc?.coding?.[0];
  return { code: c?.code, display: c?.display };
}

export function AllergiesSection({
  bundle,
  isLoading,
  error,
}: {
  bundle: fhir4.Bundle | undefined;
  isLoading?: boolean;
  error?: unknown;
}) {
  const allergies = entriesFromBundle(bundle).filter(
    (r): r is fhir4.AllergyIntolerance => r.resourceType === 'AllergyIntolerance',
  );

  return (
    <IpsSectionCard
      title="Allergies & Intolerances"
      loinc="LOINC 48765-2"
      count={allergies.length}
      isLoading={isLoading}
      error={error}
    >
      <ul className="divide-y divide-slate-200">
        {allergies.map((a) => {
          const clinical = a.clinicalStatus?.coding?.[0]?.code;
          const verification = a.verificationStatus?.coding?.[0]?.code;
          const type = a.type;
          const code = snomed(a.code);
          return (
            <li key={a.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {codeText(a.code) ?? 'Allergy'}
                </p>
                {clinical && <Pill tone={statusTone(clinical)}>{clinical}</Pill>}
                {verification && <Pill tone={statusTone(verification)}>{verification}</Pill>}
                {type && <Pill tone="slate">{type}</Pill>}
              </div>

              {code.code && (
                <div>
                  <CodeBox>
                    <span className="font-medium text-slate-700">SNOMED {code.code}</span>
                    {code.display ? <span className="ml-2">{code.display}</span> : null}
                  </CodeBox>
                </div>
              )}

              {(a.reaction ?? []).map((r, ri) => {
                const sev = r.severity;
                const manifestation = r.manifestation?.[0];
                const manifestationCode = snomed(manifestation);
                const manifestationText = codeText(manifestation);
                return (
                  <div key={ri} className="space-y-1.5 pl-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-500">Reaction</span>
                      {sev && <Pill tone={severityTone(sev)}>{sev}</Pill>}
                    </div>
                    {manifestationText && (
                      <p className="text-sm text-slate-800">{manifestationText}</p>
                    )}
                    {manifestationCode.code && (
                      <div>
                        <CodeBox>
                          <span className="font-medium text-slate-700">
                            SNOMED {manifestationCode.code}
                          </span>
                          {manifestationCode.display ? (
                            <span className="ml-2">{manifestationCode.display}</span>
                          ) : null}
                        </CodeBox>
                      </div>
                    )}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>
    </IpsSectionCard>
  );
}
