# AGENT.md — SepSofa Developer Guide
## Implementation Reference for AI Agents & Developers

> This file is the canonical source of truth for how to build SepSofa.  
> Read SPEC.md for *what* to build. Read this file for *how* to build it.  
> **Framework: Next.js 14+ with App Router.**

---

## 1. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | File-based routing, Server Components, built-in optimisations |
| Language | **TypeScript** | Full type safety across FHIR resources and scoring engine |
| Styling | **Tailwind CSS v3** | Utility-first, easy to implement the risk colour system |
| **BFF / API routing** | **Next.js Route Handlers** | Server-side proxy to FHIR — keeps the FHIR URL and any credentials out of the browser, gives one audit point for PHI access |
| Data fetching | **TanStack Query v5** | Client-side caching, parallel queries, stale-while-revalidate — now hits our BFF, not FHIR directly |
| Form validation | **React Hook Form + Zod** | Schema validation matches FHIR field constraints |
| Charts | **Recharts** | Composable, works well with time-series vitals data |
| Icons | **Lucide React** | Clean outline icons, tree-shakeable |
| FHIR types | **@types/fhir** | Full TypeScript types for all R4 resources |

---

## 2. Project Structure

```
sepsofa/
├── app/
│   ├── layout.tsx                  # Root layout — QueryProvider, fonts, global nav
│   ├── page.tsx                    # Patient list — async Server Component, prefetches
│   ├── loading.tsx                 # Root loading skeleton
│   ├── error.tsx                   # Root error boundary ('use client')
│   ├── api/
│   │   └── fhir/
│   │       └── [...path]/
│   │           └── route.ts        # BFF proxy — the ONLY thing that talks to FHIR
│   ├── patients/
│   │   ├── new/
│   │   │   └── page.tsx            # Create patient — /patients/new
│   │   └── [id]/
│   │       ├── page.tsx            # Patient detail — async, parallel prefetch
│   │       ├── loading.tsx         # Detail page skeleton
│   │       └── edit/
│   │           └── page.tsx        # Edit patient — /patients/:id/edit
│   └── globals.css
│
├── components/
│   ├── layout/
│   │   └── AppShell.tsx            # Navigation wrapper ('use client')
│   ├── patients/
│   │   ├── PatientListClient.tsx   # 'use client' — owns search + sort + query state
│   │   ├── PatientDetailClient.tsx # 'use client' — owns all detail queries
│   │   ├── PatientCard.tsx
│   │   ├── PatientForm.tsx         # 'use client' — React Hook Form
│   │   └── SearchBar.tsx
│   ├── sepsis/
│   │   ├── RiskBadge.tsx
│   │   ├── SepsisRiskPanel.tsx
│   │   ├── QsofaScore.tsx
│   │   ├── SirsScore.tsx
│   │   └── News2Score.tsx
│   ├── vitals/
│   │   ├── VitalsGrid.tsx
│   │   ├── VitalCard.tsx
│   │   └── VitalsTrendChart.tsx    # 'use client' — Recharts requires browser APIs
│   ├── conditions/
│   │   └── ConditionsList.tsx
│   ├── medications/
│   │   └── MedicationsList.tsx
│   └── ui/
│       ├── QueryProvider.tsx       # 'use client' — TanStack Query context
│       ├── SkeletonCard.tsx
│       ├── ErrorPanel.tsx
│       └── EmptyState.tsx
│
├── lib/
│   ├── fhirServer.ts               # SERVER-ONLY — talks to real FHIR. import 'server-only'
│   ├── fhirClient.ts               # BROWSER — talks to /api/fhir/* (the BFF). Mirrors fhirServer shape
│   ├── scoring.ts                  # qSOFA, SIRS, NEWS2 — pure TS, no async, no React
│   ├── vitalsUtils.ts              # LOINC parsing, unit conversion, range checks
│   ├── infectionFlags.ts           # Infection source + antibiotic detection
│   ├── patientSchema.ts            # Zod schema + toFhirPatient() helper
│   ├── riskConfig.ts               # Tier labels, colours, action text
│   └── dateUtils.ts                # Age calculation, date formatting
│
├── hooks/
│   ├── usePatients.ts
│   ├── usePatientDetail.ts         # Parallel useQueries — the performance key
│   ├── useObservations.ts
│   ├── useConditions.ts
│   └── useMedications.ts
│
├── types/
│   └── scoring.ts                  # RiskTier, SepsisScore, VitalSnapshot
│
├── .env.example
├── .env.local
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── SPEC.md
├── AGENT.md
└── README.md
```

