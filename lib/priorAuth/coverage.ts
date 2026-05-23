import 'server-only';

import { fhirServerFetch } from '@/lib/fhirServer';

/**
 * Returns the id of an active Coverage for the patient, creating a minimal
 * self-pay Coverage if none exists.
 *
 * Da Vinci PAS / FHIR R4 base Claim require `insurance.coverage` to reference
 * a Coverage resource. When the patient has no documented coverage on file we
 * create one with `type: pay` (self-pay), which is the standards-defined code
 * for "the patient is paying directly" — not fabrication of an insurer.
 */
export async function ensureCoverage(patientId: string): Promise<string> {
  const existing = await fhirServerFetch<fhir4.Bundle>(
    `/Coverage?patient=${patientId}&status=active&_count=1`,
  );
  const found = existing.entry?.[0]?.resource as fhir4.Coverage | undefined;
  if (found?.id) return found.id;

  const coverage: fhir4.Coverage = {
    resourceType: 'Coverage',
    status: 'active',
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'pay',
          display: 'Pay',
        },
      ],
      text: 'Self-pay (no documented insurance)',
    },
    beneficiary: { reference: `Patient/${patientId}` },
    payor: [{ display: 'Self-pay' }],
  };

  const created = await fhirServerFetch<fhir4.Coverage>('/Coverage', {
    method: 'POST',
    body: JSON.stringify(coverage),
  });

  if (!created.id) {
    throw new Error('Coverage POST did not return an id');
  }
  return created.id;
}
