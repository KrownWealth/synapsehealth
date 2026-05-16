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
      'Content-Type': 'application/fhir+json',
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

export const postPatient = (resource: fhir4.Patient) =>
  clientFetch<fhir4.Patient>('/Patient', { method: 'POST', body: JSON.stringify(resource) });

export const putPatient = (id: string, resource: fhir4.Patient) =>
  clientFetch<fhir4.Patient>(`/Patient/${id}`, { method: 'PUT', body: JSON.stringify(resource) });

export const searchPatientsByNameClient = (name: string) =>
  clientFetch<fhir4.Bundle>(`/Patient?name=${encodeURIComponent(name)}&_count=50`);

export const fetchVitals = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/Observation?patient=${patientId}&category=vital-signs&_sort=-date&_count=20`);

export const fetchVitalsTrend = (patientId: string) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return clientFetch<fhir4.Bundle>(`/Observation?patient=${patientId}&category=vital-signs&date=ge${since}&_sort=date&_count=100`);
};

export const fetchConditions = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/Condition?patient=${patientId}&clinical-status=active&_sort=-recorded-date`);

export const fetchMedications = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/MedicationRequest?patient=${patientId}&status=active&_sort=-authoredon`);
