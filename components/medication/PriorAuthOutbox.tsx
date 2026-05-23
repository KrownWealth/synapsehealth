'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { formatDateTime, formatRelative } from '@/lib/dateUtils';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { EmptyState } from '@/components/ui/EmptyState';

function refTail(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const ix = ref.indexOf('/');
  return ix === -1 ? ref : ref.slice(ix + 1);
}

interface OutboxRow {
  claimId: string;
  patientId?: string;
  patientName?: string;
  medication: string;
  provider?: string;
  created?: string;
}

export function PriorAuthOutbox() {
  const { patients, medications, preAuthClaims } = useDashboard();

  const rows: OutboxRow[] = useMemo(() => {
    const claims = (preAuthClaims.data?.entry ?? [])
      .map((e) => e.resource)
      .filter((r): r is fhir4.Claim => r?.resourceType === 'Claim')
      .filter((c) => c.use === 'preauthorization');

    const patientById = new Map<string, fhir4.Patient>();
    for (const e of patients.data?.entry ?? []) {
      const p = e.resource as fhir4.Patient | undefined;
      if (p?.id) patientById.set(p.id, p);
    }

    const medById = new Map<string, fhir4.MedicationRequest>();
    for (const e of medications.data?.entry ?? []) {
      const m = e.resource as fhir4.MedicationRequest | undefined;
      if (m?.id) medById.set(m.id, m);
    }

    return claims
      .filter((c) => c.id)
      .sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
      .map((c): OutboxRow => {
        const patientId = refTail(c.patient?.reference);
        const patient = patientId ? patientById.get(patientId) : undefined;
        const medId = refTail(c.prescription?.reference);
        const med = medId ? medById.get(medId) : undefined;
        return {
          claimId: c.id!,
          patientId,
          patientName: patient
            ? [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ')
            : undefined,
          medication:
            c.item?.[0]?.productOrService?.text ??
            c.item?.[0]?.productOrService?.coding?.[0]?.display ??
            med?.medicationCodeableConcept?.text ??
            med?.medicationCodeableConcept?.coding?.[0]?.display ??
            'Medication',
          provider: c.provider?.display,
          created: c.created,
        };
      });
  }, [preAuthClaims.data, patients.data, medications.data]);

  const loading = patients.isLoading || preAuthClaims.isLoading;
  const error = preAuthClaims.error;

  if (loading) return <SkeletonCard />;
  if (error)
    return (
      <ErrorPanel
        title="Could not load submitted PAs"
        message={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
  if (rows.length === 0)
    return (
      <EmptyState
        title="No submitted prior authorizations yet"
        message="Submit a PA from the Doctor Task List to populate this outbox."
      />
    );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="hidden grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:grid">
        <div className="col-span-3">Submitted</div>
        <div className="col-span-3">Patient</div>
        <div className="col-span-3">Medication</div>
        <div className="col-span-2">Provider</div>
        <div className="col-span-1"></div>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.claimId}>
            <Link
              href={`/medication/prior-auth/${r.claimId}`}
              className="grid grid-cols-1 gap-1 px-4 py-3 hover:bg-slate-50 sm:grid-cols-12 sm:gap-3"
            >
              <div className="col-span-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">{formatRelative(r.created)}</p>
                <p className="text-[11px] text-slate-500">{formatDateTime(r.created)}</p>
              </div>
              <div className="col-span-3 truncate text-sm text-slate-900 sm:font-medium">
                {r.patientName ?? '—'}
              </div>
              <div className="col-span-3 truncate text-sm text-slate-700">{r.medication}</div>
              <div className="col-span-2 truncate text-xs text-slate-600">
                {r.provider ?? '—'}
              </div>
              <div className="col-span-1 flex items-center justify-end text-slate-400">
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
