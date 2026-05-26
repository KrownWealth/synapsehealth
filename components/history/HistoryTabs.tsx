'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Activity,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  Pill,
  Receipt,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from 'lucide-react';
import type { usePatientDetail } from '@/hooks/usePatientDetail';
import { entriesFromBundle } from '@/lib/patientUtils';
import { ConditionsSection } from './ips/ConditionsSection';
import { AllergiesSection } from './ips/AllergiesSection';
import {
  ClaimsSection,
  DiagnosticReportsSection,
  EncountersSection,
  ImmunizationsSection,
  MedicationsSection,
  ObservationsSection,
  ProceduresSection,
} from './ips/OtherSections';
import { TrialsSection } from './ips/TrialsSection';

type Detail = ReturnType<typeof usePatientDetail>;

type TabKey =
  | 'conditions'
  | 'allergies'
  | 'medications'
  | 'observations'
  | 'immunizations'
  | 'encounters'
  | 'procedures'
  | 'reports'
  | 'claims'
  | 'trials';

interface Tab {
  key: TabKey;
  label: string;
  icon: LucideIcon;
  count?: number;
}

function bundleCount(b: fhir4.Bundle | undefined, resourceType: string): number {
  return entriesFromBundle(b).filter((r) => r.resourceType === resourceType).length;
}

export function HistoryTabs({
  patientId,
  detail,
  renderMedicationAction,
}: {
  patientId: string;
  detail: Detail;
  renderMedicationAction?: (m: fhir4.MedicationRequest) => ReactNode;
}) {
  const [active, setActive] = useState<TabKey>('conditions');

  const tabs: Tab[] = [
    { key: 'conditions',    label: 'Conditions',         icon: Stethoscope,    count: bundleCount(detail.conditions.data, 'Condition') },
    { key: 'allergies',     label: 'Allergies',          icon: AlertTriangle,  count: bundleCount(detail.allergies.data, 'AllergyIntolerance') },
    { key: 'medications',   label: 'Medications',        icon: Pill,           count: bundleCount(detail.medications.data, 'MedicationRequest') },
    { key: 'observations',  label: 'Observations',       icon: FlaskConical,   count: bundleCount(detail.observations.data, 'Observation') },
    { key: 'immunizations', label: 'Immunizations',      icon: Syringe,        count: bundleCount(detail.immunizations.data, 'Immunization') },
    { key: 'encounters',    label: 'Encounters',         icon: Activity,       count: bundleCount(detail.encounters.data, 'Encounter') },
    { key: 'procedures',    label: 'Procedures',         icon: HeartPulse,     count: bundleCount(detail.procedures.data, 'Procedure') },
    { key: 'reports',       label: 'Diagnostic Reports', icon: FileText,       count: bundleCount(detail.diagnosticReports.data, 'DiagnosticReport') },
    { key: 'claims',        label: 'Claims',             icon: Receipt,        count: bundleCount(detail.claims.data, 'Claim') },
    { key: 'trials',        label: 'Clinical Trials',    icon: ClipboardList },
  ];

  return (
    <div className="space-y-4">
      {/* Horizontally scrollable tab bar */}
      <div
        className="overflow-x-auto border-b border-slate-200"
        role="tablist"
        aria-label="Patient history sections"
      >
        <nav className="flex min-w-max gap-1 px-1">
          {tabs.map((t) => {
            const isActive = t.key === active;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(t.key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
                  aria-hidden={true}
                />
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
      </div>

      <div role="tabpanel">
        {active === 'conditions' && (
          <ConditionsSection
            bundle={detail.conditions.data}
            isLoading={detail.conditions.isLoading}
            error={detail.conditions.error}
          />
        )}
        {active === 'allergies' && (
          <AllergiesSection
            bundle={detail.allergies.data}
            isLoading={detail.allergies.isLoading}
            error={detail.allergies.error}
          />
        )}
        {active === 'medications' && (
          <MedicationsSection
            bundle={detail.medications.data}
            isLoading={detail.medications.isLoading}
            error={detail.medications.error}
            renderAction={renderMedicationAction}
          />
        )}
        {active === 'observations' && (
          <ObservationsSection
            bundle={detail.observations.data}
            isLoading={detail.observations.isLoading}
            error={detail.observations.error}
          />
        )}
        {active === 'immunizations' && (
          <ImmunizationsSection
            bundle={detail.immunizations.data}
            isLoading={detail.immunizations.isLoading}
            error={detail.immunizations.error}
          />
        )}
        {active === 'encounters' && (
          <EncountersSection
            bundle={detail.encounters.data}
            isLoading={detail.encounters.isLoading}
            error={detail.encounters.error}
          />
        )}
        {active === 'procedures' && (
          <ProceduresSection
            bundle={detail.procedures.data}
            isLoading={detail.procedures.isLoading}
            error={detail.procedures.error}
          />
        )}
        {active === 'reports' && (
          <DiagnosticReportsSection
            bundle={detail.diagnosticReports.data}
            isLoading={detail.diagnosticReports.isLoading}
            error={detail.diagnosticReports.error}
          />
        )}
        {active === 'claims' && (
          <ClaimsSection
            bundle={detail.claims.data}
            isLoading={detail.claims.isLoading}
            error={detail.claims.error}
          />
        )}
        {active === 'trials' && <TrialsSection patientId={patientId} />}
      </div>
    </div>
  );
}
