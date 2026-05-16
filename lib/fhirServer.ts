import "server-only";

const FHIR_BASE = process.env.FHIR_BASE_URL;
const FHIR_TOKEN = process.env.FHIR_SERVER_TOKEN ?? process.env.FHIR_AUTH_TOKEN;

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
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
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
      throw new Error("FHIR server timed out after 10 seconds.");
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

export const createPatient = (resource: fhir4.Patient) =>
  fhirServerFetch<fhir4.Patient>("/Patient", {
    method: "POST",
    body: JSON.stringify(resource),
  });

export const updatePatient = (id: string, resource: fhir4.Patient) =>
  fhirServerFetch<fhir4.Patient>(`/Patient/${id}`, {
    method: "PUT",
    body: JSON.stringify(resource),
  });

export const searchPatientsByName = (name: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Patient?name=${encodeURIComponent(name)}&_count=50`,
  );

export const getVitals = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Observation?patient=${patientId}&category=vital-signs&_sort=-date&_count=20`,
  );

export const getVitalsTrend = (patientId: string) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return fhirServerFetch<fhir4.Bundle>(
    `/Observation?patient=${patientId}&category=vital-signs&date=ge${since}&_sort=date&_count=100`,
  );
};

export const getConditions = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/Condition?patient=${patientId}&clinical-status=active&_sort=-recorded-date`,
  );

export const getMedications = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(
    `/MedicationRequest?patient=${patientId}&status=active&_sort=-authoredon`,
  );
