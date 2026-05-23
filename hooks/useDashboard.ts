'use client';
import { useQuery } from '@tanstack/react-query';
import {
  fetchPatients,
  fetchActiveMedicationsAcrossPatients,
  fetchAllPreAuthClaimsForPatients,
} from '@/lib/fhirClient';
import { patientsFromBundle } from '@/lib/patientUtils';

// Stage 1: fetch the patient bundle. Stages 2 + 3 depend on the IDs from it,
// but run in parallel with each other once Stage 1 returns.
export function useDashboard() {
  const patientsQ = useQuery({
    queryKey: ['patients', 0],
    queryFn: () => fetchPatients(0),
  });

  const patientIds = patientsFromBundle(patientsQ.data)
    .map((p) => p.id)
    .filter((id): id is string => !!id);
  const idKey = patientIds.join(',');

  const medsQ = useQuery({
    queryKey: ['active-meds-across', idKey],
    queryFn: () => fetchActiveMedicationsAcrossPatients(patientIds),
    enabled: patientIds.length > 0,
  });

  const claimsQ = useQuery({
    queryKey: ['preauth-claims-for', idKey],
    queryFn: () => fetchAllPreAuthClaimsForPatients(patientIds),
    enabled: patientIds.length > 0,
  });

  return {
    patients:      { data: patientsQ.data, isLoading: patientsQ.isLoading, error: patientsQ.error },
    medications:   { data: medsQ.data,     isLoading: medsQ.isLoading,     error: medsQ.error },
    preAuthClaims: { data: claimsQ.data,   isLoading: claimsQ.isLoading,   error: claimsQ.error },
  };
}
