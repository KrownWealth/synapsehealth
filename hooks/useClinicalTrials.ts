'use client';

import { useQuery } from '@tanstack/react-query';
import type { TrialMatch } from '@/lib/clinicalTrials';

export interface ClinicalTrialsResponse {
  trials: TrialMatch[];
  queriedConditions: string[];
  patientAge?: number;
  patientSex?: string;
}

async function fetchClinicalTrials(patientId: string): Promise<ClinicalTrialsResponse> {
  const res = await fetch(`/api/clinical-trials?patientId=${encodeURIComponent(patientId)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Trial search failed (HTTP ${res.status})`);
  }
  return res.json();
}

export function useClinicalTrials(patientId: string) {
  return useQuery({
    queryKey: ['clinical-trials', patientId],
    queryFn: () => fetchClinicalTrials(patientId),
    // Trials are slow-moving; cache for an hour and don't re-query on focus.
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
