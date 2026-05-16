'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchConditions } from '@/lib/fhirClient';

export function useConditions(patientId: string) {
  return useQuery({
    queryKey: ['conditions', patientId],
    queryFn: () => fetchConditions(patientId),
    enabled: !!patientId,
  });
}
