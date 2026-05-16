'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchMedications } from '@/lib/fhirClient';

export function useMedications(patientId: string) {
  return useQuery({
    queryKey: ['medications', patientId],
    queryFn: () => fetchMedications(patientId),
    enabled: !!patientId,
  });
}
