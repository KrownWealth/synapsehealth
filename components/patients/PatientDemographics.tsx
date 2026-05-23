'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { calculateAge, formatDate } from '@/lib/dateUtils';
import { fullName, initials } from '@/lib/patientUtils';

function joinAddress(addr: fhir4.Address | undefined): string | undefined {
  if (!addr) return undefined;
  const parts = [addr.line?.join(', '), addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function telecomList(p: fhir4.Patient | undefined): { system: string; value: string }[] {
  return (p?.telecom ?? []).map((t) => ({ system: t.system ?? 'contact', value: t.value ?? '' })).filter((t) => t.value);
}

function identifierList(p: fhir4.Patient | undefined): { type: string; value: string }[] {
  return (p?.identifier ?? []).map((i) => ({
    type: i.type?.text ?? i.type?.coding?.[0]?.code ?? i.system ?? 'id',
    value: i.value ?? '',
  })).filter((i) => i.value);
}

export function PatientDemographics({ patient }: { patient: fhir4.Patient | undefined }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!patient) {
    return <div className="h-32 animate-pulse rounded-xl bg-slate-100" />;
  }

  const age = calculateAge(patient.birthDate);
  const gender = patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'Unknown';
  const address = joinAddress(patient.address?.[0]);
  const telecoms = telecomList(patient);
  const identifiers = identifierList(patient);
  const maritalStatus = patient.maritalStatus?.text ?? patient.maritalStatus?.coding?.[0]?.display;
  const languages = (patient.communication ?? [])
    .map((c) => c.language?.text ?? c.language?.coding?.[0]?.display)
    .filter(Boolean) as string[];

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-700">
          {initials(patient)}
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-900">{fullName(patient)}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {gender} · {age != null ? `${age} yrs` : 'Age unknown'} · DOB {formatDate(patient.birthDate)}
          </p>
          {patient.id && (
            <p className="mt-0.5 text-xs text-slate-400">
              <code className="rounded bg-slate-100 px-1.5 py-0.5">Patient/{patient.id}</code>
            </p>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-slate-200 px-5 py-4 text-sm sm:grid-cols-2">
        <Row label="Identifiers">
          {identifiers.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            <ul className="space-y-0.5">
              {identifiers.map((i, idx) => (
                <li key={idx}>
                  <span className="text-slate-500">{i.type}:</span> <code className="text-xs">{i.value}</code>
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label="Marital status">{maritalStatus ?? <span className="text-slate-400">—</span>}</Row>
        <Row label="Address">{address ?? <span className="text-slate-400">—</span>}</Row>
        <Row label="Languages">{languages.length ? languages.join(', ') : <span className="text-slate-400">—</span>}</Row>
        <Row label="Contact">
          {telecoms.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            <ul className="space-y-0.5">
              {telecoms.map((t, idx) => (
                <li key={idx}>
                  <span className="text-slate-500">{t.system}:</span> {t.value}
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label="Active">{patient.active === false ? 'No' : 'Yes'}</Row>
      </dl>

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="flex w-full items-center justify-between border-t border-slate-200 px-5 py-2 text-xs text-slate-500 hover:bg-slate-50"
        aria-expanded={showRaw}
      >
        <span>Show raw FHIR Patient resource</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showRaw ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {showRaw && (
        <pre className="overflow-x-auto bg-slate-900 px-5 py-3 text-[11px] leading-relaxed text-slate-100">
{JSON.stringify(patient, null, 2)}
        </pre>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}
