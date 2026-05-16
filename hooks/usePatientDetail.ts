'use client';
import { useQueries } from '@tanstack/react-query';
import { fetchPatient, fetchVitals, fetchConditions, fetchMedications } from '@/lib/fhirClient';

export function usePatientDetail(patientId: string) {
  const results = useQueries({
    queries: [
      { queryKey: ['patient',     patientId], queryFn: () => fetchPatient(patientId) },
      { queryKey: ['vitals',      patientId], queryFn: () => fetchVitals(patientId) },
      { queryKey: ['conditions',  patientId], queryFn: () => fetchConditions(patientId) },
      { queryKey: ['medications', patientId], queryFn: () => fetchMedications(patientId) },
    ],
  });

  const [patient, vitals, conditions, medications] = results;

  return {
    patient:     { data: patient.data     as fhir4.Patient | undefined, isLoading: patient.isLoading,     error: patient.error },
    vitals:      { data: vitals.data      as fhir4.Bundle  | undefined, isLoading: vitals.isLoading,      error: vitals.error },
    conditions:  { data: conditions.data  as fhir4.Bundle  | undefined, isLoading: conditions.isLoading,  error: conditions.error },
    medications: { data: medications.data as fhir4.Bundle  | undefined, isLoading: medications.isLoading, error: medications.error },
    anyLoading: results.some((r) => r.isLoading),
    errors: results.filter((r) => r.error).map((r) => r.error),
  };
}
