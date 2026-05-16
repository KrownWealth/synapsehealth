'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchPatients } from '@/lib/fhirClient';

export function usePatients(page = 0) {
  return useQuery({
    queryKey: ['patients', page],
    queryFn: () => fetchPatients(page),
  });
}
