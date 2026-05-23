import { fullName } from './patientUtils';

export type UrgencyTier = 'overdue' | 'this-week' | 'fresh';

export interface WorklistItem {
  medicationRequestId: string;
  patientId: string;
  patientName: string;
  medication: string;
  authoredOn?: string;
  daysAgo: number | undefined;
  urgency: UrgencyTier;
  submitted: boolean;
  submittedClaimId?: string;
}

function daysAgoFrom(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return undefined;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function urgencyOf(days: number | undefined): UrgencyTier {
  if (days == null) return 'this-week';
  if (days >= 7) return 'overdue';
  if (days >= 2) return 'this-week';
  return 'fresh';
}

function patientsFrom(bundle: fhir4.Bundle | undefined): fhir4.Patient[] {
  if (!bundle?.entry) return [];
  return bundle.entry
    .map((e) => e.resource)
    .filter((r): r is fhir4.Patient => r?.resourceType === 'Patient');
}

function medsFrom(bundle: fhir4.Bundle | undefined): fhir4.MedicationRequest[] {
  if (!bundle?.entry) return [];
  return bundle.entry
    .map((e) => e.resource)
    .filter((r): r is fhir4.MedicationRequest => r?.resourceType === 'MedicationRequest');
}

function claimsFrom(bundle: fhir4.Bundle | undefined): fhir4.Claim[] {
  if (!bundle?.entry) return [];
  return bundle.entry
    .map((e) => e.resource)
    .filter((r): r is fhir4.Claim => r?.resourceType === 'Claim');
}

// Build the cross-patient worklist. Each active MedicationRequest becomes a row;
// rows are tagged "submitted" if a Da Vinci PAS Claim exists (use=preauthorization)
// whose `prescription` references that MedicationRequest. Urgency is derived from
// authoredOn.
export function buildWorklist(
  patients: fhir4.Bundle | undefined,
  meds: fhir4.Bundle | undefined,
  preAuthClaims: fhir4.Bundle | undefined,
): WorklistItem[] {
  const patientById = new Map<string, fhir4.Patient>();
  for (const p of patientsFrom(patients)) {
    if (p.id) patientById.set(p.id, p);
  }

  // Build submission lookup: medicationRequestId -> claimId
  const submittedBy = new Map<string, string>();
  for (const c of claimsFrom(preAuthClaims)) {
    if (c.use !== 'preauthorization') continue;
    const ref = c.prescription?.reference;
    if (typeof ref === 'string' && ref.startsWith('MedicationRequest/')) {
      const mrId = ref.slice('MedicationRequest/'.length);
      if (c.id) submittedBy.set(mrId, c.id);
    }
  }

  const items: WorklistItem[] = [];
  for (const m of medsFrom(meds)) {
    if (!m.id) continue;
    const patientRef = m.subject?.reference;
    const patientId = patientRef?.startsWith('Patient/')
      ? patientRef.slice('Patient/'.length)
      : undefined;
    if (!patientId) continue;
    const patient = patientById.get(patientId);
    const days = daysAgoFrom(m.authoredOn);
    const submitted = submittedBy.has(m.id);
    items.push({
      medicationRequestId: m.id,
      patientId,
      patientName: fullName(patient),
      medication:
        m.medicationCodeableConcept?.text ??
        m.medicationCodeableConcept?.coding?.[0]?.display ??
        'Medication',
      authoredOn: m.authoredOn,
      daysAgo: days,
      urgency: urgencyOf(days),
      submitted,
      submittedClaimId: submitted ? submittedBy.get(m.id) : undefined,
    });
  }

  return items.sort((a, b) => (b.daysAgo ?? -1) - (a.daysAgo ?? -1));
}

export interface DashboardKpis {
  needsReview: number;
  overdue: number;
  submittedTotal: number;
  patientCount: number;
}

export function computeKpis(items: WorklistItem[], patientCount: number): DashboardKpis {
  const open = items.filter((i) => !i.submitted);
  return {
    needsReview: open.length,
    overdue: open.filter((i) => i.urgency === 'overdue').length,
    submittedTotal: items.filter((i) => i.submitted).length,
    patientCount,
  };
}

export function formatDaysAgo(days: number | undefined): string {
  if (days == null) return 'unknown';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
