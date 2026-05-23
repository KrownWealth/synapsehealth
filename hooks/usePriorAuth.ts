'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EvidenceBundle, Justification } from '@/types/priorAuth';

export interface GenerateResponse {
  justification: Justification;
  evidence: EvidenceBundle;
  usage: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } | null;
  timings: { llmMs: number; evidenceMs: number };
}

export interface SubmitResponse {
  claimId: string;
  reference: string;
  created: string;
  coverageId: string;
}

export interface SubmitInput {
  patientId: string;
  medicationRequestId: string;
  narrative: string;
  justification: Justification;
}

async function generatePriorAuth(input: {
  patientId: string;
  medicationRequestId: string;
}): Promise<GenerateResponse> {
  const res = await fetch('/api/prior-auth/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? `Generate failed (HTTP ${res.status})`);
  }
  return res.json();
}

async function submitPriorAuth(input: SubmitInput): Promise<SubmitResponse> {
  const res = await fetch('/api/prior-auth/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? `Submit failed (HTTP ${res.status})`);
  }
  return res.json();
}

export function useGeneratePriorAuth() {
  return useMutation({
    mutationFn: generatePriorAuth,
  });
}

export function useSubmitPriorAuth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitPriorAuth,
    onSuccess: () => {
      // Move the row from "Needs review" → "Submitted" on the dashboard worklist.
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'preauth-claims-for',
      });
    },
  });
}