---

## 3. Server vs Client Components

This is the most critical architectural decision in App Router. Get it wrong and the app breaks silently, loses all performance benefit, or — in a clinical app — leaks PHI server details to the browser.

### Rule for SepSofa

> **FHIR data fetching is server-side via a Next.js Route Handler BFF.**
> Client components hit `/api/fhir/*` via TanStack Query; the FHIR base URL and any auth credentials live in server-only env vars and never reach the browser. Pages that need data are `async` Server Components that prefetch into a `QueryClient` and dehydrate the state into a `<HydrationBoundary>` — so first paint shows real data, and the client takes over for refetches, search, and optimistic updates.

### Why server-side, not browser-direct

1. **Hides the FHIR endpoint.** With browser-direct fetching the upstream URL is visible in DevTools. Today that's HAPI's test server; in any real deployment it'd be a hospital's EHR endpoint.
2. **A place for credentials.** The moment FHIR needs an API key, OAuth client secret, or SMART-on-FHIR token, you can't store it in a `NEXT_PUBLIC_*` var. Building the proxy now avoids retrofitting later.
3. **One audit point for PHI access.** HIPAA/GDPR require access logging — easy with one Route Handler, impossible with N browser-direct calls.
4. **Resource-path allowlist.** The proxy refuses to forward anything outside `Patient`, `Observation`, `Condition`, `MedicationRequest`. Browser-direct gives up that boundary.
5. **CORS becomes a non-issue.** All browser traffic is same-origin (`/api/fhir/*`); only the server hits the FHIR origin.

### Tradeoff

Every browser FHIR call hops `browser → Next server → FHIR` instead of going direct. On Vercel this adds ~30–80 ms. Negligible for this app.

### Component type table

| File | Type | Reason |
|---|---|---|
| `app/layout.tsx` | Server | Static shell — wraps `<QueryProvider>` |
| `app/page.tsx` | **Server (async)** | Prefetches the first page of patients, hands dehydrated state to the client |
| `app/patients/[id]/page.tsx` | **Server (async)** | Prefetches patient + vitals + conditions + medications in parallel |
| `app/api/fhir/[...path]/route.ts` | Server (Route Handler) | The BFF — only file that imports `lib/fhirServer.ts` |
| `app/error.tsx` | **Client** | Error boundaries must be Client Components |
| `components/ui/QueryProvider.tsx` | **Client** | TanStack Query context requires browser |
| `components/patients/PatientListClient.tsx` | **Client** | Owns search state + usePatients hook |
| `components/patients/PatientDetailClient.tsx` | **Client** | Owns usePatientDetail parallel queries |
| `components/patients/PatientForm.tsx` | **Client** | React Hook Form requires browser |
| `components/vitals/VitalsTrendChart.tsx` | **Client** | Recharts accesses `window` |
| `lib/fhirServer.ts` | Server-only | `import 'server-only'` — build fails if imported from client |
| `lib/fhirClient.ts` | Client-safe | Hits `/api/fhir/*`, no FHIR URL knowledge |
| `lib/scoring.ts` | None (pure TS) | No React — runs on server or client |

### The `'use client'` directive

Add `'use client'` as the **very first line** of any file that:
- Uses React hooks (`useState`, `useEffect`, `useQuery`, etc.)
- Uses browser APIs (`window`, `document`, `localStorage`)
- Renders a third-party library that touches the DOM (Recharts, etc.)
- Has event handlers (`onClick`, `onChange`, etc.)

```typescript
'use client';  // ← must be first line, before imports

import { useState } from 'react';
```

Once a component is a Client Component, everything it imports is also treated as a Client Component — you do not need `'use client'` on every child file.

---

## 4. Environment Variables

Because SepSofa proxies FHIR through a server Route Handler, **the FHIR URL is server-only — no `NEXT_PUBLIC_` prefix**. The `NEXT_PUBLIC_` prefix is exactly what would leak the URL into the browser bundle, which is what we're explicitly avoiding.

```bash
# .env.example
FHIR_BASE_URL=https://hapi.fhir.org/baseR4
# Optional — forwarded to FHIR as `Authorization: Bearer <token>` when set.
# Leave unset for the public HAPI test server.
# FHIR_AUTH_TOKEN=
```

```bash
# .env.local  (never commit — add to .gitignore)
FHIR_BASE_URL=https://hapi.fhir.org/baseR4
```

