import { NextRequest, NextResponse } from 'next/server';
import { gatherEvidence } from '@/lib/priorAuth/evidence';
import { FhirError } from '@/lib/fhirServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId');
  const medicationRequestId = req.nextUrl.searchParams.get('medicationRequestId');

  if (!patientId || !medicationRequestId) {
    return NextResponse.json(
      { error: 'patientId and medicationRequestId are both required query params' },
      { status: 400 },
    );
  }

  try {
    const bundle = await gatherEvidence(patientId, medicationRequestId);
    return NextResponse.json(bundle);
  } catch (err) {
    if (err instanceof FhirError) {
      return NextResponse.json(err.operationOutcome, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
