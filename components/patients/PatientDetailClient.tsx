'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { usePatientDetail } from '@/hooks/usePatientDetail';
import { PatientDemographics } from './PatientDemographics';
import { EditPatientModal } from './EditPatientModal';
import { HistoryTabs } from '@/components/history/HistoryTabs';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { GeneratePaButton } from '@/components/priorAuth/GeneratePaButton';

export function PatientDetailClient({ patientId }: { patientId: string }) {
  const detail = usePatientDetail(patientId);
  const [editOpen, setEditOpen] = useState(false);

  if (detail.patient.error) {
    return (
      <ErrorPanel
        title="Could not load patient"
        message={detail.patient.error instanceof Error ? detail.patient.error.message : 'Unknown error'}
      />
    );
  }

  const renderMedicationAction = (r: fhir4.Resource) => {
    if (r.resourceType !== 'MedicationRequest') return null;
    return <GeneratePaButton patientId={patientId} medicationRequest={r as fhir4.MedicationRequest} />;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Patient List
        </Link>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          disabled={!detail.patient.data}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden={true} />
          Edit
        </button>
      </div>

      <PatientDemographics patient={detail.patient.data} />

      <EditPatientModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        patient={detail.patient.data}
      />

      <HistoryTabs detail={detail} renderMedicationAction={renderMedicationAction} />
    </div>
  );
}
