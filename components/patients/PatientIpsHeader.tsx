'use client';

import { calculateAge, formatDate } from '@/lib/dateUtils';
import { fullName, initials } from '@/lib/patientUtils';

function mrnOf(p: fhir4.Patient | undefined): string | undefined {
  if (!p?.identifier?.length) return undefined;
  // Prefer an identifier whose type contains "MR" (medical record number).
  const mr = p.identifier.find((i) =>
    i.type?.coding?.some((c) => c.code === 'MR') || /mrn|mr/i.test(i.type?.text ?? ''),
  );
  return (mr ?? p.identifier[0])?.value;
}

function ipsGeneratedToday(): string {
  return new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function MetaColumn({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

export function PatientIpsHeader({ patient }: { patient: fhir4.Patient | undefined }) {
  if (!patient) {
    return <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />;
  }

  const age = calculateAge(patient.birthDate);
  const sex = patient.gender
    ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
    : '—';
  const mrn = mrnOf(patient);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-base font-semibold text-white">
            {initials(patient)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">{fullName(patient)}</h1>
            {mrn && (
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-medium uppercase tracking-wide">MRN:</span>{' '}
                <span className="font-mono text-slate-700">{mrn}</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 lg:grid-cols-3 lg:gap-x-12">
          <MetaColumn
            label="Date of birth"
            value={
              <>
                {formatDate(patient.birthDate)}
                {age != null && (
                  <span className="ml-1 text-xs font-normal text-slate-500">({age} yrs)</span>
                )}
              </>
            }
          />
          <MetaColumn label="Sex" value={sex} />
          <MetaColumn label="IPS generated" value={ipsGeneratedToday()} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-6 py-3">
        <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-[11px] font-medium text-orange-700 ring-1 ring-orange-200">
          International Patient Summary
        </span>
        <span className="text-[11px] uppercase tracking-wide text-slate-500">HL7 FHIR IPS STU2</span>
      </div>
    </section>
  );
}
