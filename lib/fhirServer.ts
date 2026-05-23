import "server-only";

const FHIR_BASE = process.env.FHIR_BASE_URL;
const FHIR_TOKEN = process.env.FHIR_SERVER_TOKEN ?? process.env.FHIR_AUTH_TOKEN;
const FHIR_TIMEOUT_MS = Number(process.env.FHIR_TIMEOUT_MS) || 30_000;

const ACCEPT_HEADER: HeadersInit = { Accept: "application/fhir+json" };
const WRITE_HEADERS: HeadersInit = {
  ...ACCEPT_HEADER,
  "Content-Type": "application/fhir+json",
};

export class FhirError extends Error {
  constructor(
    public status: number,
    public operationOutcome: unknown,
  ) {
    super(`FHIR error ${status}`);
    this.name = "FhirError";
  }
}

function logFhirAccess(
  method: string,
  path: string,
  status: number,
  durationMs: number,
) {
  // console.log(JSON.stringify({
  //   type: 'fhir_access',
  //   timestamp: new Date().toISOString(),
  //   method, path, status, duration_ms: durationMs,
  // }));
}

export async function fhirServerFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!FHIR_BASE)
    throw new Error("FHIR_BASE_URL is not set. Configure it in .env.local.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FHIR_TIMEOUT_MS);
  const method = init?.method ?? "GET";
  const started = Date.now();

  const isWrite = method !== "GET" && method !== "DELETE";
  const headers = {
    ...(isWrite ? WRITE_HEADERS : ACCEPT_HEADER),
    ...(FHIR_TOKEN ? { Authorization: `Bearer ${FHIR_TOKEN}` } : {}),
    ...init?.headers,
  };

  try {
    // `next: { revalidate: 0 }` opts out of Next.js fetch caching (TanStack Query owns caching).
    // Equivalent to `cache: 'no-store'`, but the latter triggers a ~10s hang on Node's undici
    // for chunked responses from HAPI — this form sidesteps that.
    const res = await fetch(`${FHIR_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const outcome = await res.json().catch(() => ({}));
      logFhirAccess(method, path, res.status, Date.now() - started);
      throw new FhirError(res.status, outcome);
    }
    const data = (await res.json()) as T;
    logFhirAccess(method, path, res.status, Date.now() - started);
    return data;
  } catch (err) {
    if (err instanceof FhirError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      logFhirAccess(method, path, 0, Date.now() - started);
      throw new Error(`FHIR server timed out after ${Math.round(FHIR_TIMEOUT_MS / 1000)} seconds.`);
    }
    logFhirAccess(method, path, 0, Date.now() - started);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const getPatients = (page = 0, count = 20) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Patient?_count=${count}&_getpagesoffset=${page * count}&_sort=family`,
  );

export const getPatient = (id: string) =>
  fhirServerFetch<fhir4.Patient>(`/Patient/${id}`);

export const searchPatientsByName = (name: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Patient?name=${encodeURIComponent(name)}&_count=50`,
  );

// Cross-patient queries for the dashboard worklist.
// Filtering by an explicit patient OR list because there are orphan
// MedicationRequests on the server from earlier uploads.
export const getActiveMedicationsAcrossPatients = (patientIds: string[]) => {
  if (patientIds.length === 0) {
    return Promise.resolve({ resourceType: 'Bundle', type: 'searchset', entry: [] } as fhir4.Bundle);
  }
  const orList = patientIds.map((id) => `Patient/${id}`).join(',');
  return fhirServerFetch<fhir4.Bundle>(
    `/MedicationRequest?status=active&patient=${encodeURIComponent(orList)}&_count=200`,
  );
};

// Cross-patient prior-authorization Claim query (Da Vinci PAS).
// A submitted PA is a Claim with use=preauthorization whose `prescription`
// references the MedicationRequest. The dashboard scans these to mark
// worklist rows as submitted.
export const getAllPreAuthClaimsForPatients = (patientIds: string[]) => {
  if (patientIds.length === 0) {
    return Promise.resolve({ resourceType: 'Bundle', type: 'searchset', entry: [] } as fhir4.Bundle);
  }
  const orList = patientIds.map((id) => `Patient/${id}`).join(',');
  return fhirServerFetch<fhir4.Bundle>(
    `/Claim?use=preauthorization&patient=${encodeURIComponent(orList)}&_count=200`,
  );
};

export const getObservations = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Observation?patient=${patientId}&_count=50`,
  );

export const getConditions = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Condition?patient=${patientId}&_count=50`,
  );

export const getMedications = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/MedicationRequest?patient=${patientId}&_count=50`,
  );

export const getAllergies = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/AllergyIntolerance?patient=${patientId}&_count=50`,
  );

export const getImmunizations = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Immunization?patient=${patientId}&_count=50`,
  );

export const getEncounters = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Encounter?patient=${patientId}&_count=50`,
  );

export const getProcedures = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Procedure?patient=${patientId}&_count=50`,
  );

export const getDiagnosticReports = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/DiagnosticReport?patient=${patientId}&_count=50`,
  );

export const getClaims = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Claim?patient=${patientId}&_count=50`,
  );