Access in code — **only from server-side files** (`lib/fhirServer.ts`, Route Handlers, async Server Components):
```typescript
const FHIR_BASE = process.env.FHIR_BASE_URL;
const FHIR_TOKEN = process.env.FHIR_AUTH_TOKEN; // optional
```

Client components never read these vars. They call `fetch('/api/fhir/...')` and let the BFF resolve the upstream URL.

---

## 5. Root Layout — QueryProvider

TanStack Query requires a `QueryClientProvider` wrapping the app. In App Router this must live in a Client Component because `QueryClient` uses browser state.

```typescript
// components/ui/QueryProvider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures each browser tab gets its own QueryClient instance.
  // Do NOT create QueryClient at the module level — it would be shared across server requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,       // 60s — don't refetch if data is fresh
            gcTime: 5 * 60_000,      // Keep in cache 5 min after unmount
            retry: 3,
            retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 10_000), // Exponential backoff
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

```typescript
// app/layout.tsx
import { QueryProvider } from '@/components/ui/QueryProvider';
import './globals.css';

export const metadata = {
  title: 'SepSofa — Sepsis Early Warning',
  description: 'Real-time sepsis risk scoring for clinical practitioners',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
```

---

## 6. Page Files (App Router)

Page files are Server Components. Pages that need data are **`async`** and prefetch into a `QueryClient` server-side, then hand the dehydrated cache to the client via `<HydrationBoundary>`. The client-side hook uses the **same query key** and picks up the data without a refetch — first paint shows real cards, the client owns everything that comes next.

```typescript
// app/page.tsx
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getPatients } from '@/lib/fhirServer';
import { PatientListClient } from '@/components/patients/PatientListClient';

export const metadata = { title: 'Patients — SepSofa' };

export default async function PatientListPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['patients', 0],
    queryFn: () => getPatients(0),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PatientListClient />
    </HydrationBoundary>
  );
}
```

```typescript
// app/patients/[id]/page.tsx
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getPatient, getVitals, getConditions, getMedications } from '@/lib/fhirServer';
import { PatientDetailClient } from '@/components/patients/PatientDetailClient';

export const metadata = { title: 'Patient — SepSofa' };

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const queryClient = new QueryClient();
  // CRITICAL: prefetch all four resources in parallel — never sequentially.
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: ['patient',     params.id], queryFn: () => getPatient(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['vitals',      params.id], queryFn: () => getVitals(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['conditions',  params.id], queryFn: () => getConditions(params.id) }),
    queryClient.prefetchQuery({ queryKey: ['medications', params.id], queryFn: () => getMedications(params.id) }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PatientDetailClient patientId={params.id} />
    </HydrationBoundary>
  );
}
```

The new/edit pages stay thin — no data to prefetch on create, and the edit form can either prefetch the patient or let the client hook do it on mount.

```typescript
// app/patients/new/page.tsx
import { PatientForm } from '@/components/patients/PatientForm';

export const metadata = { title: 'New Patient — SepSofa' };

export default function NewPatientPage() {
  return <PatientForm mode="create" />;
}
```

```typescript
// app/patients/[id]/edit/page.tsx
import { PatientForm } from '@/components/patients/PatientForm';

