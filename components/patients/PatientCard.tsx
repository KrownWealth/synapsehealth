'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchVitals } from '@/lib/fhirClient';
import { buildVitalSnapshot } from '@/lib/vitalsUtils';
import { computeSepsisScore } from '@/lib/scoring';
import { calculateAge, formatDate } from '@/lib/dateUtils';
import { fullName, initials } from '@/lib/patientUtils';
import { RiskBadge } from '@/components/sepsis/RiskBadge';

export function PatientCard({ patient }: { patient: fhir4.Patient }) {
  const id = patient.id!;
  const { data: vitals, isLoading } = useQuery({
    queryKey: ['vitals', id],
    queryFn: () => fetchVitals(id),
  });

  const snapshot = vitals ? buildVitalSnapshot(vitals) : undefined;
  const score = snapshot ? computeSepsisScore(snapshot) : undefined;
  const age = calculateAge(patient.birthDate);
  const gender = patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'Unknown';

  return (
    <Link
      href={`/patients/${id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
          {initials(patient)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold text-slate-900">{fullName(patient)}</p>
            {score ? (
              <RiskBadge tier={score.tier} />
            ) : isLoading ? (
              <span className="h-5 w-16 animate-pulse rounded-full bg-slate-100" aria-label="Loading risk" />
            ) : (
              <RiskBadge tier="low" />
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {gender} · {age != null ? `${age} yrs` : 'Age unknown'} · DOB {formatDate(patient.birthDate)}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <ScoreChip label="qSOFA" value={score ? `${score.qsofa.score}/3` : '—'} loading={isLoading && !score} />
            <ScoreChip label="NEWS2" value={score ? `${score.news2.total}/20` : '—'} loading={isLoading && !score} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function ScoreChip({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {loading ? (
        <span className="h-3 w-6 animate-pulse rounded bg-slate-200" />
      ) : (
        <span className="font-semibold">{value}</span>
      )}
    </span>
  );
}
