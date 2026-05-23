'use client';
import { useQueries } from '@tanstack/react-query';
import {
  fetchPatient,
  fetchObservations,
  fetchConditions,
  fetchMedications,
  fetchAllergies,
  fetchImmunizations,
  fetchEncounters,
  fetchProcedures,
  fetchDiagnosticReports,
  fetchClaims,
} from '@/lib/fhirClient';

export function usePatientDetail(patientId: string) {
  const results = useQueries({
    queries: [
      { queryKey: ['patient',            patientId], queryFn: () => fetchPatient(patientId) },
      { queryKey: ['observations',       patientId], queryFn: () => fetchObservations(patientId) },
      { queryKey: ['conditions',         patientId], queryFn: () => fetchConditions(patientId) },
      { queryKey: ['medications',        patientId], queryFn: () => fetchMedications(patientId) },
      { queryKey: ['allergies',          patientId], queryFn: () => fetchAllergies(patientId) },
      { queryKey: ['immunizations',      patientId], queryFn: () => fetchImmunizations(patientId) },
      { queryKey: ['encounters',         patientId], queryFn: () => fetchEncounters(patientId) },
      { queryKey: ['procedures',         patientId], queryFn: () => fetchProcedures(patientId) },
      { queryKey: ['diagnostic-reports', patientId], queryFn: () => fetchDiagnosticReports(patientId) },
      { queryKey: ['claims',             patientId], queryFn: () => fetchClaims(patientId) },
    ],
  });

  const [patient, observations, conditions, medications, allergies, immunizations, encounters, procedures, diagnosticReports, claims] = results;

  return {
    patient:           { data: patient.data           as fhir4.Patient | undefined, isLoading: patient.isLoading,           error: patient.error },
    observations:      { data: observations.data      as fhir4.Bundle  | undefined, isLoading: observations.isLoading,      error: observations.error },
    conditions:        { data: conditions.data        as fhir4.Bundle  | undefined, isLoading: conditions.isLoading,        error: conditions.error },
    medications:       { data: medications.data       as fhir4.Bundle  | undefined, isLoading: medications.isLoading,       error: medications.error },
    allergies:         { data: allergies.data         as fhir4.Bundle  | undefined, isLoading: allergies.isLoading,         error: allergies.error },
    immunizations:     { data: immunizations.data     as fhir4.Bundle  | undefined, isLoading: immunizations.isLoading,     error: immunizations.error },
    encounters:        { data: encounters.data        as fhir4.Bundle  | undefined, isLoading: encounters.isLoading,        error: encounters.error },
    procedures:        { data: procedures.data        as fhir4.Bundle  | undefined, isLoading: procedures.isLoading,        error: procedures.error },
    diagnosticReports: { data: diagnosticReports.data as fhir4.Bundle  | undefined, isLoading: diagnosticReports.isLoading, error: diagnosticReports.error },
    claims:            { data: claims.data            as fhir4.Bundle  | undefined, isLoading: claims.isLoading,            error: claims.error },
  };
}
