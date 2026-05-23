import 'server-only';

import { fhirServerFetch } from '@/lib/fhirServer';
import type {
  EvidenceBundle,
  MedicationEvidence,
  ConditionEvidence,
  LabEvidence,
  PriorMedicationEvidence,
  NoteEvidence,
  CoverageEvidence,
} from '@/types/priorAuth';

const codeText = (cc: fhir4.CodeableConcept | undefined): string | undefined => {
  if (!cc) return undefined;
  return cc.text ?? cc.coding?.find((c) => c.display)?.display ?? cc.coding?.[0]?.code;
};

const findCoding = (
  cc: fhir4.CodeableConcept | undefined,
  systemContains: string,
): fhir4.Coding | undefined => cc?.coding?.find((c) => c.system?.includes(systemContains));

const formatLabValue = (o: fhir4.Observation): { value?: string; unit?: string } => {
  if (o.valueQuantity?.value != null) {
    return { value: String(o.valueQuantity.value), unit: o.valueQuantity.unit };
  }
  if (o.valueString) return { value: o.valueString };
  if (o.valueCodeableConcept) return { value: codeText(o.valueCodeableConcept) };
  return {};
};

const entriesOf = <T extends fhir4.Resource>(bundle: fhir4.Bundle | null | undefined): T[] =>
  ((bundle?.entry?.map((e) => e.resource).filter(Boolean) as T[] | undefined) ?? []);

async function timed<T>(
  label: string,
  durations: Record<string, number>,
  fn: () => Promise<T>,
): Promise<T | null> {
  const start = Date.now();
  try {
    const result = await fn();
    durations[label] = Date.now() - start;
    return result;
  } catch (err) {
    durations[label] = Date.now() - start;
    // Resource type may be missing on the tenant (e.g. Coverage), or a 404. Don't sink the batch.
    return null;
  }
}

export async function gatherEvidence(
  patientId: string,
  medicationRequestId: string,
): Promise<EvidenceBundle> {
  const startedAt = Date.now();
  const durations: Record<string, number> = {};

  // Single parallel batch. Each sub-fetch is timing-instrumented and error-isolated
  // so a missing resource type (e.g. tenant has no Coverage) becomes a gap, not a failure.
  const [patient, medication, conditions, labs, priorMeds, notes, coverage] =
    await Promise.all([
      timed('patient', durations, () =>
        fhirServerFetch<fhir4.Patient>(`/Patient/${patientId}`),
      ),
      timed('medicationRequest', durations, () =>
        fhirServerFetch<fhir4.MedicationRequest>(`/MedicationRequest/${medicationRequestId}`),
      ),
      timed('conditions', durations, () =>
        fhirServerFetch<fhir4.Bundle>(
          `/Condition?patient=${patientId}&clinical-status=active&_count=50`,
        ),
      ),
      timed('labs', durations, () =>
        fhirServerFetch<fhir4.Bundle>(
          `/Observation?patient=${patientId}&category=laboratory&_count=50&_sort=-date`,
        ),
      ),
      timed('priorMeds', durations, () =>
        fhirServerFetch<fhir4.Bundle>(
          `/MedicationRequest?patient=${patientId}&status=stopped,completed,cancelled,on-hold&_count=20`,
        ),
      ),
      timed('documentReferences', durations, () =>
        fhirServerFetch<fhir4.Bundle>(
          `/DocumentReference?patient=${patientId}&_count=10&_sort=-date`,
        ),
      ),
      timed('coverage', durations, () =>
        fhirServerFetch<fhir4.Bundle>(`/Coverage?patient=${patientId}&_count=5`),
      ),
    ]);

  if (!medication) {
    throw new Error(`MedicationRequest/${medicationRequestId} could not be fetched`);
  }

  const medEvidence: MedicationEvidence = {
    id: medication.id ?? medicationRequestId,
    display: codeText(medication.medicationCodeableConcept) ?? 'Unknown medication',
    rxnormCode: findCoding(medication.medicationCodeableConcept, 'rxnorm')?.code,
    dose: medication.dosageInstruction?.[0]?.text,
    authoredOn: medication.authoredOn,
    status: medication.status,
  };

  const activeConditions: ConditionEvidence[] = entriesOf<fhir4.Condition>(conditions).map((c) => ({
    id: c.id ?? '',
    display: codeText(c.code) ?? 'Unknown condition',
    icd10Code: findCoding(c.code, 'icd-10')?.code ?? findCoding(c.code, 'icd10')?.code,
    snomedCode: findCoding(c.code, 'snomed')?.code,
    onsetDate: c.onsetDateTime,
    clinicalStatus: c.clinicalStatus?.coding?.[0]?.code ?? c.clinicalStatus?.text,
  }));

  const recentLabs: LabEvidence[] = entriesOf<fhir4.Observation>(labs)
    .slice(0, 20)
    .map((o) => {
      const { value, unit } = formatLabValue(o);
      return {
        id: o.id ?? '',
        display: codeText(o.code) ?? 'Lab result',
        loincCode: findCoding(o.code, 'loinc')?.code,
        value,
        unit,
        effectiveDateTime: o.effectiveDateTime,
        interpretation: o.interpretation?.[0] ? codeText(o.interpretation[0]) : undefined,
      };
    });

  const priorMedications: PriorMedicationEvidence[] = entriesOf<fhir4.MedicationRequest>(priorMeds)
    .filter((m) => m.id !== medicationRequestId)
    .slice(0, 20)
    .map((m) => ({
      id: m.id ?? '',
      display: codeText(m.medicationCodeableConcept) ?? 'Unknown medication',
      status: m.status,
      authoredOn: m.authoredOn,
      statusReason: codeText(m.statusReason),
    }));

  const recentNotes: NoteEvidence[] = entriesOf<fhir4.DocumentReference>(notes).map((d) => ({
    id: d.id ?? '',
    display: d.description ?? codeText(d.type) ?? 'Clinical note',
    type: codeText(d.type),
    date: d.date,
  }));

  const coverageList = entriesOf<fhir4.Coverage>(coverage);
  const coverageEvidence: CoverageEvidence | null = coverageList[0]
    ? {
        id: coverageList[0].id ?? '',
        payerName: coverageList[0].payor?.[0]?.display,
        status: coverageList[0].status,
      }
    : null;

  const gaps: string[] = [];
  if (activeConditions.length === 0) gaps.push('No active conditions on record');
  if (recentLabs.length === 0) gaps.push('No laboratory observations on record');
  if (priorMedications.length === 0) gaps.push('No prior medication history on record');
  if (recentNotes.length === 0) gaps.push('No clinical notes (DocumentReference) on record');
  if (!coverageEvidence) gaps.push('No insurance coverage on record');

  return {
    patientId,
    patientName: patient
      ? [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ')
      : undefined,
    medicationRequestId,
    medication: medEvidence,
    activeConditions,
    recentLabs,
    priorMedications,
    recentNotes,
    coverage: coverageEvidence,
    gaps,
    fetchedAt: new Date().toISOString(),
    timings: {
      startedAt,
      durations,
      totalMs: Date.now() - startedAt,
    },
  };
}