export default function EditPatientPage({ params }: { params: { id: string } }) {
  return <PatientForm mode="edit" patientId={params.id} />;
}
```

---

## 7. Loading & Error Files

App Router uses co-located `loading.tsx` and `error.tsx` as automatic Suspense and ErrorBoundary wrappers.

```typescript
// app/loading.tsx
export default function Loading() {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}
```

```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 text-center">
      <p className="text-red-700 font-medium mb-3">Something went wrong.</p>
      <p className="text-sm text-gray-500 mb-4">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
        Try again
      </button>
    </div>
  );
}
```

---

## 8. FHIR Client — split into server and browser

The client is **two files** with the same function shape. Server-side code (Route Handler, async pages) imports from `lib/fhirServer.ts`, which talks to FHIR directly. Browser code imports from `lib/fhirClient.ts`, which talks to `/api/fhir/*` (the proxy). The duplication is intentional — it's the boundary that keeps the FHIR URL and any credentials out of the browser bundle.

### 8.1 `lib/fhirServer.ts` — server-only

```typescript
import 'server-only';

const FHIR_BASE = process.env.FHIR_BASE_URL;
const FHIR_TOKEN = process.env.FHIR_AUTH_TOKEN;

const FHIR_HEADERS: HeadersInit = {
  Accept: 'application/fhir+json',
  'Content-Type': 'application/fhir+json',
};

export class FhirError extends Error {
  constructor(public status: number, public operationOutcome: unknown) {
    super(`FHIR error ${status}`);
    this.name = 'FhirError';
  }
}

export async function fhirServerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!FHIR_BASE) throw new Error('FHIR_BASE_URL is not set. Configure it in .env.local.');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${FHIR_BASE}${path}`, {
      ...init,
      headers: {
        ...FHIR_HEADERS,
        ...(FHIR_TOKEN ? { Authorization: `Bearer ${FHIR_TOKEN}` } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
      // Opt out of Next.js extended fetch caching.
      // TanStack Query (on the client) owns response caching.
      cache: 'no-store',
    });

    if (!res.ok) throw new FhirError(res.status, await res.json().catch(() => ({})));
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('FHIR server timed out after 10 seconds.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Resource fetchers — used by Route Handler + async Server Components ──────

export const getPatients = (page = 0, count = 20) =>
  fhirServerFetch<fhir4.Bundle>(`/Patient?_count=${count}&_getpagesoffset=${page * count}&_sort=family`);
export const getPatient = (id: string) =>
  fhirServerFetch<fhir4.Patient>(`/Patient/${id}`);
export const createPatient = (resource: fhir4.Patient) =>
  fhirServerFetch<fhir4.Patient>('/Patient', { method: 'POST', body: JSON.stringify(resource) });
export const updatePatient = (id: string, resource: fhir4.Patient) =>
  fhirServerFetch<fhir4.Patient>(`/Patient/${id}`, { method: 'PUT', body: JSON.stringify(resource) });
export const searchPatientsByName = (name: string) =>
  fhirServerFetch<fhir4.Bundle>(`/Patient?name=${encodeURIComponent(name)}&_count=50`);
export const getVitals = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(`/Observation?patient=${patientId}&category=vital-signs&_sort=-date&_count=20`);
export const getVitalsTrend = (patientId: string) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return fhirServerFetch<fhir4.Bundle>(`/Observation?patient=${patientId}&category=vital-signs&date=ge${since}&_sort=date&_count=100`);
};
export const getConditions = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(`/Condition?patient=${patientId}&clinical-status=active&_sort=-onset-date`);
export const getMedications = (patientId: string) =>
  fhirServerFetch<fhir4.Bundle>(`/MedicationRequest?patient=${patientId}&status=active&_sort=-authored`);
```

The `import 'server-only'` at the top is the safety net. If any client component accidentally imports this file, the build fails with a clear error — better than leaking the FHIR URL into a JS chunk.

### 8.2 `lib/fhirClient.ts` — browser

```typescript
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

// ─── Resource fetchers — same shape as fhirServer.ts for hydration parity ─────

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
  clientFetch<fhir4.Bundle>(`/Condition?patient=${patientId}&clinical-status=active&_sort=-onset-date`);
export const fetchMedications = (patientId: string) =>
  clientFetch<fhir4.Bundle>(`/MedicationRequest?patient=${patientId}&status=active&_sort=-authored`);
```

### 8.3 `app/api/fhir/[...path]/route.ts` — the BFF proxy

The single file the browser actually talks to. Three responsibilities:

1. **Allowlist** — refuse any resource type that isn't `Patient`, `Observation`, `Condition`, or `MedicationRequest`.
2. **Audit logging** — one structured `console.log` line per request. Vercel/Render capture stdout, so it ships to log aggregation for free.
3. **Forward upstream** — preserve method, query string, and body verbatim; let `fhirServerFetch` attach the optional `Authorization` header.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fhirServerFetch, FhirError } from '@/lib/fhirServer';

const ALLOWED_RESOURCES = new Set([
  'Patient', 'Observation', 'Condition', 'MedicationRequest',
]);

function logFhirAccess(method: string, path: string, status: number, durationMs: number) {
  // console.log(JSON.stringify({
  //   type: 'fhir_access',
  //   timestamp: new Date().toISOString(),
  //   method, path, status, duration_ms: durationMs,
  // }));
}

async function handle(
  req: NextRequest,
  ctx: { params: { path: string[] } },
  method: string,
) {
  const [resource, ...rest] = ctx.params.path ?? [];

  if (!resource || !ALLOWED_RESOURCES.has(resource)) {
    return NextResponse.json(
      { error: 'Resource not allowed', allowed: Array.from(ALLOWED_RESOURCES) },
      { status: 403 },
    );
  }

  const search = req.nextUrl.search; // forward _sort, _count, category=, etc. verbatim
  const subPath = `/${resource}${rest.length ? '/' + rest.join('/') : ''}${search}`;
  const body = method === 'GET' || method === 'DELETE' ? undefined : await req.text();

  const started = Date.now();
  try {
    const data = await fhirServerFetch<unknown>(subPath, { method, body });
    logFhirAccess(method, subPath, 200, Date.now() - started);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof FhirError) {
      logFhirAccess(method, subPath, err.status, Date.now() - started);
      return NextResponse.json(err.operationOutcome, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Unknown FHIR error';
    logFhirAccess(method, subPath, 500, Date.now() - started);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET  = (req: NextRequest, ctx: { params: { path: string[] } }) => handle(req, ctx, 'GET');
export const POST = (req: NextRequest, ctx: { params: { path: string[] } }) => handle(req, ctx, 'POST');
export const PUT  = (req: NextRequest, ctx: { params: { path: string[] } }) => handle(req, ctx, 'PUT');

export const dynamic = 'force-dynamic'; // never statically cache the proxy
```

---

## 9. TanStack Query Hooks

All hooks must have `'use client'` at the top — they use React hooks internally. They import from **`lib/fhirClient`** (browser → BFF), never from `lib/fhirServer` (which would fail the `import 'server-only'` guard).

The query keys here **must match** the keys used by the server-side `prefetchQuery` calls in `app/page.tsx` and `app/patients/[id]/page.tsx` — that's how the dehydrated cache flows through.

```typescript
// hooks/usePatients.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchPatients } from '@/lib/fhirClient';

export function usePatients(page = 0) {
  return useQuery({
    queryKey: ['patients', page],   // same key as the server prefetch
    queryFn: () => fetchPatients(page),
  });
}
```

```typescript
// hooks/usePatientDetail.ts
// CRITICAL: fetch all four resources in parallel — never sequentially
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
```

---

## 10. Navigation

In App Router, always use `next/navigation` — not `next/router`.

```typescript
'use client';
import { useRouter } from 'next/navigation';

const router = useRouter();
router.push(`/patients/${newPatient.id}`);  // Navigate to detail page
router.back();                               // Go back
router.refresh();                            // Re-run Server Components on current route
```

```typescript
// Static links — use next/link
import Link from 'next/link';

<Link href={`/patients/${patient.id}`}>View patient</Link>
```

---

## 11. Scoring Engine

Pure TypeScript in `lib/scoring.ts`. No `'use client'`, no async, no React imports. Works identically on server and client.

```typescript
// lib/scoring.ts

export type RiskTier = 'critical' | 'high' | 'medium' | 'low';

export interface VitalSnapshot {
  heartRate?: number;
  respiratoryRate?: number;
  systolicBP?: number;
  temperature?: number;       // Always °C — normalise before passing in
  spo2?: number;
  consciousness?: 'alert' | 'altered';
  onSupplementalO2?: boolean;
}

export interface ScoreCriterion {
  label: string;
  value: string;
  threshold: string;
  met: boolean;
}

export interface QsofaResult  { score: number; criteria: ScoreCriterion[]; }
export interface SirsResult   { score: number; criteria: ScoreCriterion[]; }
export interface News2ParameterScore { parameter: string; value: string; points: number; }
export interface News2Result  { total: number; breakdown: News2ParameterScore[]; hasSingleParamAt3: boolean; }
export interface SepsisScore  { qsofa: QsofaResult; sirs: SirsResult; news2: News2Result; tier: RiskTier; }

export function computeQsofa(v: VitalSnapshot): QsofaResult {
  const criteria: ScoreCriterion[] = [
    { label: 'Resp. rate ≥ 22 br/min', value: v.respiratoryRate != null ? `${v.respiratoryRate}` : 'N/A', threshold: '≥ 22',    met: (v.respiratoryRate ?? 0) >= 22 },
    { label: 'Altered mentation',       value: v.consciousness ?? 'unknown',                               threshold: 'altered', met: v.consciousness === 'altered' },
    { label: 'Systolic BP ≤ 100 mmHg', value: v.systolicBP != null ? `${v.systolicBP}` : 'N/A',          threshold: '≤ 100',   met: (v.systolicBP ?? 999) <= 100 },
  ];
  return { score: criteria.filter((c) => c.met).length, criteria };
}

export function computeSirs(v: VitalSnapshot): SirsResult {
  const criteria: ScoreCriterion[] = [
    { label: 'Temp > 38°C or < 36°C', value: v.temperature != null ? `${v.temperature.toFixed(1)}°C` : 'N/A', threshold: '> 38 or < 36', met: v.temperature != null && (v.temperature > 38 || v.temperature < 36) },
    { label: 'Heart rate > 90 bpm',    value: v.heartRate != null ? `${v.heartRate}` : 'N/A',                  threshold: '> 90',          met: (v.heartRate ?? 0) > 90 },
    { label: 'Resp. rate > 20 br/min', value: v.respiratoryRate != null ? `${v.respiratoryRate}` : 'N/A',      threshold: '> 20',          met: (v.respiratoryRate ?? 0) > 20 },
  ];
  return { score: criteria.filter((c) => c.met).length, criteria };
}

export function computeNews2(v: VitalSnapshot): News2Result {
  const breakdown: News2ParameterScore[] = [];
  const s = (parameter: string, value: number | undefined, points: number) =>
    breakdown.push({ parameter, value: value != null ? String(value) : 'N/A', points });

  const rr = v.respiratoryRate;
  s('Respiratory rate', rr,  rr == null ? 0 : rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3);

  const spo2 = v.spo2;
  s('SpO₂', spo2, spo2 == null ? 0 : spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0);

  s('Supplemental O₂', undefined, v.onSupplementalO2 ? 2 : 0);

  const sbp = v.systolicBP;
  s('Systolic BP', sbp, sbp == null ? 0 : sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3);

  const hr = v.heartRate;
  s('Heart rate', hr, hr == null ? 0 : hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3);

  s('Consciousness', undefined, v.consciousness === 'altered' ? 3 : 0);

  const temp = v.temperature;
  s('Temperature', temp, temp == null ? 0 : temp <= 35.0 ? 3 : temp <= 36.0 ? 1 : temp <= 38.0 ? 0 : temp <= 39.0 ? 1 : 2);

  const total = breakdown.reduce((sum, b) => sum + b.points, 0);
  const hasSingleParamAt3 = breakdown.some((b) => b.points >= 3);
  return { total, breakdown, hasSingleParamAt3 };
}

export function computeRiskTier(q: QsofaResult, s: SirsResult, n: News2Result): RiskTier {
  if (q.score >= 2 && n.total >= 7) return 'critical';
  if (q.score >= 2 || n.total >= 7) return 'high';
  if (s.score >= 2 || n.total >= 5 || n.hasSingleParamAt3) return 'medium';
  return 'low';
}

export function computeSepsisScore(v: VitalSnapshot): SepsisScore {
  const qsofa = computeQsofa(v);
  const sirs  = computeSirs(v);
  const news2 = computeNews2(v);
  return { qsofa, sirs, news2, tier: computeRiskTier(qsofa, sirs, news2) };
}
```

---

## 12. FHIR Observation Parsing

```typescript
// lib/vitalsUtils.ts
import type { VitalSnapshot } from './scoring';

const LOINC = {
  HEART_RATE:       '8867-4',
  RESPIRATORY_RATE: '9279-1',
  SYSTOLIC_BP:      '8480-6',
  BLOOD_PRESSURE:   '55284-4',
  TEMPERATURE:      '8310-5',
  SPO2:             '59408-5',
  WEIGHT:           '29463-7',
  HEIGHT:           '8302-2',
  BMI:              '39156-5',
};

export function getLatestObservation(bundle: fhir4.Bundle, loincCode: string) {
  return (bundle.entry ?? [])
    .map((e) => e.resource as fhir4.Observation)
    .filter((obs) => obs?.code?.coding?.some((c) => c.code === loincCode))
    .sort((a, b) =>
      new Date(b.effectiveDateTime ?? 0).getTime() -
      new Date(a.effectiveDateTime ?? 0).getTime()
    )[0];
}

export function getObservationValue(obs: fhir4.Observation | undefined): number | undefined {
  if (!obs) return undefined;
  if (obs.valueQuantity?.value != null) return obs.valueQuantity.value;
  return obs.component
    ?.find((c) => c.code?.coding?.some((coding) => coding.code === LOINC.SYSTOLIC_BP))
    ?.valueQuantity?.value;
}

export function normalizeTemperature(obs: fhir4.Observation | undefined): number | undefined {
  const value = getObservationValue(obs);
  if (value == null) return undefined;
  const unit = obs?.valueQuantity?.unit ?? obs?.valueQuantity?.code ?? '';
  if (['[degF]', 'degF', '°F', 'F'].includes(unit)) return (value - 32) * (5 / 9);
  return value;
}

export function buildVitalSnapshot(bundle: fhir4.Bundle): VitalSnapshot {
  return {
    heartRate:       getObservationValue(getLatestObservation(bundle, LOINC.HEART_RATE)),
    respiratoryRate: getObservationValue(getLatestObservation(bundle, LOINC.RESPIRATORY_RATE)),
    systolicBP:      getObservationValue(getLatestObservation(bundle, LOINC.SYSTOLIC_BP))
                     ?? getObservationValue(getLatestObservation(bundle, LOINC.BLOOD_PRESSURE)),
    temperature:     normalizeTemperature(getLatestObservation(bundle, LOINC.TEMPERATURE)),
    spo2:            getObservationValue(getLatestObservation(bundle, LOINC.SPO2)),
    consciousness:   'alert',
    onSupplementalO2: false,
  };
}

export interface VitalRange { low: number; high: number; unit: string; }

export const VITAL_RANGES: Record<string, VitalRange> = {
  heartRate:       { low: 40,   high: 130,  unit: 'bpm' },
  respiratoryRate: { low: 8,    high: 25,   unit: 'br/min' },
  systolicBP:      { low: 90,   high: 180,  unit: 'mmHg' },
  temperature:     { low: 35.0, high: 39.1, unit: '°C' },
  spo2:            { low: 92,   high: 100,  unit: '%' },
  bmi:             { low: 16,   high: 35,   unit: 'kg/m²' },
};

export function isOutOfRange(vital: string, value: number): boolean {
  const range = VITAL_RANGES[vital];
  if (!range) return false;
  return value < range.low || value > range.high;
}
```

---

## 13. Patient Form Validation

```typescript
// lib/patientSchema.ts
import { z } from 'zod';

export const patientFormSchema = z.object({
  givenName: z
    .string()
    .min(1, 'Given name is required')
    .regex(/^[a-zA-Z\s\-']+$/, 'Letters, spaces, hyphens, and apostrophes only'),
  familyName: z
    .string()
    .min(1, 'Family name is required')
    .regex(/^[a-zA-Z\s\-']+$/, 'Letters, spaces, hyphens, and apostrophes only'),
  gender: z.enum(['male', 'female', 'other', 'unknown'], {
    required_error: 'Please select a gender',
  }),
  birthDate: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((d) => new Date(d) < new Date(), 'Date of birth cannot be in the future')
    .refine((d) => {
      const min = new Date();
      min.setFullYear(min.getFullYear() - 130);
      return new Date(d) > min;
    }, 'Cannot be more than 130 years ago'),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export function toFhirPatient(values: PatientFormValues, existingId?: string): fhir4.Patient {
  return {
    resourceType: 'Patient',
    ...(existingId && { id: existingId }),
    name: [{ use: 'official', family: values.familyName, given: [values.givenName] }],
    gender: values.gender,
    birthDate: values.birthDate,
  };
}
```

---

## 14. Risk Tier Config

```typescript
// lib/riskConfig.ts
import type { RiskTier } from './scoring';

export const RISK_CONFIG: Record<RiskTier, {
  label: string;
  action: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
}> = {
  critical: { label: 'Critical', action: 'Immediate emergency response required', bgClass: 'bg-red-50',    textClass: 'text-red-900',    borderClass: 'border-red-300',    dotClass: 'bg-red-500' },
  high:     { label: 'High',     action: 'Urgent review within 30 minutes',       bgClass: 'bg-orange-50', textClass: 'text-orange-900', borderClass: 'border-orange-300', dotClass: 'bg-orange-500' },
  medium:   { label: 'Medium',   action: 'Increase monitoring frequency',         bgClass: 'bg-amber-50',  textClass: 'text-amber-900',  borderClass: 'border-amber-300',  dotClass: 'bg-amber-500' },
  low:      { label: 'Low',      action: 'Routine monitoring',                    bgClass: 'bg-green-50',  textClass: 'text-green-900',  borderClass: 'border-green-300',  dotClass: 'bg-green-500' },
};
```

---

## 15. Recharts in App Router

Recharts accesses `window` during render, which breaks Server Components. Always use `dynamic` import with `ssr: false`.

```typescript
// components/vitals/VitalsTrendChart.tsx
'use client';

import dynamic from 'next/dynamic';

// If importing Recharts directly in a file that might render server-side,
// use dynamic import to disable SSR
const TrendChartInner = dynamic(() => import('./TrendChartInner'), { ssr: false });

export function VitalsTrendChart({ data }: { data: TrendDataPoint[] }) {
  return <TrendChartInner data={data} />;
}
```

If `VitalsTrendChart.tsx` already has `'use client'` at the top and is only ever rendered inside other Client Components, the dynamic import is not strictly required — but it is the safe default.

---

## 16. `next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No special config needed for SepSofa.
  // All FHIR calls are browser-to-FHIR-server (no Next.js API routes used).
};

export default nextConfig;
```

---

## 17. `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

---

## 18. Development Workflow

```bash
npm install
npm run dev          # Dev server with Turbopack (Next.js 14+)
npx tsc --noEmit     # Type check without building
npm run build        # Production build
npm run start        # Serve production build locally
```

---

## 19. Deployment (Vercel)

Next.js is built by Vercel — zero configuration needed for deployment.

```bash
npm i -g vercel
vercel                       # Deploy — Vercel auto-detects Next.js App Router
vercel env add FHIR_BASE_URL production
# Value: https://hapi.fhir.org/baseR4

# Optional — only if your FHIR server requires a bearer token.
# vercel env add FHIR_AUTH_TOKEN production
```

Both vars are server-only (no `NEXT_PUBLIC_` prefix). They're available to the Route Handler and to async Server Components, never bundled into the browser.

No `vercel.json` needed. App Router handles all routing natively — unlike a Vite SPA, there are no rewrite rules required for client-side navigation.

---

## 20. FHIR Test Data

Seed meaningful test patients on the HAPI public server so judges see a working demo immediately.

| Name | Clinical scenario | qSOFA | NEWS2 | Tier |
|---|---|---|---|---|
| Alex Mercer | Active sepsis — RR 26, SBP 88, HR 118, Temp 38.9 | 2 | 9 | Critical |
| Maria Santos | Early deterioration — RR 24, SBP 96, altered mentation | 2 | 7 | High |
| Sarah Chen | Monitoring needed — RR 23, HR 108, Temp 38.2 | 1 | 6 | Medium |
| James Okafor | Stable — all vitals within normal range | 0 | 1 | Low |

Create each via `POST /Patient`, then `POST /Observation` for each vital using the LOINC codes in `lib/vitalsUtils.ts`.

---

## 21. Key Rules for the Agent

1. **Never add `'use client'` to page files.** Pages are Server Components. Pages that need data are `async` and prefetch into a `QueryClient`, then wrap children in `<HydrationBoundary>`. Interactivity is delegated to Client Components passed as children.
2. **Never fetch FHIR resources sequentially on the detail page.** Always use `Promise.all` for the server prefetch and `useQueries` for the client. Sequential `await` calls are the single biggest FHIR performance failure.
3. **`FHIR_BASE_URL` is server-only — no `NEXT_PUBLIC_` prefix.** The whole point of the BFF is that the FHIR URL never reaches the browser. If you find yourself reaching for `NEXT_PUBLIC_`, you're in the wrong file — move the call to `lib/fhirServer.ts` or to the Route Handler.
4. **Never import `lib/fhirServer.ts` from a Client Component.** The `import 'server-only'` guard will fail the build. Client code uses `lib/fhirClient.ts`, which hits `/api/fhir/*`.
5. **Server prefetch keys MUST match client query keys.** `['patients', 0]` on the server, `['patients', 0]` on the client. Mismatched keys cause a double-fetch (server prefetches, client refetches the same data with a different key) and a hydration warning.
6. **Always add `cache: 'no-store'` to `fhirServerFetch`.** Next.js extends native `fetch` with its own cache. TanStack Query (on the client) owns caching here — opt out of Next.js caching to prevent conflicts.
7. **All scoring logic is synchronous and pure.** No async in `lib/scoring.ts`. No React imports. No side effects.
8. **Temperature must always be normalised to °C before scoring.** Call `normalizeTemperature()` before building a `VitalSnapshot`.
9. **Partial vitals is not an error.** If a vital is missing, score with what is available and note the gap in the UI.
10. **Use `useRouter` from `next/navigation`, not `next/router`.** The Pages Router hook does not exist in App Router.
11. **Recharts requires `'use client'`** and ideally `dynamic(() => ..., { ssr: false })`. Never render it in a Server Component.
12. **Risk tier must be visible above the fold.** Patient list: badge on every card. Patient detail: first panel after the demographics bar.
13. **The BFF's allowlist is non-negotiable.** Only `Patient`, `Observation`, `Condition`, `MedicationRequest` are forwarded. If you need another resource type, add it explicitly to `ALLOWED_RESOURCES` — don't remove the allowlist.