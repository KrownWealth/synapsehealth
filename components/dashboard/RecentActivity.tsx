'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { formatRelative } from '@/lib/dateUtils';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';

function refTail(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const ix = ref.indexOf('/');
  return ix === -1 ? ref : ref.slice(ix + 1);
}

interface ActivityEntry {
  claimId: string;
  patientId?: string;
  patientName?: string;
  medication: string;
  provider?: string;
  created?: string;
}

function entriesFromBundles(
  preAuthClaims: fhir4.Bundle | undefined,
  patients: fhir4.Bundle | undefined,
  meds: fhir4.Bundle | undefined,
): ActivityEntry[] {
  const claims = (preAuthClaims?.entry ?? [])
    .map((e) => e.resource)
    .filter((r): r is fhir4.Claim => r?.resourceType === 'Claim');

  const patientById = new Map<string, fhir4.Patient>();
  for (const e of patients?.entry ?? []) {
    const p = e.resource as fhir4.Patient | undefined;
    if (p?.id) patientById.set(p.id, p);
  }

  const medById = new Map<string, fhir4.MedicationRequest>();
  for (const e of meds?.entry ?? []) {
    const m = e.resource as fhir4.MedicationRequest | undefined;
    if (m?.id) medById.set(m.id, m);
  }

  return claims
    .filter((c) => c.id && c.created)
    .sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
    .map((c): ActivityEntry => {
      const patientId = refTail(c.patient?.reference);
      const patient = patientId ? patientById.get(patientId) : undefined;
      const medId = refTail(c.prescription?.reference);
      const med = medId ? medById.get(medId) : undefined;
      const medText =
        c.item?.[0]?.productOrService?.text ??
        c.item?.[0]?.productOrService?.coding?.[0]?.display ??
        med?.medicationCodeableConcept?.text ??
        med?.medicationCodeableConcept?.coding?.[0]?.display ??
        'Medication';
      const patientName = patient
        ? [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ')
        : undefined;
      return {
        claimId: c.id!,
        patientId,
        patientName,
        medication: medText,
        provider: c.provider?.display,
        created: c.created,
      };
    });
}

export function RecentActivity({
  preAuthClaims,
  patients,
  meds,
  isLoading,
  limit = 5,
}: {
  preAuthClaims: fhir4.Bundle | undefined;
  patients: fhir4.Bundle | undefined;
  meds: fhir4.Bundle | undefined;
  isLoading?: boolean;
  limit?: number;
}) {
  const entries = entriesFromBundles(preAuthClaims, patients, meds).slice(0, limit);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent activity
        </h2>
        <Link
          href="/medication/prior-auth"
          className="text-xs text-indigo-600 hover:text-indigo-700"
        >
          View all submitted →
        </Link>
      </div>

      {isLoading ? (
        <SkeletonCard />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          message="Submitted prior authorizations will appear here."
        />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {entries.map((e) => (
            <li key={e.claimId} className="border-b border-slate-100 last:border-0">
              <Link
                href={`/medication/prior-auth/${e.claimId}`}
                className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50"
              >
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600"
                  aria-hidden={true}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-900">
                    Submitted <span className="font-medium">{e.medication}</span>
                    {e.patientName ? (
                      <>
                        {' for '}
                        <span className="font-medium">{e.patientName}</span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatRelative(e.created)}
                    {e.provider ? ` · ${e.provider}` : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
