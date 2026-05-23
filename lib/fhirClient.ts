export class FhirClientError extends Error {
  constructor(public status: number, public operationOutcome: unknown) {
    super(`FHIR proxy error ${status}`);
    this.name = 'FhirClientError';
  }
}

async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/fhir${path}`, {
    ...init,
    headers: {
      Accept: 'application/fhir+json',
      ...init?.headers,
    },
  });
  if (!res.ok) throw new FhirClientError(res.status, await res.json().catch(() => ({})));
  return (await res.json()) as T;
}

export const fetchPatients = (page = 0, count = 20) =>
  clientFetch<fhir4.Bundle>(`/Patient?_count=${count}&_getpagesoffset=${page * count}&_sort=family`);

export const fetchPatient = (id: string) =>
  clientFetch<fhir4.Patient>(`/Patient/${id}`);

export const searchPatientsByNameClient = (name: string) =>
  clientFetch<fhir4.Bundle>(`/Patient?name=${encodeURIComponent(name)}&_count=50`);

export const fetchActiveMedicationsAcrossPatients = (patientIds: string[]) => {
  if (patientIds.length === 0) return Promise.resolve({ resourceType: 'Bundle', type: 'searchset', entry: [] } as fhir4.Bundle);
  const orList = patientIds.map((id) => `Patient/${id}`).join(',');
  return clientFetch<fhir4.Bundle>(`/MedicationRequest?status=active&patient=${encodeURIComponent(orList)}&_count=200`);
};

export const fetchAllPreAuthClaimsForPatients = (patientIds: string[]) => {
  if (patientIds.length === 0) return Promise.resolve({ resourceType: 'Bundle', type: 'searchset', entry: [] } as fhir4.Bundle);
  const orList = patientIds.map((id) => `Patient/${id}`).join(',');
  return clientFetch<fhir4.Bundle>(`/Claim?use=preauthorization&patient=${encodeURIComponent(orList)}&_count=200`);
};

export const fetchObservations = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/Observation?patient=${patientId}&_count=50`);

export const fetchConditions = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/Condition?patient=${patientId}&_count=50`);

export const fetchMedications = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/MedicationRequest?patient=${patientId}&_count=50`);

export const fetchAllergies = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/AllergyIntolerance?patient=${patientId}&_count=50`);

export const fetchImmunizations = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/Immunization?patient=${patientId}&_count=50`);

export const fetchEncounters = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/Encounter?patient=${patientId}&_count=50`);

export const fetchProcedures = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/Procedure?patient=${patientId}&_count=50`);

export const fetchDiagnosticReports = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/DiagnosticReport?patient=${patientId}&_count=50`);

export const fetchClaims = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/Claim?patient=${patientId}&_count=50`);
