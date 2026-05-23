import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { fhirServerFetch, FhirError } from '@/lib/fhirServer';
import { JustificationSchema } from '@/lib/priorAuth/schema';
import { ensureCoverage } from '@/lib/priorAuth/coverage';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SubmitInputSchema = z.object({
  patientId: z.string().min(1),
  medicationRequestId: z.string().min(1),
  narrative: z.string().min(1),
  justification: JustificationSchema,
});

const CLAIM_TYPE = 'http://terminology.hl7.org/CodeSystem/claim-type';
const PROCESS_PRIORITY = 'http://terminology.hl7.org/CodeSystem/processpriority';
const CLAIM_INFO_CATEGORY = 'http://terminology.hl7.org/CodeSystem/claiminformationcategory';

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  const parsed = SubmitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid submission payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { patientId, medicationRequestId, narrative, justification } = parsed.data;

  let medicationRequest: fhir4.MedicationRequest;
  try {
    medicationRequest = await fhirServerFetch<fhir4.MedicationRequest>(
      `/MedicationRequest/${medicationRequestId}`,
    );
  } catch (err) {
    if (err instanceof FhirError) {
      return NextResponse.json(err.operationOutcome, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load MedicationRequest' },
      { status: 500 },
    );
  }

  if (!medicationRequest.requester?.reference) {
    return NextResponse.json(
      {
        error:
          'MedicationRequest.requester is missing — Da Vinci PAS Claim requires a provider reference.',
      },
      { status: 422 },
    );
  }

  let coverageId: string;
  try {
    coverageId = await ensureCoverage(patientId);
  } catch (err) {
    if (err instanceof FhirError) {
      return NextResponse.json(err.operationOutcome, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not ensure Coverage' },
      { status: 500 },
    );
  }

  // Build supportingInfo: the narrative as a clinical valueString, then each
  // grounded citation as a valueReference. Sequence numbers are 1-based.
  const supportingInfo: fhir4.ClaimSupportingInfo[] = [
    {
      sequence: 1,
      category: {
        coding: [{ system: CLAIM_INFO_CATEGORY, code: 'clinical', display: 'Clinical' }],
      },
      valueString: narrative,
    },
    ...justification.citations.map((c, i): fhir4.ClaimSupportingInfo => ({
      sequence: i + 2,
      category: {
        coding: [{ system: CLAIM_INFO_CATEGORY, code: 'info', display: 'Information' }],
      },
      valueReference: { reference: `${c.resourceType}/${c.resourceId}`, display: c.detail },
    })),
  ];

  // item.productOrService — lift the drug coding off the MedicationRequest
  // exactly as it appears (RxNorm for Synthea data). No transformation.
  const drugCC = medicationRequest.medicationCodeableConcept;
  const productOrService: fhir4.CodeableConcept = drugCC
    ? {
        coding: drugCC.coding,
        text: drugCC.text ?? drugCC.coding?.[0]?.display,
      }
    : { text: 'Unknown medication' };

  const claim: fhir4.Claim = {
    resourceType: 'Claim',
    status: 'active',
    type: {
      coding: [{ system: CLAIM_TYPE, code: 'pharmacy', display: 'Pharmacy' }],
    },
    use: 'preauthorization',
    patient: { reference: `Patient/${patientId}` },
    created: new Date().toISOString(),
    provider: medicationRequest.requester,
    priority: {
      coding: [{ system: PROCESS_PRIORITY, code: 'normal', display: 'Normal' }],
    },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: { reference: `Coverage/${coverageId}` },
      },
    ],
    prescription: { reference: `MedicationRequest/${medicationRequestId}` },
    item: [
      {
        sequence: 1,
        productOrService,
      },
    ],
    supportingInfo,
  };

  try {
    const created = await fhirServerFetch<fhir4.Claim>('/Claim', {
      method: 'POST',
      body: JSON.stringify(claim),
    });
    return NextResponse.json({
      claimId: created.id,
      reference: `Claim/${created.id}`,
      created: created.created ?? claim.created,
      coverageId,
    });
  } catch (err) {
    if (err instanceof FhirError) {
      return NextResponse.json(err.operationOutcome, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Submission failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
