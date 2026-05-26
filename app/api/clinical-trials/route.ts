import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { fhirServerFetch, FhirError } from '@/lib/fhirServer';
import { searchClinicalTrials } from '@/lib/clinicalTrials';
import { gradeTrials } from '@/lib/clinicalTrials/aiFit';
import { calculateAge } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function codeText(cc: fhir4.CodeableConcept | undefined): string | undefined {
  if (!cc) return undefined;
  return cc.text ?? cc.coding?.find((c) => c.display)?.display ?? cc.coding?.[0]?.code;
}

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId');
  if (!patientId) {
    return NextResponse.json({ error: 'patientId query param is required' }, { status: 400 });
  }

  let patient: fhir4.Patient;
  let conditionBundle: fhir4.Bundle;
  let medBundle: fhir4.Bundle;
  try {
    [patient, conditionBundle, medBundle] = await Promise.all([
      fhirServerFetch<fhir4.Patient>(`/Patient/${patientId}`),
      fhirServerFetch<fhir4.Bundle>(
        `/Condition?patient=${patientId}&clinical-status=active&_count=50`,
      ),
      fhirServerFetch<fhir4.Bundle>(
        `/MedicationRequest?patient=${patientId}&status=active&_count=50`,
      ),
    ]);
  } catch (err) {
    if (err instanceof FhirError) {
      return NextResponse.json(err.operationOutcome, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load patient context' },
      { status: 500 },
    );
  }

  const conditions = Array.from(
    new Set(
      (conditionBundle.entry ?? [])
        .map((e) => e.resource as fhir4.Condition | undefined)
        .filter((r): r is fhir4.Condition => r?.resourceType === 'Condition')
        .map((c) => codeText(c.code))
        .filter((s): s is string => !!s),
    ),
  );

  const activeMedications = Array.from(
    new Set(
      (medBundle.entry ?? [])
        .map((e) => e.resource as fhir4.MedicationRequest | undefined)
        .filter((r): r is fhir4.MedicationRequest => r?.resourceType === 'MedicationRequest')
        .map((m) => codeText(m.medicationCodeableConcept))
        .filter((s): s is string => !!s),
    ),
  );

  const age = calculateAge(patient.birthDate);
  const sex = patient.gender;
  const address = patient.address?.[0];
  const state = address?.state;
  const country = address?.country;

  // Tier 1: deterministic search.
  const matches = await searchClinicalTrials({ conditions, age, sex });

  // Tier 2: AI-graded fit (factors in location). Graceful no-op if GEMINI_API_KEY missing.
  const aiGraded = await gradeTrials(
    { age, sex, state, country, conditions, activeMedications },
    matches,
  );

  return NextResponse.json({
    trials: aiGraded,
    queriedConditions: conditions,
    patientAge: age,
    patientSex: sex,
  });
}
