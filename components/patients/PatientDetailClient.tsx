'use client';

import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePatientDetail } from '@/hooks/usePatientDetail';
import { buildVitalSnapshot } from '@/lib/vitalsUtils';
import { computeSepsisScore } from '@/lib/scoring';
import { calculateAge, formatDate } from '@/lib/dateUtils';
import { fullName, initials, medicationsFromBundle } from '@/lib/patientUtils';
import { hasActiveAntibiotic } from '@/lib/infectionFlags';
import { RiskBadge } from '@/components/sepsis/RiskBadge';
import { SepsisRiskPanel } from '@/components/sepsis/SepsisRiskPanel';
import { VitalsGrid } from '@/components/vitals/VitalsGrid';
import { VitalsTrendChart } from '@/components/vitals/VitalsTrendChart';
import { ConditionsList } from '@/components/conditions/ConditionsList';
import { MedicationsList } from '@/components/medications/MedicationsList';
import { PatientForm } from './PatientForm';
import { Modal } from '@/components/ui/Modal';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorPanel } from '@/components/ui/ErrorPanel';

export function PatientDetailClient({ patientId }: { patientId: string }) {
  const { patient, vitals, conditions, medications } = usePatientDetail(patientId);
  const [editOpen, setEditOpen] = useState(false);

  const snapshot = useMemo(() => (vitals.data ? buildVitalSnapshot(vitals.data) : undefined), [vitals.data]);
  const score = useMemo(() => (snapshot ? computeSepsisScore(snapshot) : undefined), [snapshot]);
  const antibioticActive = useMemo(
    () => (medications.data ? hasActiveAntibiotic(medicationsFromBundle(medications.data)) : false),
    [medications.data],
  );
  const spo2Missing = snapshot?.spo2 == null;

  if (patient.error) {
    return (
      <ErrorPanel
        title="Could not load patient"
        message={patient.error instanceof Error ? patient.error.message : 'Unknown error'}
      />
    );
  }

  const pt = patient.data;
  const age = calculateAge(pt?.birthDate);
  const gender = pt?.gender ? pt.gender.charAt(0).toUpperCase() + pt.gender.slice(1) : 'Unknown';

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          All patients
        </Link>
      </div>

      <section
        aria-label="Patient demographics"
        className="sticky top-[57px] z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-700">
              {pt ? initials(pt) : '?'}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{pt ? fullName(pt) : 'Loading…'}</h1>
              <p className="text-xs text-slate-500">
                {gender} · {age != null ? `${age} yrs` : 'Age unknown'} · DOB {formatDate(pt?.birthDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {score ? <RiskBadge tier={score.tier} size="md" /> : null}
            {pt?.id && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Sepsis risk">
        {vitals.isLoading && !score ? (
          <SkeletonCard className="h-40" />
        ) : vitals.error ? (
          <ErrorPanel
            title="Could not load vitals"
            message={vitals.error instanceof Error ? vitals.error.message : 'Unknown error'}
          />
        ) : score ? (
          <SepsisRiskPanel score={score} antibioticActive={antibioticActive} spo2Missing={spo2Missing} />
        ) : null}
      </section>

      <section aria-labelledby="vitals-heading" className="space-y-3">
        <h2 id="vitals-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Vital Signs
        </h2>
        <VitalsGrid vitals={vitals.data} />
      </section>

      <section aria-labelledby="trend-heading" className="space-y-3">
        <h2 id="trend-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          24-hour Trend
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <VitalsTrendChart patientId={patientId} />
        </div>
      </section>

      <section aria-labelledby="conditions-heading" className="space-y-3">
        <h2 id="conditions-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Active Conditions
        </h2>
        {conditions.isLoading ? (
          <SkeletonCard />
        ) : conditions.error ? (
          <ErrorPanel
            title="Could not load conditions"
            message={conditions.error instanceof Error ? conditions.error.message : 'Unknown error'}
          />
        ) : (
          <ConditionsList bundle={conditions.data} />
        )}
      </section>

      <section aria-labelledby="medications-heading" className="space-y-3">
        <h2 id="medications-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Active Medications
        </h2>
        {medications.isLoading ? (
          <SkeletonCard />
        ) : medications.error ? (
          <ErrorPanel
            title="Could not load medications"
            message={medications.error instanceof Error ? medications.error.message : 'Unknown error'}
          />
        ) : (
          <MedicationsList bundle={medications.data} />
        )}
      </section>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit patient">
        <PatientForm
          mode="edit"
          patientId={patientId}
          onSuccess={() => setEditOpen(false)}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  );
}
