'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchVitals, fetchVitalsTrend } from '@/lib/fhirClient';

export function useObservations(patientId: string) {
  return useQuery({
    queryKey: ['vitals', patientId],
    queryFn: () => fetchVitals(patientId),
    enabled: !!patientId,
  });
}

export function useVitalsTrend(patientId: string) {
  return useQuery({
    queryKey: ['vitals-trend', patientId],
    queryFn: () => fetchVitalsTrend(patientId),
    enabled: !!patientId,
  });
}
