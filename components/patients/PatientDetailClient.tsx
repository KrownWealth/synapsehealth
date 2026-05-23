'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePatientDetail } from '@/hooks/usePatientDetail';
import { PatientDemographics } from './PatientDemographics';
import { ResourceSection } from '@/components/history/ResourceSection';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { GeneratePaButton } from '@/components/priorAuth/GeneratePaButton';

export function PatientDetailClient({ patientId }: { patientId: string }) {
  const detail = usePatientDetail(patientId);

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

  const sections: Array<{
    title: string;
    resourceType: string;
    bundle: ReturnType<typeof usePatientDetail>['conditions'];
    renderAction?: (r: fhir4.Resource) => ReactNode;
  }> = [
    { title: 'Conditions',         resourceType: 'Condition',         bundle: detail.conditions },
    { title: 'Observations',       resourceType: 'Observation',       bundle: detail.observations },
    { title: 'Medications',        resourceType: 'MedicationRequest', bundle: detail.medications, renderAction: renderMedicationAction },
    { title: 'Allergies',          resourceType: 'AllergyIntolerance', bundle: detail.allergies },
    { title: 'Immunizations',      resourceType: 'Immunization',      bundle: detail.immunizations },
    { title: 'Encounters',         resourceType: 'Encounter',         bundle: detail.encounters },
    { title: 'Procedures',         resourceType: 'Procedure',         bundle: detail.procedures },
    { title: 'Diagnostic Reports', resourceType: 'DiagnosticReport',  bundle: detail.diagnosticReports },
    { title: 'Claims',             resourceType: 'Claim',             bundle: detail.claims },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Patient List
      </Link>

      <PatientDemographics patient={detail.patient.data} />

      <div className="space-y-3">
        {sections.map((s) => (
          <ResourceSection
            key={s.resourceType}
            title={s.title}
            resourceType={s.resourceType}
            bundle={s.bundle.data}
            isLoading={s.bundle.isLoading}
            error={s.bundle.error}
            defaultOpen={false}
            renderAction={s.renderAction}
          />
        ))}
      </div>
    </div>
  );
}
