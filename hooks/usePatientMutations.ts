'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

async function postPatient(patient: fhir4.Patient): Promise<fhir4.Patient> {
  const res = await fetch('/api/fhir/Patient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json', Accept: 'application/fhir+json' },
    body: JSON.stringify(patient),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { issue?: Array<{ diagnostics?: string }> }).issue?.[0]?.diagnostics ??
      (body as { error?: string }).error ??
      `Create failed (HTTP ${res.status})`;
    throw new Error(message);
  }
  return res.json();
}

async function putPatient(patient: fhir4.Patient): Promise<fhir4.Patient> {
  if (!patient.id) throw new Error('Patient.id required for update');
  const res = await fetch(`/api/fhir/Patient/${patient.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/fhir+json', Accept: 'application/fhir+json' },
    body: JSON.stringify(patient),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { issue?: Array<{ diagnostics?: string }> }).issue?.[0]?.diagnostics ??
      (body as { error?: string }).error ??
      `Update failed (HTTP ${res.status})`;
    throw new Error(message);
  }
  return res.json();
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'patients' || q.queryKey[0] === 'patients-search',
      });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: putPatient,
    onSuccess: (updated) => {
      if (updated.id) {
        queryClient.setQueryData(['patient', updated.id], updated);
      }
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'patients' ||
          q.queryKey[0] === 'patients-search' ||
          (q.queryKey[0] === 'patient' && q.queryKey[1] === updated.id),
      });
    },
  });
}
