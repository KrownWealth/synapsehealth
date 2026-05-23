'use client';

import { useState, type ReactNode } from 'react';
import type { usePatientDetail } from '@/hooks/usePatientDetail';
import { entriesFromBundle } from '@/lib/patientUtils';
import { OverviewTab } from './OverviewTab';
import { RichResourceList } from './RichResourceList';

type Detail = ReturnType<typeof usePatientDetail>;

type TabKey =
  | 'overview'
  | 'conditions'
  | 'medications'
  | 'observations'
  | 'allergies'
  | 'immunizations'
  | 'encounters'
  | 'procedures'
  | 'diagnostic-reports'
  | 'claims';

interface Tab {
  key: TabKey;
  label: string;
  count?: number;
}

function bundleCount(b: fhir4.Bundle | undefined, resourceType: string): number {
  return entriesFromBundle(b).filter((r) => r.resourceType === resourceType).length;
}

export function HistoryTabs({
  detail,
  renderMedicationAction,
}: {
  detail: Detail;
  renderMedicationAction?: (resource: fhir4.Resource) => ReactNode;
}) {
  const [active, setActive] = useState<TabKey>('overview');

  const loading =
    detail.conditions.isLoading ||
    detail.medications.isLoading ||
    detail.observations.isLoading ||
    detail.allergies.isLoading ||
    detail.encounters.isLoading;

  const tabs: Tab[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'conditions', label: 'Conditions', count: bundleCount(detail.conditions.data, 'Condition') },
    { key: 'medications', label: 'Medications', count: bundleCount(detail.medications.data, 'MedicationRequest') },
    { key: 'observations', label: 'Observations', count: bundleCount(detail.observations.data, 'Observation') },
    { key: 'allergies', label: 'Allergies', count: bundleCount(detail.allergies.data, 'AllergyIntolerance') },
    { key: 'immunizations', label: 'Immunizations', count: bundleCount(detail.immunizations.data, 'Immunization') },
    { key: 'encounters', label: 'Encounters', count: bundleCount(detail.encounters.data, 'Encounter') },
    { key: 'procedures', label: 'Procedures', count: bundleCount(detail.procedures.data, 'Procedure') },
    { key: 'diagnostic-reports', label: 'Reports', count: bundleCount(detail.diagnosticReports.data, 'DiagnosticReport') },
    { key: 'claims', label: 'Claims', count: bundleCount(detail.claims.data, 'Claim') },
  ];

  return (
    <div className="space-y-4">
      <nav
        role="tablist"
        aria-label="Medical history sections"
        className="-mb-px flex flex-wrap gap-1 border-b border-slate-200"
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className={`relative inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel">
        {active === 'overview' && (
          <OverviewTab
            conditions={detail.conditions.data}
            medications={detail.medications.data}
            allergies={detail.allergies.data}
            encounters={detail.encounters.data}
            observations={detail.observations.data}
            isLoading={loading}
          />
        )}
        {active === 'conditions' && (
          <RichResourceList
            title="Conditions"
            resourceType="Condition"
            bundle={detail.conditions.data}
            isLoading={detail.conditions.isLoading}
            error={detail.conditions.error}
          />
        )}
        {active === 'medications' && (
          <RichResourceList
            title="Medications"
            resourceType="MedicationRequest"
            bundle={detail.medications.data}
            isLoading={detail.medications.isLoading}
            error={detail.medications.error}
            renderAction={renderMedicationAction}
          />
        )}
        {active === 'observations' && (
          <RichResourceList
            title="Observations"
            resourceType="Observation"
            bundle={detail.observations.data}
            isLoading={detail.observations.isLoading}
            error={detail.observations.error}
          />
        )}
        {active === 'allergies' && (
          <RichResourceList
            title="Allergies"
            resourceType="AllergyIntolerance"
            bundle={detail.allergies.data}
            isLoading={detail.allergies.isLoading}
            error={detail.allergies.error}
          />
        )}
        {active === 'immunizations' && (
          <RichResourceList
            title="Immunizations"
            resourceType="Immunization"
            bundle={detail.immunizations.data}
            isLoading={detail.immunizations.isLoading}
            error={detail.immunizations.error}
          />
        )}
        {active === 'encounters' && (
          <RichResourceList
            title="Encounters"
            resourceType="Encounter"
            bundle={detail.encounters.data}
            isLoading={detail.encounters.isLoading}
            error={detail.encounters.error}
          />
        )}
        {active === 'procedures' && (
          <RichResourceList
            title="Procedures"
            resourceType="Procedure"
            bundle={detail.procedures.data}
            isLoading={detail.procedures.isLoading}
            error={detail.procedures.error}
          />
        )}
        {active === 'diagnostic-reports' && (
          <RichResourceList
            title="Diagnostic Reports"
            resourceType="DiagnosticReport"
            bundle={detail.diagnosticReports.data}
            isLoading={detail.diagnosticReports.isLoading}
            error={detail.diagnosticReports.error}
          />
        )}
        {active === 'claims' && (
          <RichResourceList
            title="Claims"
            resourceType="Claim"
            bundle={detail.claims.data}
            isLoading={detail.claims.isLoading}
            error={detail.claims.error}
          />
        )}
      </div>
    </div>
  );
}
